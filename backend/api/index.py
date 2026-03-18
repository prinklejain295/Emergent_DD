from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from typing import Optional
import uuid
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
import jwt
import os
import requests
import json

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168

NOCODB_URL = os.environ.get('NOCODB_URL', 'https://app.nocodb.com')
NOCODB_API_TOKEN = os.environ.get('NOCODB_API_TOKEN', '')
NOCODB_TABLE_ORGANIZATIONS = os.environ.get('NOCODB_TABLE_ORGANIZATIONS', '')
NOCODB_TABLE_USERS = os.environ.get('NOCODB_TABLE_USERS', '')
NOCODB_TABLE_CLIENTS = os.environ.get('NOCODB_TABLE_CLIENTS', '')
NOCODB_TABLE_DUEDATES = os.environ.get('NOCODB_TABLE_DUEDATES', '')
NOCODB_TABLE_SERVICETYPES = os.environ.get('NOCODB_TABLE_SERVICETYPES', '')

DEFAULT_SERVICE_TYPES = {
    'federal': ['Form 941', 'Form 940', 'Form 1120', 'Form 1065', 'Form W-2', 'Form 1099-NEC'],
    'state': ['State Tax Filing', 'State Registration', 'Annual Report'],
    'payroll': ['Payroll Tax', 'Payroll Report', 'W-2 Filing'],
    'custom': [],
    'other': ['Other Compliance']
}

def get_headers():
    return {"xc-token": NOCODB_API_TOKEN, "Content-Type": "application/json"}

def hash_password(password: str) -> str:
    return hashlib.sha256((password + JWT_SECRET).encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def get_token():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None, jsonify({"error": "Invalid token format"}), 401
    try:
        payload = jwt.decode(auth.split(' ')[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload, None, None
    except jwt.ExpiredSignatureError:
        return None, jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return None, jsonify({"error": "Invalid token"}), 401

def nc_get(endpoint: str, params: dict = None):
    try:
        r = requests.get(f"{NOCODB_URL}{endpoint}", headers=get_headers(), params=params, timeout=30)
        return r.json() if r.status_code < 400 else None
    except:
        return None

def nc_post(endpoint: str, data: dict):
    try:
        r = requests.post(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
        return r.json() if r.status_code < 400 else None
    except:
        return None

def nc_patch(endpoint: str, data: dict):
    try:
        r = requests.patch(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
        return r.json() if r.status_code < 400 else None
    except:
        return None

def nc_delete(endpoint: str, data: dict):
    try:
        r = requests.delete(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
        return {"success": True}
    except:
        return None

def create_jwt_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    org_id = str(uuid.uuid4())
    nc_post(f"/api/v2/tables/{NOCODB_TABLE_ORGANIZATIONS}/records", {
        "id": org_id, "name": data.get('organization_name', 'My Organization'), 
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    user_id = str(uuid.uuid4())
    nc_post(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records", {
        "id": user_id, "email": data.get('email'), "name": data.get('name'),
        "password": hash_password(data.get('password')),
        "organization_id": org_id, "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    token = create_jwt_token({"user_id": user_id, "email": data.get('email'), "organization_id": org_id})
    return jsonify({
        "access_token": token, "token_type": "bearer",
        "user": {"id": user_id, "email": data.get('email'), "name": data.get('name'), "role": "admin"},
        "organization": {"id": org_id, "name": data.get('organization_name', 'My Organization')}
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records",
                    params={"where": f"(email,eq,{email})", "limit": 1})
    
    if not result or not result.get('list'):
        return jsonify({"error": "Invalid credentials"}), 401
    
    user = result['list'][0]
    if not verify_password(password, user.get('password', '')):
        return jsonify({"error": "Invalid credentials"}), 401
    
    token = create_jwt_token({"user_id": user['id'], "email": user['email'], "organization_id": user['organization_id']})
    return jsonify({
        "access_token": token, "token_type": "bearer",
        "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user.get('role', 'member')},
        "organization": {"id": user['organization_id'], "name": "My Organization"}
    })

@app.route('/api/dashboard/stats')
def get_stats():
    user, error, code = get_token()
    if error:
        return error, code
    
    stats = {"total_clients": 0, "total_due_dates": 0, "upcoming_count": 0, "overdue_count": 0, "upcoming_due_dates": []}
    org_id = user.get("organization_id")
    
    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                     params={"where": f"(organization_id,eq,{org_id})", "limit": 1000})
    if result:
        stats["total_clients"] = len(result.get('list', []))
    
    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records",
                     params={"where": f"(organization_id,eq,{org_id})", "limit": 1000})
    if result:
        due_dates = result.get('list', [])
        stats["total_due_dates"] = len(due_dates)
        now = datetime.now(timezone.utc)
        thirty_days = now + timedelta(days=30)
        for dd in due_dates:
            try:
                due_date = datetime.fromisoformat(dd['due_date'].replace('Z', '+00:00'))
            except:
                due_date = now
            if due_date < now:
                stats["overdue_count"] += 1
            elif due_date <= thirty_days:
                stats["upcoming_count"] += 1
                stats["upcoming_due_dates"].append(dd)
    return jsonify(stats)

@app.route('/api/clients', methods=['GET'])
def get_clients():
    user, error, code = get_token()
    if error:
        return error, code
    
    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                    params={"where": f"(organization_id,eq,{user['organization_id']})", "limit": 1000})
    return jsonify(result.get('list', []) if result else [])

@app.route('/api/clients', methods=['POST'])
def create_client():
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    client_id = str(uuid.uuid4())
    nc_post(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "id": client_id, "organization_id": user['organization_id'],
        "name": data.get('name'), "email": data.get('email'),
        "phone": data.get('phone'), "company": data.get('company'),
        "notes": data.get('notes'), "created_at": datetime.now(timezone.utc).isoformat()
    })
    return jsonify({"id": client_id, **data})

@app.route('/api/clients/<client_id>', methods=['PUT'])
def update_client(client_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "Id": client_id, "name": data.get('name'), "email": data.get('email'),
        "phone": data.get('phone'), "company": data.get('company'), "notes": data.get('notes')
    })
    return jsonify({"id": client_id, **data})

@app.route('/api/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {"Id": client_id})
    return jsonify({"message": "Client deleted"})

@app.route('/api/clients/upload-excel', methods=['POST'])
def upload_excel():
    return jsonify({"message": "Excel upload not implemented in serverless mode"})

@app.route('/api/service-types', methods=['GET'])
def get_service_types():
    user, error, code = get_token()
    if error:
        return error, code
    return jsonify(DEFAULT_SERVICE_TYPES.copy())

@app.route('/api/service-types', methods=['POST'])
def create_service_type():
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    return jsonify({"id": str(uuid.uuid4()), **data})

@app.route('/api/due-dates', methods=['GET'])
def get_due_dates():
    user, error, code = get_token()
    if error:
        return error, code
    
    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records",
                    params={"where": f"(organization_id,eq,{user['organization_id']})", "limit": 1000})
    return jsonify(result.get('list', []) if result else [])

@app.route('/api/due-dates', methods=['POST'])
def create_due_date():
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    dd_id = str(uuid.uuid4())
    nc_post(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {
        "id": dd_id, "organization_id": user['organization_id'],
        "client_id": data.get('client_id'), "service_type": data.get('service_type'),
        "description": data.get('description'), "due_date": data.get('due_date'),
        "is_recurring": data.get('is_recurring', False), 
        "recurrence_frequency": data.get('recurrence_frequency'),
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return jsonify({"id": dd_id, **data})

@app.route('/api/due-dates/<dd_id>', methods=['PUT'])
def update_due_date(dd_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {
        "Id": dd_id, "client_id": data.get('client_id'), "service_type": data.get('service_type'),
        "description": data.get('description'), "due_date": data.get('due_date'),
        "is_recurring": data.get('is_recurring'), "recurrence_frequency": data.get('recurrence_frequency')
    })
    return jsonify({"id": dd_id, **data})

@app.route('/api/due-dates/<dd_id>', methods=['DELETE'])
def delete_due_date(dd_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {"Id": dd_id})
    return jsonify({"message": "Due date deleted"})

@app.route('/api/due-dates/<dd_id>/status', methods=['PATCH'])
def update_status(dd_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    status = request.args.get('status')
    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {"Id": dd_id, "status": status})
    return jsonify({"message": "Status updated"})

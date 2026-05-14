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
NOCODB_TABLE_ERRORS = os.environ.get('NOCODB_TABLE_ERRORS', '')
NOCODB_TABLE_CLIENT_SERVICES = os.environ.get('NOCODB_TABLE_CLIENT_SERVICES', '')
NOCODB_TABLE_LEADS       = os.environ.get('NOCODB_TABLE_LEADS', '').strip()
NOCODB_TABLE_REMINDERS   = os.environ.get('NOCODB_TABLE_REMINDERS', '').strip()
NOCODB_TABLE_TIMESHEETS  = os.environ.get('NOCODB_TABLE_TIMESHEETS', '').strip()

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

def nc_get_all(endpoint: str, base_params: dict = None):
    """Paginate through all NocoDB records using pageInfo.isLastPage."""
    PAGE = 100   # NocoDB hard-caps at 100 per page
    all_records = []
    offset = 0
    params = dict(base_params or {})
    params['limit'] = PAGE
    while True:
        params['offset'] = offset
        result = nc_get(endpoint, params)
        if not result:
            break
        page = result.get('list') or []
        all_records.extend(page)
        page_info = result.get('pageInfo') or {}
        if page_info.get('isLastPage', True) or len(page) < PAGE:
            break
        offset += PAGE
    return all_records

def nc_post(endpoint: str, data: dict):
    try:
        r = requests.post(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
        if r.status_code >= 400:
            print(f"NocoDB POST error: {r.status_code} - {r.text}")
            return None
        return r.json()
    except Exception as e:
        print(f"NocoDB POST exception: {e}")
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
    
    token = create_jwt_token({
        "user_id": user_id, "email": data.get('email'),
        "organization_id": org_id, "role": "admin", "assigned_clients": ""
    })
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
    
    token = create_jwt_token({
        "user_id": user['id'], "email": user['email'],
        "organization_id": user['organization_id'],
        "role": user.get('role', 'admin'),
        "assigned_clients": user.get('assigned_clients', '')
    })
    return jsonify({
        "access_token": token, "token_type": "bearer",
        "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user.get('role', 'admin')},
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

def _assigned_ids(user):
    """Return set of assigned client NocoDB Ids for a consultant, or None if not restricted."""
    if user.get('role', 'admin') != 'consultant':
        return None  # no restriction
    raw = user.get('assigned_clients', '') or ''
    return {s.strip() for s in raw.split(',') if s.strip()}

@app.route('/api/clients', methods=['GET'])
def get_clients():
    user, error, code = get_token()
    if error:
        return error, code

    clients = nc_get_all(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                         {"where": f"(organization_id,eq,{user['organization_id']})", "sort": "name"})

    assigned = _assigned_ids(user)
    if assigned is not None:
        clients = [c for c in clients if str(c.get('Id', '')) in assigned]

    return jsonify(clients)

@app.route('/api/clients', methods=['POST'])
def create_client():
    user, error, code = get_token()
    if error:
        return error, code

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    client_id = str(uuid.uuid4())
    result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "id": client_id, "organization_id": user['organization_id'],
        "name": data.get('name'), "email": data.get('email'),
        "phone": data.get('phone'), "phone_code": data.get('phone_code', ''),
        "company": data.get('company'), "type": data.get('type', 'individual'),
        "doing_business_as": data.get('doing_business_as', ''),
        "tags": data.get('tags', ''), "notes": data.get('notes'),
        "category": data.get('category', ''),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    if result is None:
        return jsonify({"error": "Failed to create client. Check database configuration."}), 500
    return jsonify({"id": client_id, **data})

@app.route('/api/clients/<client_id>', methods=['PUT'])
def update_client(client_id):
    user, error, code = get_token()
    if error:
        return error, code
    
    data = request.get_json()
    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "Id": int(client_id), "name": data.get('name'), "email": data.get('email'),
        "phone": data.get('phone'), "phone_code": data.get('phone_code', ''),
        "company": data.get('company'), "type": data.get('type', 'individual'),
        "doing_business_as": data.get('doing_business_as', ''),
        "tags": data.get('tags', ''), "notes": data.get('notes'),
        "category": data.get('category', '')
    })
    return jsonify({"id": client_id, **data})

@app.route('/api/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    user, error, code = get_token()
    if error:
        return error, code

    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {"Id": int(client_id)})
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

# ── Client Services Dashboard ─────────────────────────────────────────────────

@app.route('/api/client-services', methods=['GET'])
def get_client_services():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_CLIENT_SERVICES:
        return jsonify({"error": "Client services table not configured"}), 503

    services = nc_get_all(f"/api/v2/tables/{NOCODB_TABLE_CLIENT_SERVICES}/records",
                          {"where": f"(organization_id,eq,{user['organization_id']})"})

    assigned = _assigned_ids(user)
    if assigned is not None:
        all_clients = nc_get_all(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                                 {"where": f"(organization_id,eq,{user['organization_id']})"})
        allowed_names = {c['name'] for c in all_clients if str(c.get('Id', '')) in assigned}
        services = [s for s in services if s.get('client_name') in allowed_names]

    return jsonify(services)

@app.route('/api/client-services', methods=['POST'])
def create_client_service():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_CLIENT_SERVICES:
        return jsonify({"error": "Client services table not configured"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    record_id = str(uuid.uuid4())
    result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_CLIENT_SERVICES}/records", {
        "id": record_id,
        "organization_id": user['organization_id'],
        "client_name":       data.get('client_name', ''),
        "service_category":  data.get('service_category', ''),
        "assignee":          data.get('assignee', ''),
        "spoc":              data.get('spoc', ''),
        "internal_due_date": data.get('internal_due_date'),
        "regulatory_due_date": data.get('regulatory_due_date'),
        "fees_status":          data.get('fees_status', ''),
        "status":               data.get('status', 'Pending'),
        "is_recurring":         data.get('is_recurring', False),
        "recurrence_frequency": data.get('recurrence_frequency', ''),
        "created_at":           datetime.now(timezone.utc).isoformat()
    })
    if result is None:
        return jsonify({"error": "Failed to create service record"}), 500
    nocodb_row_id = result.get('Id') or result.get('id', record_id)
    return jsonify({"Id": nocodb_row_id, "id": record_id, **data}), 201

@app.route('/api/client-services/<int:record_id>', methods=['PUT'])
def update_client_service(record_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_CLIENT_SERVICES:
        return jsonify({"error": "Client services table not configured"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_CLIENT_SERVICES}/records", {
        "Id": record_id,
        "client_name":         data.get('client_name'),
        "service_category":    data.get('service_category'),
        "assignee":            data.get('assignee'),
        "spoc":                data.get('spoc'),
        "internal_due_date":   data.get('internal_due_date'),
        "regulatory_due_date": data.get('regulatory_due_date'),
        "fees_status":          data.get('fees_status'),
        "status":               data.get('status'),
        "is_recurring":         data.get('is_recurring', False),
        "recurrence_frequency": data.get('recurrence_frequency', ''),
    })
    return jsonify({"Id": record_id, **data})

@app.route('/api/client-services/<int:record_id>', methods=['DELETE'])
def delete_client_service(record_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_CLIENT_SERVICES:
        return jsonify({"error": "Client services table not configured"}), 503

    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_CLIENT_SERVICES}/records", {"Id": record_id})
    return jsonify({"message": "Service deleted"})

# ── Team Management ───────────────────────────────────────────────────────────

def _require_admin(user):
    if user.get('role', 'admin') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    return None

@app.route('/api/team', methods=['GET'])
def get_team():
    try:
        user, error, code = get_token()
        if error:
            return error, code
        if user.get('role', 'admin') not in ('admin', 'manager'):
            return jsonify({"error": "Not authorized"}), 403

        result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records",
                        params={"where": f"(organization_id,eq,{user.get('organization_id','')})", "limit": 100})
        members = (result.get('list') or []) if result else []
        # Strip passwords before returning
        safe = [{k: v for k, v in m.items() if k != 'password'} for m in members if isinstance(m, dict)]
        return jsonify(safe)
    except Exception as e:
        print(f"get_team error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/team', methods=['POST'])
def add_team_member():
    try:
        user, error, code = get_token()
        if error:
            return error, code
        deny = _require_admin(user)
        if deny:
            return deny

        data = request.get_json(force=True) or {}
        if not data.get('email') or not data.get('name') or not data.get('password'):
            return jsonify({"error": "Name, email and password are required"}), 400

        existing = nc_get(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records",
                          params={"where": f"(email,eq,{data['email']})", "limit": 1})
        if existing and (existing.get('list') or []):
            return jsonify({"error": "A user with this email already exists"}), 409

        member_id = str(uuid.uuid4())
        payload = {
            "id":              member_id,
            "organization_id": user.get('organization_id', ''),
            "name":            data.get('name'),
            "email":           data.get('email'),
            "password":        hash_password(data.get('password')),
            "role":            data.get('role', 'consultant'),
            "created_at":      datetime.now(timezone.utc).isoformat()
        }
        r = requests.post(
            f"{NOCODB_URL}/api/v2/tables/{NOCODB_TABLE_USERS}/records",
            headers=get_headers(), json=payload, timeout=30
        )
        if r.status_code >= 400:
            return jsonify({"error": f"NocoDB rejected: {r.status_code} — {r.text}"}), 500
        result = r.json()
        return jsonify({
            "Id": result.get('Id'), "id": member_id,
            "name": data['name'], "email": data['email'],
            "role": data.get('role', 'consultant'), "assigned_clients": ""
        }), 201

    except Exception as e:
        print(f"add_team_member error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/team/<int:member_id>', methods=['PUT'])
def update_team_member(member_id):
    try:
        user, error, code = get_token()
        if error:
            return error, code
        deny = _require_admin(user)
        if deny:
            return deny

        data = request.get_json(force=True) or {}
        update = {"Id": member_id}
        if 'role' in data:             update['role']             = data['role']
        if 'assigned_clients' in data: update['assigned_clients'] = data['assigned_clients']
        if data.get('password'):       update['password']         = hash_password(data['password'])

        nc_patch(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records", update)
        return jsonify({"message": "Updated"})
    except Exception as e:
        print(f"update_team_member error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/team/<int:member_id>', methods=['DELETE'])
def remove_team_member(member_id):
    try:
        user, error, code = get_token()
        if error:
            return error, code
        deny = _require_admin(user)
        if deny:
            return deny

        nc_delete(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records", {"Id": member_id})
        return jsonify({"message": "Team member removed"})
    except Exception as e:
        print(f"remove_team_member error: {e}")
        return jsonify({"error": str(e)}), 500

# ── Reminders ─────────────────────────────────────────────────────────────────

@app.route('/api/reminders', methods=['GET'])
def get_reminders():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_REMINDERS:
        return jsonify([])   # graceful empty — no 503

    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_REMINDERS}/records",
                    params={"where": f"(organization_id,eq,{user['organization_id']})", "limit": 100})
    return jsonify(result.get('list', []) if result else [])

@app.route('/api/reminders', methods=['POST'])
def create_reminder():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_REMINDERS:
        return jsonify({"error": "Reminders table not configured. Add NOCODB_TABLE_REMINDERS to Vercel."}), 503

    data = request.get_json(force=True) or {}
    reminder_id = str(uuid.uuid4())
    result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_REMINDERS}/records", {
        "id":                reminder_id,
        "organization_id":   user['organization_id'],
        "days_before":       data.get('days_before', 7),
        "notification_time": data.get('notification_time', '09:00'),
        "is_active":         True,
        "created_at":        datetime.now(timezone.utc).isoformat()
    })
    if result is None:
        return jsonify({"error": "Failed to create reminder"}), 500
    return jsonify({"id": reminder_id, **data}), 201

@app.route('/api/reminders/<int:reminder_id>', methods=['DELETE'])
def delete_reminder(reminder_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_REMINDERS:
        return jsonify({"error": "Reminders table not configured"}), 503

    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_REMINDERS}/records", {"Id": reminder_id})
    return jsonify({"message": "Reminder deleted"})

@app.route('/api/reminders/<int:reminder_id>/toggle', methods=['PATCH'])
def toggle_reminder(reminder_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_REMINDERS:
        return jsonify({"error": "Reminders table not configured"}), 503

    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_REMINDERS}/records",
                    params={"where": f"(Id,eq,{reminder_id})", "limit": 1})
    rows = result.get('list', []) if result else []
    current = rows[0].get('is_active', True) if rows else True
    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_REMINDERS}/records",
             {"Id": reminder_id, "is_active": not current})
    return jsonify({"is_active": not current})

# ── Leads / Pipeline ──────────────────────────────────────────────────────────

@app.route('/api/leads', methods=['GET'])
def get_leads():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_LEADS:
        return jsonify([])   # graceful empty until table is configured

    records = nc_get_all(f"/api/v2/tables/{NOCODB_TABLE_LEADS}/records",
                         {"where": f"(organization_id,eq,{user.get('organization_id','')})", "sort": "-Id"})
    return jsonify(records)

@app.route('/api/leads', methods=['POST'])
def create_lead():
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_LEADS:
        return jsonify({"error": "Leads table not configured"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    lead_id = str(uuid.uuid4())
    result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_LEADS}/records", {
        "id":                   lead_id,
        "organization_id":      user['organization_id'],
        "name":                 data.get('name', ''),
        "business_name":        data.get('business_name', ''),
        "platform":             data.get('platform', ''),
        "status":               data.get('status', 'New Lead'),
        "last_followup_date":   data.get('last_followup_date'),
        "lead_generated_date":  data.get('lead_generated_date'),
        "lead_manager":         data.get('lead_manager', ''),
        "notes":                data.get('notes', ''),
        "created_at":           datetime.now(timezone.utc).isoformat()
    })
    if result is None:
        return jsonify({"error": "Failed to create lead"}), 500
    return jsonify({"Id": result.get('Id'), "id": lead_id, **data}), 201

@app.route('/api/leads/<int:lead_id>', methods=['PUT'])
def update_lead(lead_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_LEADS:
        return jsonify({"error": "Leads table not configured"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_LEADS}/records", {
        "Id":                  lead_id,
        "name":                data.get('name'),
        "business_name":       data.get('business_name'),
        "platform":            data.get('platform'),
        "status":              data.get('status'),
        "last_followup_date":  data.get('last_followup_date'),
        "lead_generated_date": data.get('lead_generated_date'),
        "lead_manager":        data.get('lead_manager'),
        "notes":               data.get('notes'),
    })
    return jsonify({"Id": lead_id, **data})

@app.route('/api/leads/<int:lead_id>', methods=['DELETE'])
def delete_lead(lead_id):
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_LEADS:
        return jsonify({"error": "Leads table not configured"}), 503

    nc_delete(f"/api/v2/tables/{NOCODB_TABLE_LEADS}/records", {"Id": lead_id})
    return jsonify({"message": "Lead deleted"})

# ── Timesheets ────────────────────────────────────────────────────────────────

@app.route('/api/timesheets', methods=['GET'])
def get_timesheets():
    try:
        user, error, code = get_token()
        if error:
            return error, code
        if not NOCODB_TABLE_TIMESHEETS:
            return jsonify([])
        org_id = user.get('organization_id', '')
        role   = user.get('role', 'admin')
        if role == 'consultant':
            where = f"(organization_id,eq,{org_id})~and(user_id,eq,{user.get('user_id','')})"
        else:
            where = f"(organization_id,eq,{org_id})"
        records = nc_get_all(f"/api/v2/tables/{NOCODB_TABLE_TIMESHEETS}/records",
                             {"where": where, "sort": "-Id"})
        return jsonify(records)
    except Exception as e:
        print(f"get_timesheets error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/timesheets', methods=['POST'])
def create_timesheet():
    try:
        user, error, code = get_token()
        if error:
            return error, code
        if not NOCODB_TABLE_TIMESHEETS:
            return jsonify({"error": "Timesheets table not configured"}), 503
        data = request.get_json(force=True) or {}
        if not data.get('client_name') or not data.get('minutes'):
            return jsonify({"error": "client_name and minutes are required"}), 400
        entry_id = str(uuid.uuid4())
        result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_TIMESHEETS}/records", {
            "id":               entry_id,
            "organization_id":  user.get('organization_id', ''),
            "user_id":          user.get('user_id', ''),
            "user_name":        data.get('user_name', ''),
            "client_name":      data.get('client_name', ''),
            "service_category": data.get('service_category', ''),
            "minutes":          str(data.get('minutes', 0)),
            "date":             data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d')),
            "notes":            data.get('notes', ''),
        })
        if result is None:
            return jsonify({"error": "Failed to save timesheet entry"}), 500
        return jsonify({"Id": result.get('Id'), "id": entry_id, **data}), 201
    except Exception as e:
        print(f"create_timesheet error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/timesheets/<int:entry_id>', methods=['DELETE'])
def delete_timesheet(entry_id):
    try:
        user, error, code = get_token()
        if error:
            return error, code
        if not NOCODB_TABLE_TIMESHEETS:
            return jsonify({"error": "Timesheets table not configured"}), 503
        nc_delete(f"/api/v2/tables/{NOCODB_TABLE_TIMESHEETS}/records", {"Id": entry_id})
        return jsonify({"message": "Deleted"})
    except Exception as e:
        print(f"delete_timesheet error: {e}")
        return jsonify({"error": str(e)}), 500

# ── Error Logger ──────────────────────────────────────────────────────────────

@app.route('/api/errors/log', methods=['POST'])
def log_error():
    """Public endpoint — no auth required so errors during login can be captured."""
    data = request.get_json(force=True) or {}
    if not NOCODB_TABLE_ERRORS:
        return jsonify({"error": "Error logger not configured"}), 503

    record = {
        "type":      data.get('type', 'frontend'),
        "component": data.get('component', ''),
        "message":   str(data.get('message', ''))[:2000],
        "stack":     str(data.get('stack', ''))[:5000],
        "url":       data.get('url', ''),
        "user_id":   data.get('user_id', ''),
        "resolved":  False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = nc_post(f"/api/v2/tables/{NOCODB_TABLE_ERRORS}/records", record)
    if result is None:
        return jsonify({"error": "Failed to save error log"}), 500

    nocodb_id = result.get('Id') or result.get('id', '?')
    return jsonify({"error_number": f"ERR-{nocodb_id}", "id": nocodb_id}), 201

@app.route('/api/errors', methods=['GET'])
def get_errors():
    """List all logged errors — requires auth."""
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_ERRORS:
        return jsonify([])

    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_ERRORS}/records",
                    params={"limit": 200, "sort": "-created_at"})
    return jsonify(result.get('list', []) if result else [])

@app.route('/api/errors/<int:error_id>', methods=['GET'])
def get_error(error_id):
    """Get a single error by its NocoDB row number — requires auth."""
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_ERRORS:
        return jsonify({"error": "Logger not configured"}), 503

    result = nc_get(f"/api/v2/tables/{NOCODB_TABLE_ERRORS}/records",
                    params={"where": f"(Id,eq,{error_id})", "limit": 1})
    rows = result.get('list', []) if result else []
    if not rows:
        return jsonify({"error": f"ERR-{error_id} not found"}), 404
    return jsonify(rows[0])

@app.route('/api/errors/<int:error_id>/resolve', methods=['PATCH'])
def resolve_error(error_id):
    """Mark an error as resolved."""
    user, error, code = get_token()
    if error:
        return error, code
    if not NOCODB_TABLE_ERRORS:
        return jsonify({"error": "Logger not configured"}), 503

    nc_patch(f"/api/v2/tables/{NOCODB_TABLE_ERRORS}/records",
             {"Id": error_id, "resolved": True})
    return jsonify({"message": f"ERR-{error_id} marked as resolved"})

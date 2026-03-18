from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import os
import logging
import httpx

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168

# NocoDB Configuration
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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: str = "My Organization"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None

class ServiceTypeCreate(BaseModel):
    name: str
    category: str = "custom"

class DueDateCreate(BaseModel):
    client_id: str
    service_type: str
    description: str
    due_date: str
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None

def create_jwt_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (ExpiredSignatureError, InvalidTokenError) as e:
        raise HTTPException(status_code=401, detail=str(e))

def get_headers():
    return {"xc-token": NOCODB_API_TOKEN, "Content-Type": "application/json"}

async def nc_get(endpoint: str, params: dict = None):
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{NOCODB_URL}{endpoint}", headers=get_headers(), params=params, timeout=30)
            if r.status_code >= 400:
                return None
            return r.json()
        except:
            return None

async def nc_post(endpoint: str, data: dict):
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
            if r.status_code >= 400:
                return None
            return r.json()
        except:
            return None

async def nc_patch(endpoint: str, data: dict):
    async with httpx.AsyncClient() as client:
        try:
            r = await client.patch(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
            if r.status_code >= 400:
                return None
            return r.json()
        except:
            return None

async def nc_delete(endpoint: str, data: dict):
    async with httpx.AsyncClient() as client:
        try:
            r = await client.delete(f"{NOCODB_URL}{endpoint}", headers=get_headers(), json=data, timeout=30)
            if r.status_code >= 400:
                return None
            return {"success": True}
        except:
            return None

@api_router.post("/auth/register")
async def register(data: UserRegister):
    org_id = str(uuid.uuid4())
    await nc_post(f"/api/v2/tables/{NOCODB_TABLE_ORGANIZATIONS}/records", {
        "id": org_id, "name": data.organization_name, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    user_id = str(uuid.uuid4())
    await nc_post(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records", {
        "id": user_id, "email": data.email, "name": data.name,
        "password": pwd_context.hash(data.password),
        "organization_id": org_id, "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    token = create_jwt_token({"user_id": user_id, "email": data.email, "organization_id": org_id})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user_id, "email": data.email, "name": data.name, "role": "admin"},
            "organization": {"id": org_id, "name": data.organization_name}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    result = await nc_get(f"/api/v2/tables/{NOCODB_TABLE_USERS}/records",
                          params={"where": f"(email,eq,{data.email})", "limit": 1})
    if not result or not result.get('list'):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = result['list'][0]
    if not pwd_context.verify(data.password, user.get('password', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token({"user_id": user['id'], "email": user['email'], "organization_id": user['organization_id']})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user.get('role', 'member')},
            "organization": {"id": user['organization_id'], "name": "My Organization"}}

@api_router.get("/dashboard/stats")
async def get_stats(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    org_id = user.get("organization_id")
    
    stats = {"total_clients": 0, "total_due_dates": 0, "upcoming_count": 0, "overdue_count": 0, "upcoming_due_dates": []}
    
    result = await nc_get(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                           params={"where": f"(organization_id,eq,{org_id})", "limit": 1000})
    if result:
        stats["total_clients"] = len(result.get('list', []))
    
    result = await nc_get(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records",
                           params={"where": f"(organization_id,eq,{org_id})", "limit": 1000})
    if result:
        due_dates = result.get('list', [])
        stats["total_due_dates"] = len(due_dates)
        now = datetime.now(timezone.utc)
        thirty_days = now + timedelta(days=30)
        for dd in due_dates:
            due_date = datetime.fromisoformat(dd['due_date'].replace('Z', '+00:00'))
            if due_date < now:
                stats["overdue_count"] += 1
            elif due_date <= thirty_days:
                stats["upcoming_count"] += 1
                stats["upcoming_due_dates"].append(dd)
    return stats

@api_router.get("/clients")
async def get_clients(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    result = await nc_get(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records",
                          params={"where": f"(organization_id,eq,{user['organization_id']})", "limit": 1000})
    return result.get('list', []) if result else []

@api_router.post("/clients")
async def create_client(data: ClientCreate, authorization: str = Header(None)):
    user = await get_current_user(authorization)
    client_id = str(uuid.uuid4())
    await nc_post(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "id": client_id, "organization_id": user['organization_id'],
        "name": data.name, "email": data.email, "phone": data.phone,
        "company": data.company, "notes": data.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"id": client_id, **data.model_dump()}

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, data: ClientCreate, authorization: str = Header(None)):
    await nc_patch(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {
        "Id": client_id, "name": data.name, "email": data.email,
        "phone": data.phone, "company": data.company, "notes": data.notes
    })
    return {"id": client_id, **data.model_dump()}

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, authorization: str = Header(None)):
    await nc_delete(f"/api/v2/tables/{NOCODB_TABLE_CLIENTS}/records", {"Id": client_id})
    return {"message": "Client deleted"}

@api_router.post("/clients/upload-excel")
async def upload_excel(authorization: str = Header(None)):
    return {"message": "Excel upload not implemented in serverless mode"}

@api_router.get("/service-types")
async def get_service_types(authorization: str = Header(None)):
    return DEFAULT_SERVICE_TYPES.copy()

@api_router.post("/service-types")
async def create_service_type(data: ServiceTypeCreate, authorization: str = Header(None)):
    return {"id": str(uuid.uuid4()), **data.model_dump()}

@api_router.get("/due-dates")
async def get_due_dates(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    result = await nc_get(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records",
                          params={"where": f"(organization_id,eq,{user['organization_id']})", "limit": 1000})
    return result.get('list', []) if result else []

@api_router.post("/due-dates")
async def create_due_date(data: DueDateCreate, authorization: str = Header(None)):
    user = await get_current_user(authorization)
    dd_id = str(uuid.uuid4())
    await nc_post(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {
        "id": dd_id, "organization_id": user['organization_id'],
        "client_id": data.client_id, "service_type": data.service_type,
        "description": data.description, "due_date": data.due_date,
        "is_recurring": data.is_recurring, "recurrence_frequency": data.recurrence_frequency,
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"id": dd_id, **data.model_dump()}

@api_router.put("/due-dates/{dd_id}")
async def update_due_date(dd_id: str, data: DueDateCreate, authorization: str = Header(None)):
    await nc_patch(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {
        "Id": dd_id, "client_id": data.client_id, "service_type": data.service_type,
        "description": data.description, "due_date": data.due_date,
        "is_recurring": data.is_recurring, "recurrence_frequency": data.recurrence_frequency
    })
    return {"id": dd_id, **data.model_dump()}

@api_router.delete("/due-dates/{dd_id}")
async def delete_due_date(dd_id: str, authorization: str = Header(None)):
    await nc_delete(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {"Id": dd_id})
    return {"message": "Due date deleted"}

@api_router.patch("/due-dates/{dd_id}/status")
async def update_status(dd_id: str, status: str = None, authorization: str = Header(None)):
    await nc_patch(f"/api/v2/tables/{NOCODB_TABLE_DUEDATES}/records", {"Id": dd_id, "status": status})
    return {"message": "Status updated"}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router)

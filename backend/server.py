from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days

# Email configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@taxflow.com')

# Scheduler
scheduler = AsyncIOScheduler()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: User

class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None

class Client(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DueDateCreate(BaseModel):
    client_id: str
    tax_type: str  # GST, Income Tax, TDS, etc.
    description: str
    due_date: datetime
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None  # monthly, quarterly, yearly

class DueDate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    tax_type: str
    description: str
    due_date: datetime
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None
    status: str = "pending"  # pending, completed, overdue
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReminderSettingCreate(BaseModel):
    days_before: int
    notification_time: str = "09:00"  # HH:MM format

class ReminderSetting(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    days_before: int
    notification_time: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    due_date_id: str
    recipient_email: str
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str  # sent, failed
    message: str

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def send_email_notification(to_email: str, subject: str, content: str):
    """Send email using SendGrid"""
    if not SENDGRID_API_KEY:
        logging.warning(f"SendGrid not configured. Email not sent to {to_email}")
        return False
    
    try:
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=content
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")
        return False

async def check_and_send_reminders():
    """Background task to check and send reminders"""
    try:
        # Get all active reminder settings
        reminder_settings = await db.reminder_settings.find({"is_active": True}, {"_id": 0}).to_list(1000)
        
        for setting in reminder_settings:
            # Calculate the target date based on days_before
            target_date = datetime.now(timezone.utc) + timedelta(days=setting['days_before'])
            target_date_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            target_date_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Find due dates that match
            due_dates = await db.due_dates.find({
                "user_id": setting['user_id'],
                "status": "pending",
                "due_date": {
                    "$gte": target_date_start.isoformat(),
                    "$lte": target_date_end.isoformat()
                }
            }, {"_id": 0}).to_list(1000)
            
            for due_date in due_dates:
                # Check if notification already sent
                existing_log = await db.notification_logs.find_one({
                    "due_date_id": due_date['id'],
                    "sent_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=1)}
                })
                
                if existing_log:
                    continue
                
                # Get client info
                client = await db.clients.find_one({"id": due_date['client_id']}, {"_id": 0})
                user = await db.users.find_one({"id": due_date['user_id']}, {"_id": 0})
                
                if client and user:
                    # Send to client
                    client_subject = f"Tax Reminder: {due_date['tax_type']} Due Soon"
                    client_content = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2 style="color: #064E3B;">Tax Compliance Reminder</h2>
                            <p>Dear {client['name']},</p>
                            <p>This is a reminder that your <strong>{due_date['tax_type']}</strong> compliance is due on <strong>{datetime.fromisoformat(due_date['due_date']).strftime('%B %d, %Y')}</strong>.</p>
                            <div style="background-color: #D1FAE5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin: 0; color: #064E3B;">Details:</h3>
                                <p style="margin: 10px 0;"><strong>Tax Type:</strong> {due_date['tax_type']}</p>
                                <p style="margin: 10px 0;"><strong>Description:</strong> {due_date['description']}</p>
                                <p style="margin: 10px 0;"><strong>Due Date:</strong> {datetime.fromisoformat(due_date['due_date']).strftime('%B %d, %Y')}</p>
                            </div>
                            <p>Please ensure timely compliance to avoid penalties.</p>
                            <p style="margin-top: 30px;">Best regards,<br>{user['name']}</p>
                        </body>
                    </html>
                    """
                    await send_email_notification(client['email'], client_subject, client_content)
                    
                    # Send to admin
                    admin_subject = f"Reminder Sent: {client['name']} - {due_date['tax_type']}"
                    admin_content = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2 style="color: #064E3B;">Reminder Notification</h2>
                            <p>A reminder has been sent to <strong>{client['name']}</strong> ({client['email']}) for:</p>
                            <p><strong>Tax Type:</strong> {due_date['tax_type']}<br>
                            <strong>Due Date:</strong> {datetime.fromisoformat(due_date['due_date']).strftime('%B %d, %Y')}</p>
                        </body>
                    </html>
                    """
                    await send_email_notification(user['email'], admin_subject, admin_content)
                    
                    # Log the notification
                    log = NotificationLog(
                        due_date_id=due_date['id'],
                        recipient_email=client['email'],
                        status="sent",
                        message=f"Reminder sent for {due_date['tax_type']}"
                    )
                    log_dict = log.model_dump()
                    log_dict['sent_at'] = log_dict['sent_at'].isoformat()
                    await db.notification_logs.insert_one(log_dict)
        
        logging.info("Reminder check completed")
    except Exception as e:
        logging.error(f"Error in reminder check: {str(e)}")

# API Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create default reminder settings
    default_reminders = [7, 3, 1]  # 7 days, 3 days, 1 day before
    for days in default_reminders:
        reminder = ReminderSetting(user_id=user.id, days_before=days, notification_time="09:00")
        reminder_dict = reminder.model_dump()
        reminder_dict['created_at'] = reminder_dict['created_at'].isoformat()
        await db.reminder_settings.insert_one(reminder_dict)
    
    # Create token
    access_token = create_access_token({"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    access_token = create_access_token({"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Clients
@api_router.post("/clients", response_model=Client)
async def create_client(client_data: ClientCreate, current_user: User = Depends(get_current_user)):
    client = Client(user_id=current_user.id, **client_data.model_dump())
    client_dict = client.model_dump()
    client_dict['created_at'] = client_dict['created_at'].isoformat()
    await db.clients.insert_one(client_dict)
    return client

@api_router.get("/clients", response_model=List[Client])
async def get_clients(current_user: User = Depends(get_current_user)):
    clients = await db.clients.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    for client in clients:
        if isinstance(client['created_at'], str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
    return clients

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, client_data: ClientCreate, current_user: User = Depends(get_current_user)):
    result = await db.clients.find_one_and_update(
        {"id": client_id, "user_id": current_user.id},
        {"$set": client_data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Client not found")
    result.pop('_id', None)
    if isinstance(result['created_at'], str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    return Client(**result)

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: User = Depends(get_current_user)):
    result = await db.clients.delete_one({"id": client_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    # Also delete associated due dates
    await db.due_dates.delete_many({"client_id": client_id})
    return {"message": "Client deleted successfully"}

# Due Dates
@api_router.post("/due-dates", response_model=DueDate)
async def create_due_date(due_date_data: DueDateCreate, current_user: User = Depends(get_current_user)):
    # Verify client belongs to user
    client = await db.clients.find_one({"id": due_date_data.client_id, "user_id": current_user.id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    due_date = DueDate(user_id=current_user.id, **due_date_data.model_dump())
    due_date_dict = due_date.model_dump()
    due_date_dict['created_at'] = due_date_dict['created_at'].isoformat()
    due_date_dict['due_date'] = due_date_dict['due_date'].isoformat()
    await db.due_dates.insert_one(due_date_dict)
    return due_date

@api_router.get("/due-dates", response_model=List[DueDate])
async def get_due_dates(current_user: User = Depends(get_current_user)):
    due_dates = await db.due_dates.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    for dd in due_dates:
        if isinstance(dd['created_at'], str):
            dd['created_at'] = datetime.fromisoformat(dd['created_at'])
        if isinstance(dd['due_date'], str):
            dd['due_date'] = datetime.fromisoformat(dd['due_date'])
    return due_dates

@api_router.put("/due-dates/{due_date_id}", response_model=DueDate)
async def update_due_date(due_date_id: str, due_date_data: DueDateCreate, current_user: User = Depends(get_current_user)):
    update_dict = due_date_data.model_dump()
    update_dict['due_date'] = update_dict['due_date'].isoformat()
    
    result = await db.due_dates.find_one_and_update(
        {"id": due_date_id, "user_id": current_user.id},
        {"$set": update_dict},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Due date not found")
    result.pop('_id', None)
    if isinstance(result['created_at'], str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    if isinstance(result['due_date'], str):
        result['due_date'] = datetime.fromisoformat(result['due_date'])
    return DueDate(**result)

@api_router.delete("/due-dates/{due_date_id}")
async def delete_due_date(due_date_id: str, current_user: User = Depends(get_current_user)):
    result = await db.due_dates.delete_one({"id": due_date_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Due date not found")
    return {"message": "Due date deleted successfully"}

@api_router.patch("/due-dates/{due_date_id}/status")
async def update_due_date_status(due_date_id: str, status: str, current_user: User = Depends(get_current_user)):
    result = await db.due_dates.find_one_and_update(
        {"id": due_date_id, "user_id": current_user.id},
        {"$set": {"status": status}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Due date not found")
    return {"message": "Status updated successfully"}

# Reminder Settings
@api_router.post("/reminders", response_model=ReminderSetting)
async def create_reminder(reminder_data: ReminderSettingCreate, current_user: User = Depends(get_current_user)):
    reminder = ReminderSetting(user_id=current_user.id, **reminder_data.model_dump())
    reminder_dict = reminder.model_dump()
    reminder_dict['created_at'] = reminder_dict['created_at'].isoformat()
    await db.reminder_settings.insert_one(reminder_dict)
    return reminder

@api_router.get("/reminders", response_model=List[ReminderSetting])
async def get_reminders(current_user: User = Depends(get_current_user)):
    reminders = await db.reminder_settings.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    for reminder in reminders:
        if isinstance(reminder['created_at'], str):
            reminder['created_at'] = datetime.fromisoformat(reminder['created_at'])
    return reminders

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    result = await db.reminder_settings.delete_one({"id": reminder_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@api_router.patch("/reminders/{reminder_id}/toggle")
async def toggle_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    reminder = await db.reminder_settings.find_one({"id": reminder_id, "user_id": current_user.id})
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    new_status = not reminder.get('is_active', True)
    await db.reminder_settings.update_one(
        {"id": reminder_id},
        {"$set": {"is_active": new_status}}
    )
    return {"message": "Reminder status updated", "is_active": new_status}

# Dashboard
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_clients = await db.clients.count_documents({"user_id": current_user.id})
    total_due_dates = await db.due_dates.count_documents({"user_id": current_user.id})
    
    # Upcoming due dates (next 30 days)
    now = datetime.now(timezone.utc)
    thirty_days_later = now + timedelta(days=30)
    
    upcoming = await db.due_dates.count_documents({
        "user_id": current_user.id,
        "status": "pending",
        "due_date": {
            "$gte": now.isoformat(),
            "$lte": thirty_days_later.isoformat()
        }
    })
    
    # Overdue
    overdue = await db.due_dates.count_documents({
        "user_id": current_user.id,
        "status": "pending",
        "due_date": {"$lt": now.isoformat()}
    })
    
    # Get upcoming due dates with client info
    upcoming_list = await db.due_dates.find({
        "user_id": current_user.id,
        "status": "pending",
        "due_date": {
            "$gte": now.isoformat(),
            "$lte": thirty_days_later.isoformat()
        }
    }, {"_id": 0}).sort("due_date", 1).limit(10).to_list(10)
    
    # Enrich with client info
    for dd in upcoming_list:
        client = await db.clients.find_one({"id": dd['client_id']}, {"_id": 0})
        dd['client'] = client
        if isinstance(dd['due_date'], str):
            dd['due_date'] = datetime.fromisoformat(dd['due_date'])
    
    return {
        "total_clients": total_clients,
        "total_due_dates": total_due_dates,
        "upcoming_count": upcoming,
        "overdue_count": overdue,
        "upcoming_due_dates": upcoming_list
    }

@api_router.get("/notifications/logs")
async def get_notification_logs(current_user: User = Depends(get_current_user)):
    # Get user's due dates
    user_due_dates = await db.due_dates.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    due_date_ids = [dd['id'] for dd in user_due_dates]
    
    logs = await db.notification_logs.find(
        {"due_date_id": {"$in": due_date_ids}},
        {"_id": 0}
    ).sort("sent_at", -1).limit(50).to_list(50)
    
    for log in logs:
        if isinstance(log.get('sent_at'), str):
            log['sent_at'] = datetime.fromisoformat(log['sent_at'])
    
    return logs

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Start the scheduler for reminder checks
    scheduler.add_job(
        check_and_send_reminders,
        CronTrigger(hour='*/1'),  # Run every hour
        id='reminder_check',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started for reminder checks")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()

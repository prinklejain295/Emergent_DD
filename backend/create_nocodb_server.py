# This script will generate the NocoDB-based server.py
output_lines = []

output_lines.append("""from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import resend
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from openpyxl import load_workbook
import io
from nocodb_client import nocodb_client as db

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days

# Email configuration  
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Scheduler
scheduler = AsyncIOScheduler()

app = FastAPI()
api_router = APIRouter(prefix="/api")
""")

# Write to file
with open('/app/backend/server.py', 'w') as f:
    f.write(''.join(output_lines))

print("Part 1 written successfully")

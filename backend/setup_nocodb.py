#!/usr/bin/env python3
"""
NocoDB Setup Script for DueDate Application
Creates all necessary tables with proper schema
"""
import requests
import json
import time

NOCODB_URL = "https://app.nocodb.com"
API_TOKEN = "XVUoJz9jrPipiKPzC6qKOXnF9YnKrEP0uzUk4WEV"
BASE_ID = "phs0jxrhjuuion2"

headers = {
    "xc-token": API_TOKEN,
    "Content-Type": "application/json"
}

def create_table(table_name, columns):
    """Create a table in NocoDB"""
    url = f"{NOCODB_URL}/api/v2/meta/bases/{BASE_ID}/tables"
    
    payload = {
        "table_name": table_name,
        "title": table_name,
        "columns": columns
    }
    
    print(f"\nCreating table: {table_name}")
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code in [200, 201]:
        print(f"✓ Table '{table_name}' created successfully")
        return response.json()
    else:
        print(f"✗ Failed to create table '{table_name}': {response.status_code}")
        print(f"Response: {response.text}")
        return None

def get_existing_tables():
    """Get list of existing tables"""
    url = f"{NOCODB_URL}/api/v2/meta/bases/{BASE_ID}/tables"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        tables = response.json()
        return {table['title']: table['id'] for table in tables.get('list', [])}
    return {}

# Define table schemas
tables_to_create = {
    "Organizations": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "name", "title": "name", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "Users": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "email", "title": "email", "uidt": "Email", "rqd": True},
        {"column_name": "name", "title": "name", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "password", "title": "password", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "organization_id", "title": "organization_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "role", "title": "role", "uidt": "SingleSelect", 
         "dtxp": "'admin','member'", "rqd": True},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "Clients": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "organization_id", "title": "organization_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "name", "title": "name", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "email", "title": "email", "uidt": "Email", "rqd": True},
        {"column_name": "phone", "title": "phone", "uidt": "SingleLineText"},
        {"column_name": "company", "title": "company", "uidt": "SingleLineText"},
        {"column_name": "notes", "title": "notes", "uidt": "LongText"},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "DueDates": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "organization_id", "title": "organization_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "client_id", "title": "client_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "service_type", "title": "service_type", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "description", "title": "description", "uidt": "LongText", "rqd": True},
        {"column_name": "due_date", "title": "due_date", "uidt": "DateTime", "rqd": True},
        {"column_name": "is_recurring", "title": "is_recurring", "uidt": "Checkbox"},
        {"column_name": "recurrence_frequency", "title": "recurrence_frequency", "uidt": "SingleSelect",
         "dtxp": "'monthly','quarterly','annually'"},
        {"column_name": "status", "title": "status", "uidt": "SingleSelect",
         "dtxp": "'pending','completed','overdue'", "rqd": True},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "ServiceTypes": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "organization_id", "title": "organization_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "name", "title": "name", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "category", "title": "category", "uidt": "SingleSelect",
         "dtxp": "'federal','state','payroll','custom','other'", "rqd": True},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "ReminderSettings": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "organization_id", "title": "organization_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "days_before", "title": "days_before", "uidt": "Number", "rqd": True},
        {"column_name": "notification_time", "title": "notification_time", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "is_active", "title": "is_active", "uidt": "Checkbox"},
        {"column_name": "created_at", "title": "created_at", "uidt": "DateTime"}
    ],
    
    "NotificationLogs": [
        {"column_name": "id", "title": "id", "uidt": "SingleLineText", "pk": True},
        {"column_name": "due_date_id", "title": "due_date_id", "uidt": "SingleLineText", "rqd": True},
        {"column_name": "recipient_email", "title": "recipient_email", "uidt": "Email", "rqd": True},
        {"column_name": "sent_at", "title": "sent_at", "uidt": "DateTime"},
        {"column_name": "status", "title": "status", "uidt": "SingleSelect",
         "dtxp": "'sent','failed'", "rqd": True},
        {"column_name": "message", "title": "message", "uidt": "LongText"}
    ]
}

def main():
    print("=" * 60)
    print("NocoDB Setup for DueDate Application")
    print("=" * 60)
    
    # Get existing tables
    print("\nChecking existing tables...")
    existing_tables = get_existing_tables()
    print(f"Found {len(existing_tables)} existing tables: {list(existing_tables.keys())}")
    
    # Create tables
    created_count = 0
    skipped_count = 0
    
    for table_name, columns in tables_to_create.items():
        if table_name in existing_tables:
            print(f"\n⊙ Table '{table_name}' already exists (ID: {existing_tables[table_name]})")
            skipped_count += 1
        else:
            result = create_table(table_name, columns)
            if result:
                created_count += 1
            time.sleep(1)  # Rate limiting
    
    print("\n" + "=" * 60)
    print(f"Setup Complete!")
    print(f"  Created: {created_count} tables")
    print(f"  Skipped: {skipped_count} tables (already exist)")
    print("=" * 60)
    
    # Get final table list
    print("\nFinal table list:")
    final_tables = get_existing_tables()
    for idx, (name, table_id) in enumerate(final_tables.items(), 1):
        print(f"  {idx}. {name} (ID: {table_id})")

if __name__ == "__main__":
    main()

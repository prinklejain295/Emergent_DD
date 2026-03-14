"""
NocoDB Client for DueDate Application
Provides async interface to NocoDB API
"""
import aiohttp
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class NocoDBClient:
    def __init__(self):
        self.base_url = os.environ.get('NOCODB_URL', 'https://app.nocodb.com')
        self.api_token = os.environ.get('NOCODB_API_TOKEN')
        self.base_id = os.environ.get('NOCODB_BASE_ID')
        
        self.tables = {
            'organizations': os.environ.get('NOCODB_TABLE_ORGANIZATIONS'),
            'users': os.environ.get('NOCODB_TABLE_USERS'),
            'clients': os.environ.get('NOCODB_TABLE_CLIENTS'),
            'due_dates': os.environ.get('NOCODB_TABLE_DUEDATES'),
            'service_types': os.environ.get('NOCODB_TABLE_SERVICETYPES'),
            'reminder_settings': os.environ.get('NOCODB_TABLE_REMINDERSETTINGS'),
            'notification_logs': os.environ.get('NOCODB_TABLE_NOTIFICATIONLOGS')
        }
        
        self.headers = {
            'xc-token': self.api_token,
            'Content-Type': 'application/json'
        }
    
    async def _request(self, method: str, url: str, **kwargs) -> Dict[str, Any]:
        """Make async HTTP request to NocoDB"""
        async with aiohttp.ClientSession(headers=self.headers) as session:
            async with session.request(method, url, **kwargs) as response:
                if response.status >= 400:
                    text = await response.text()
                    logger.error(f"NocoDB API error: {response.status} - {text}")
                    raise Exception(f"NocoDB API error: {response.status}")
                return await response.json()
    
    def _get_table_url(self, table_key: str) -> str:
        """Get full table URL"""
        table_id = self.tables.get(table_key)
        if not table_id:
            raise ValueError(f"Table '{table_key}' not configured")
        return f"{self.base_url}/api/v2/tables/{table_id}/records"
    
    def _prepare_record(self, data: Dict) -> Dict:
        """Prepare record for NocoDB (convert datetime to ISO string)"""
        prepared = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                prepared[key] = value.isoformat()
            elif value is not None:
                prepared[key] = value
        return prepared
    
    async def insert_one(self, table_key: str, data: Dict) -> Dict:
        """Insert a single record"""
        url = self._get_table_url(table_key)
        prepared_data = self._prepare_record(data)
        response = await self._request('POST', url, json=prepared_data)
        return response
    
    async def find_one(self, table_key: str, filters: Dict, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find one record matching filters"""
        records = await self.find(table_key, filters, limit=1)
        return records[0] if records else None
    
    async def find(self, table_key: str, filters: Optional[Dict] = None, 
                   limit: int = 25, offset: int = 0, sort: Optional[str] = None) -> List[Dict]:
        """Find multiple records"""
        url = self._get_table_url(table_key)
        
        params = {
            'limit': limit,
            'offset': offset
        }
        
        # Build where clause
        if filters:
            where_parts = []
            for key, value in filters.items():
                if isinstance(value, dict):
                    # Handle operators like $gte, $lte, $lt, $gt
                    for op, op_value in value.items():
                        if op == '$gte':
                            where_parts.append(f"({key},ge,{op_value})")
                        elif op == '$lte':
                            where_parts.append(f"({key},le,{op_value})")
                        elif op == '$lt':
                            where_parts.append(f"({key},lt,{op_value})")
                        elif op == '$gt':
                            where_parts.append(f"({key},gt,{op_value})")
                        elif op == '$in':
                            # IN operator
                            in_values = ','.join([str(v) for v in op_value])
                            where_parts.append(f"({key},in,{in_values})")
                else:
                    where_parts.append(f"({key},eq,{value})")
            
            if where_parts:
                params['where'] = '~and'.join(where_parts)
        
        if sort:
            params['sort'] = sort
        
        response = await self._request('GET', url, params=params)
        return response.get('list', [])
    
    async def find_one_and_update(self, table_key: str, filters: Dict, update: Dict, 
                                   return_document: bool = True) -> Optional[Dict]:
        """Find and update a record"""
        # First find the record
        record = await self.find_one(table_key, filters)
        if not record:
            return None
        
        # Update it
        record_id = record.get('Id') or record.get('id')
        if not record_id:
            return None
        
        await self.update_one(table_key, record_id, update.get('$set', update))
        
        if return_document:
            return await self.find_one(table_key, {'Id': record_id})
        return record
    
    async def update_one(self, table_key: str, record_id: Any, data: Dict) -> Dict:
        """Update a record by ID"""
        table_id = self.tables.get(table_key)
        url = f"{self.base_url}/api/v2/tables/{table_id}/records"
        
        prepared_data = self._prepare_record(data)
        prepared_data['Id'] = record_id
        
        response = await self._request('PATCH', url, json=prepared_data)
        return response
    
    async def delete_one(self, table_key: str, filters: Dict) -> Dict:
        """Delete one record"""
        record = await self.find_one(table_key, filters)
        if not record:
            return {'deleted_count': 0}
        
        record_id = record.get('Id') or record.get('id')
        table_id = self.tables.get(table_key)
        url = f\"{self.base_url}/api/v2/tables/{table_id}/records\"
        
        await self._request('DELETE', url, json={'Id': record_id})
        return {'deleted_count': 1}
    
    async def delete_many(self, table_key: str, filters: Dict) -> Dict:
        """Delete multiple records"""
        records = await self.find(table_key, filters, limit=1000)
        
        if not records:
            return {'deleted_count': 0}
        
        table_id = self.tables.get(table_key)
        url = f\"{self.base_url}/api/v2/tables/{table_id}/records\"
        
        count = 0
        for record in records:
            record_id = record.get('Id') or record.get('id')
            try:
                await self._request('DELETE', url, json={'Id': record_id})
                count += 1
            except Exception as e:
                logger.error(f"Failed to delete record {record_id}: {e}")
        
        return {'deleted_count': count}
    
    async def count_documents(self, table_key: str, filters: Optional[Dict] = None) -> int:
        """Count documents matching filters"""
        url = self._get_table_url(table_key)
        
        params = {'limit': 1, 'offset': 0}
        
        if filters:
            where_parts = []
            for key, value in filters.items():
                if isinstance(value, dict):
                    for op, op_value in value.items():
                        if op == '$gte':
                            where_parts.append(f\"({key},ge,{op_value})\")
                        elif op == '$lte':
                            where_parts.append(f\"({key},le,{op_value})\")
                        elif op == '$lt':
                            where_parts.append(f"({key},lt,{op_value})")
                else:
                    where_parts.append(f\"({key},eq,{value})\")
            
            if where_parts:
                params['where'] = '~and'.join(where_parts)
        
        response = await self._request('GET', url, params=params)
        return response.get('pageInfo', {}).get('totalRows', 0)

# Create singleton instance
nocodb_client = NocoDBClient()

import requests
import sys
import json
from datetime import datetime, timezone, timedelta

class TaxFlowAPITester:
    def __init__(self, base_url="https://client-tax-notify.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.client_id = None
        self.due_date_id = None
        self.reminder_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, response_data=None, error_msg=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            self.failed_tests.append({
                'test': test_name,
                'error': error_msg,
                'response': response_data
            })
            print(f"❌ {test_name} - FAILED: {error_msg}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            return success, response_data, response.status_code

        except Exception as e:
            return False, {"error": str(e)}, 0

    # Authentication Tests
    def test_api_root(self):
        """Test API root endpoint"""
        success, response, status = self.make_request('GET', '', expected_status=200)
        self.log_result("API Root", success, response, 
                       f"Status: {status}" if not success else None)
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@taxflow.com"
        data = {
            "email": test_email,
            "password": "Test123!",
            "name": "Test User"
        }
        
        success, response, status = self.make_request('POST', 'auth/register', data, 200)
        
        if success and 'access_token' in response and 'user' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log_result("User Registration", True)
            return True
        else:
            self.log_result("User Registration", False, response, f"Status: {status}")
            return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.token:
            return False
            
        # Get user email from token payload (we'll use the registered user)
        data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@taxflow.com",
            "password": "Test123!"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', data, 200)
        
        if success and 'access_token' in response:
            self.log_result("User Login", True)
            return True
        else:
            self.log_result("User Login", False, response, f"Status: {status}")
            return False

    def test_get_current_user(self):
        """Test get current user endpoint"""
        success, response, status = self.make_request('GET', 'auth/me', expected_status=200)
        
        if success and 'id' in response and 'email' in response:
            self.log_result("Get Current User", True)
            return True
        else:
            self.log_result("Get Current User", False, response, f"Status: {status}")
            return False

    # Client Management Tests
    def test_create_client(self):
        """Test client creation"""
        data = {
            "name": "ABC Corp",
            "email": "abc@corp.com",
            "phone": "1234567890",
            "company": "ABC Corporation",
            "notes": "Test client"
        }
        
        success, response, status = self.make_request('POST', 'clients', data, 200)
        
        if success and 'id' in response:
            self.client_id = response['id']
            self.log_result("Create Client", True)
            return True
        else:
            self.log_result("Create Client", False, response, f"Status: {status}")
            return False

    def test_get_clients(self):
        """Test get all clients"""
        success, response, status = self.make_request('GET', 'clients', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get All Clients", True)
            return True
        else:
            self.log_result("Get All Clients", False, response, f"Status: {status}")
            return False

    def test_update_client(self):
        """Test client update"""
        if not self.client_id:
            self.log_result("Update Client", False, None, "No client ID available")
            return False
            
        data = {
            "name": "ABC Corp Updated",
            "email": "abc@corp.com",
            "phone": "9876543210",
            "company": "ABC Corporation",
            "notes": "Updated notes"
        }
        
        success, response, status = self.make_request('PUT', f'clients/{self.client_id}', data, 200)
        
        if success and response.get('name') == 'ABC Corp Updated':
            self.log_result("Update Client", True)
            return True
        else:
            self.log_result("Update Client", False, response, f"Status: {status}")
            return False

    # Due Dates Management Tests
    def test_create_due_date(self):
        """Test due date creation"""
        if not self.client_id:
            self.log_result("Create Due Date", False, None, "No client ID available")
            return False
            
        future_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        data = {
            "client_id": self.client_id,
            "tax_type": "GST",
            "description": "Monthly GST filing",
            "due_date": future_date,
            "is_recurring": True,
            "recurrence_frequency": "monthly"
        }
        
        success, response, status = self.make_request('POST', 'due-dates', data, 200)
        
        if success and 'id' in response:
            self.due_date_id = response['id']
            self.log_result("Create Due Date", True)
            return True
        else:
            self.log_result("Create Due Date", False, response, f"Status: {status}")
            return False

    def test_get_due_dates(self):
        """Test get all due dates"""
        success, response, status = self.make_request('GET', 'due-dates', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get All Due Dates", True)
            return True
        else:
            self.log_result("Get All Due Dates", False, response, f"Status: {status}")
            return False

    def test_update_due_date_status(self):
        """Test due date status update"""
        if not self.due_date_id:
            self.log_result("Update Due Date Status", False, None, "No due date ID available")
            return False
            
        success, response, status = self.make_request('PATCH', f'due-dates/{self.due_date_id}/status?status=completed', expected_status=200)
        
        if success and 'message' in response:
            self.log_result("Update Due Date Status", True)
            return True
        else:
            self.log_result("Update Due Date Status", False, response, f"Status: {status}")
            return False

    # Reminder Settings Tests
    def test_create_reminder(self):
        """Test reminder creation"""
        data = {
            "days_before": 14,
            "notification_time": "10:00"
        }
        
        success, response, status = self.make_request('POST', 'reminders', data, 200)
        
        if success and 'id' in response:
            self.reminder_id = response['id']
            self.log_result("Create Reminder", True)
            return True
        else:
            self.log_result("Create Reminder", False, response, f"Status: {status}")
            return False

    def test_get_reminders(self):
        """Test get all reminders"""
        success, response, status = self.make_request('GET', 'reminders', expected_status=200)
        
        if success and isinstance(response, list) and len(response) >= 3:  # Should have default reminders
            self.log_result("Get All Reminders", True)
            return True
        else:
            self.log_result("Get All Reminders", False, response, f"Status: {status}")
            return False

    def test_toggle_reminder(self):
        """Test reminder toggle"""
        if not self.reminder_id:
            self.log_result("Toggle Reminder", False, None, "No reminder ID available")
            return False
            
        success, response, status = self.make_request('PATCH', f'reminders/{self.reminder_id}/toggle', expected_status=200)
        
        if success and 'is_active' in response:
            self.log_result("Toggle Reminder", True)
            return True
        else:
            self.log_result("Toggle Reminder", False, response, f"Status: {status}")
            return False

    # Dashboard Tests
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response, status = self.make_request('GET', 'dashboard/stats', expected_status=200)
        
        expected_keys = ['total_clients', 'total_due_dates', 'upcoming_count', 'overdue_count', 'upcoming_due_dates']
        if success and all(key in response for key in expected_keys):
            self.log_result("Dashboard Stats", True)
            return True
        else:
            self.log_result("Dashboard Stats", False, response, f"Status: {status}")
            return False

    # Cleanup Tests
    def test_delete_due_date(self):
        """Test due date deletion"""
        if not self.due_date_id:
            return True  # Skip if no due date to delete
            
        success, response, status = self.make_request('DELETE', f'due-dates/{self.due_date_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Due Date", True)
            return True
        else:
            self.log_result("Delete Due Date", False, response, f"Status: {status}")
            return False

    def test_delete_client(self):
        """Test client deletion"""
        if not self.client_id:
            return True  # Skip if no client to delete
            
        success, response, status = self.make_request('DELETE', f'clients/{self.client_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Client", True)
            return True
        else:
            self.log_result("Delete Client", False, response, f"Status: {status}")
            return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting TaxFlow Zen API Tests...")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test sequence
        tests = [
            self.test_api_root,
            self.test_user_registration,
            self.test_get_current_user,
            self.test_create_client,
            self.test_get_clients,
            self.test_update_client,
            self.test_create_due_date,
            self.test_get_due_dates,
            self.test_update_due_date_status,
            self.test_create_reminder,
            self.test_get_reminders,
            self.test_toggle_reminder,
            self.test_dashboard_stats,
            self.test_delete_due_date,
            self.test_delete_client
        ]

        for test in tests:
            test()
            print()

        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TaxFlowAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
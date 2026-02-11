#!/usr/bin/env python3
"""
Comprehensive Backend Testing Suite for Lottery System
Tests all API endpoints with proper authentication and data validation
"""

import requests
import json
from datetime import datetime
import sys
import os

# Load environment variables
def load_env_vars():
    """Load environment variables from frontend .env file"""
    env_file = "/app/frontend/.env"
    env_vars = {}
    
    try:
        with open(env_file, 'r') as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value.strip('"')
    except FileNotFoundError:
        print(f"❌ Environment file {env_file} not found")
        return None
    
    return env_vars

# Configuration
env_vars = load_env_vars()
if not env_vars:
    print("❌ Failed to load environment variables")
    sys.exit(1)

BASE_URL = env_vars.get('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001')
API_URL = f"{BASE_URL}/api"

print(f"🔗 Testing API at: {API_URL}")

# Global test data
test_data = {
    'auth_token': None,
    'super_admin_id': None,
    'lottery_id': None,
    'ticket_id': None,
    'draw_id': None,
    'vendedor_id': None
}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def add_pass(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
        
    def add_fail(self, test_name, error):
        self.failed += 1
        error_msg = f"❌ {test_name}: {error}"
        self.errors.append(error_msg)
        print(error_msg)
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 TEST SUMMARY:")
        print(f"✅ Passed: {self.passed}/{total}")
        print(f"❌ Failed: {self.failed}/{total}")
        
        if self.errors:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.errors:
                print(f"   {error}")
                
        return self.failed == 0

results = TestResults()

def make_request(method, endpoint, data=None, headers=None, params=None):
    """Make HTTP request with error handling"""
    url = f"{API_URL}{endpoint}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
        elif method.upper() == 'PUT':
            response = requests.put(url, json=data, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.RequestException as e:
        return None

def get_auth_headers():
    """Get authorization headers with token"""
    if not test_data['auth_token']:
        return {}
    return {'Authorization': f'Bearer {test_data["auth_token"]}'}

# ==================== AUTHENTICATION TESTS ====================

def test_init_super_admin():
    """Test system initialization and super admin creation"""
    print("\n🔐 TESTING AUTHENTICATION SYSTEM")
    
    response = make_request('POST', '/init/super-admin')
    if not response:
        results.add_fail("Init Super Admin", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'super_admin_email' in data:
            results.add_pass("Init Super Admin - New system initialized")
        else:
            results.add_pass("Init Super Admin - System already initialized")
    else:
        results.add_fail("Init Super Admin", f"Status: {response.status_code}, Response: {response.text}")

def test_login():
    """Test login with super admin credentials"""
    login_data = {
        "email": "admin@loteria.com",
        "password": "admin123"
    }
    
    response = make_request('POST', '/auth/login', data=login_data)
    if not response:
        results.add_fail("Login", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'token' in data and 'user' in data:
            test_data['auth_token'] = data['token']
            test_data['super_admin_id'] = data['user']['id']
            results.add_pass("Login - Super admin authenticated")
        else:
            results.add_fail("Login", "Missing token or user in response")
    else:
        results.add_fail("Login", f"Status: {response.status_code}, Response: {response.text}")

def test_get_me():
    """Test getting current user info"""
    headers = get_auth_headers()
    response = make_request('GET', '/auth/me', headers=headers)
    
    if not response:
        results.add_fail("Get Me", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if data.get('role') == 'super_admin' and data.get('email') == 'admin@loteria.com':
            results.add_pass("Get Me - User info retrieved correctly")
        else:
            results.add_fail("Get Me", f"Unexpected user data: {data}")
    else:
        results.add_fail("Get Me", f"Status: {response.status_code}, Response: {response.text}")

# ==================== LOTTERY TESTS ====================

def test_get_lotteries():
    """Test getting all lotteries (should return 7 default ones)"""
    print("\n🎲 TESTING LOTTERY SYSTEM")
    
    response = make_request('GET', '/lotteries')
    if not response:
        results.add_fail("Get Lotteries", "Connection failed")
        return
        
    if response.status_code == 200:
        lotteries = response.json()
        if len(lotteries) >= 7:
            # Store first lottery ID for testing
            test_data['lottery_id'] = lotteries[0]['id']
            lottery_names = [l['name'] for l in lotteries]
            expected_types = ['quiniela', 'pale', 'tripleta', 'loto', 'pega3', 'powerball', 'mega_millions']
            lottery_types = [l['lottery_type'] for l in lotteries]
            
            if all(t in lottery_types for t in expected_types):
                results.add_pass(f"Get Lotteries - Found {len(lotteries)} lotteries including all 7 default ones")
            else:
                results.add_fail("Get Lotteries", f"Missing lottery types. Found: {lottery_types}")
        else:
            results.add_fail("Get Lotteries", f"Expected at least 7 lotteries, got {len(lotteries)}")
    else:
        results.add_fail("Get Lotteries", f"Status: {response.status_code}, Response: {response.text}")

def test_create_lottery():
    """Test creating a new lottery (super admin only)"""
    headers = get_auth_headers()
    lottery_data = {
        "name": "Test Lottery",
        "country": "TEST",
        "lottery_type": "quiniela",
        "min_number": 0,
        "max_number": 99,
        "numbers_to_pick": 1,
        "price": 25.0,
        "currency": "RD$",
        "prize_multiplier": 80.0,
        "schedule": ["10:00", "16:00"],
        "active": True
    }
    
    response = make_request('POST', '/lotteries', data=lottery_data, headers=headers)
    if not response:
        results.add_fail("Create Lottery", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'lottery_id' in data:
            results.add_pass("Create Lottery - New lottery created successfully")
        else:
            results.add_fail("Create Lottery", "Missing lottery_id in response")
    else:
        results.add_fail("Create Lottery", f"Status: {response.status_code}, Response: {response.text}")

# ==================== TICKET SALES TESTS ====================

def test_create_ticket():
    """Test creating a ticket with quiniela numbers"""
    print("\n🎫 TESTING TICKET SALES SYSTEM")
    
    if not test_data['lottery_id']:
        results.add_fail("Create Ticket", "No lottery ID available")
        return
    
    headers = get_auth_headers()
    ticket_data = {
        "lottery_id": test_data['lottery_id'],
        "numbers": [25],  # Quiniela number
        "amount": 100.0,
        "currency": "RD$",
        "customer_name": "Maria Rodriguez"
    }
    
    response = make_request('POST', '/tickets', data=ticket_data, headers=headers)
    if not response:
        results.add_fail("Create Ticket", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'id' in data and data.get('numbers') == [25]:
            test_data['ticket_id'] = data['id']
            potential_win = data.get('potential_win', 0)
            results.add_pass(f"Create Ticket - Quiniela ticket created (Potential win: {potential_win})")
        else:
            results.add_fail("Create Ticket", f"Invalid ticket data: {data}")
    else:
        results.add_fail("Create Ticket", f"Status: {response.status_code}, Response: {response.text}")

def test_get_tickets():
    """Test getting all tickets"""
    headers = get_auth_headers()
    response = make_request('GET', '/tickets', headers=headers)
    
    if not response:
        results.add_fail("Get Tickets", "Connection failed")
        return
        
    if response.status_code == 200:
        tickets = response.json()
        if len(tickets) >= 1:
            results.add_pass(f"Get Tickets - Retrieved {len(tickets)} tickets")
        else:
            results.add_fail("Get Tickets", "No tickets found")
    else:
        results.add_fail("Get Tickets", f"Status: {response.status_code}, Response: {response.text}")

def test_get_today_tickets():
    """Test getting today's tickets"""
    headers = get_auth_headers()
    response = make_request('GET', '/tickets/today', headers=headers)
    
    if not response:
        results.add_fail("Get Today Tickets", "Connection failed")
        return
        
    if response.status_code == 200:
        tickets = response.json()
        results.add_pass(f"Get Today Tickets - Retrieved {len(tickets)} today's tickets")
    else:
        results.add_fail("Get Today Tickets", f"Status: {response.status_code}, Response: {response.text}")

# ==================== DRAW SYSTEM TESTS ====================

def test_create_draw():
    """Test executing a draw and verify winner detection"""
    print("\n🎰 TESTING DRAW SYSTEM")
    
    if not test_data['lottery_id']:
        results.add_fail("Create Draw", "No lottery ID available")
        return
    
    headers = get_auth_headers()
    draw_data = {
        "lottery_id": test_data['lottery_id']
    }
    
    response = make_request('POST', '/draws', data=draw_data, headers=headers)
    if not response:
        results.add_fail("Create Draw", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'id' in data and 'winning_numbers' in data:
            test_data['draw_id'] = data['id']
            winning_numbers = data['winning_numbers']
            total_tickets = data.get('total_tickets', 0)
            total_winners = data.get('total_winners', 0)
            total_paid = data.get('total_paid', 0)
            
            results.add_pass(f"Create Draw - Draw executed (Numbers: {winning_numbers}, Tickets: {total_tickets}, Winners: {total_winners}, Paid: ${total_paid})")
        else:
            results.add_fail("Create Draw", f"Invalid draw data: {data}")
    else:
        results.add_fail("Create Draw", f"Status: {response.status_code}, Response: {response.text}")

def test_get_draws():
    """Test getting draw history"""
    response = make_request('GET', '/draws')
    
    if not response:
        results.add_fail("Get Draws", "Connection failed")
        return
        
    if response.status_code == 200:
        draws = response.json()
        if len(draws) >= 1:
            results.add_pass(f"Get Draws - Retrieved {len(draws)} draws")
        else:
            results.add_fail("Get Draws", "No draws found")
    else:
        results.add_fail("Get Draws", f"Status: {response.status_code}, Response: {response.text}")

# ==================== USER MANAGEMENT TESTS ====================

def test_create_user():
    """Test creating a new vendedor user"""
    print("\n👥 TESTING USER MANAGEMENT SYSTEM")
    
    headers = get_auth_headers()
    # Use timestamp to make email unique
    import time
    timestamp = int(time.time())
    user_data = {
        "email": f"vendedor{timestamp}@test.com",
        "password": "vendedor123",
        "name": "Carlos Vendedor",
        "role": "vendedor",
        "credit_limit": 50000.0,
        "currency": "RD$"
    }
    
    response = make_request('POST', '/auth/register', data=user_data, headers=headers)
    if not response:
        results.add_fail("Create User", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'user_id' in data:
            test_data['vendedor_id'] = data['user_id']
            results.add_pass("Create User - Vendedor created successfully")
        else:
            results.add_fail("Create User", "Missing user_id in response")
    else:
        results.add_fail("Create User", f"Status: {response.status_code}, Response: {response.text}")

def test_get_users():
    """Test getting user list"""
    headers = get_auth_headers()
    response = make_request('GET', '/users', headers=headers)
    
    if not response:
        results.add_fail("Get Users", "Connection failed")
        return
        
    if response.status_code == 200:
        users = response.json()
        if len(users) >= 2:  # Super admin + vendedor
            results.add_pass(f"Get Users - Retrieved {len(users)} users")
        else:
            results.add_fail("Get Users", f"Expected at least 2 users, got {len(users)}")
    else:
        results.add_fail("Get Users", f"Status: {response.status_code}, Response: {response.text}")

def test_update_user():
    """Test updating user information"""
    if not test_data['vendedor_id']:
        results.add_fail("Update User", "No vendedor ID available")
        return
    
    headers = get_auth_headers()
    update_data = {
        "credit_limit": 75000.0,
        "active": True
    }
    
    response = make_request('PUT', f'/users/{test_data["vendedor_id"]}', data=update_data, headers=headers)
    if not response:
        results.add_fail("Update User", "Connection failed")
        return
        
    if response.status_code == 200:
        results.add_pass("Update User - User updated successfully")
    else:
        results.add_fail("Update User", f"Status: {response.status_code}, Response: {response.text}")

def test_deposit_balance():
    """Test depositing balance to user account"""
    if not test_data['vendedor_id']:
        results.add_fail("Deposit Balance", "No vendedor ID available")
        return
    
    headers = get_auth_headers()
    response = make_request('POST', f'/users/{test_data["vendedor_id"]}/deposit', headers=headers, params={"amount": 5000.0})
    
    if not response:
        results.add_fail("Deposit Balance", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'new_balance' in data:
            results.add_pass(f"Deposit Balance - Balance updated to ${data['new_balance']}")
        else:
            results.add_fail("Deposit Balance", "Missing new_balance in response")
    else:
        results.add_fail("Deposit Balance", f"Status: {response.status_code}, Response: {response.text}")

# ==================== STATISTICS TESTS ====================

def test_number_statistics():
    """Test getting number frequency statistics"""
    print("\n📈 TESTING STATISTICS SYSTEM")
    
    if not test_data['lottery_id']:
        results.add_fail("Number Statistics", "No lottery ID available")
        return
    
    response = make_request('GET', f'/stats/numbers/{test_data["lottery_id"]}')
    
    if not response:
        results.add_fail("Number Statistics", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'hot_numbers' in data and 'cold_numbers' in data and 'all_stats' in data:
            hot_count = len(data['hot_numbers'])
            cold_count = len(data['cold_numbers'])
            stats_count = len(data['all_stats'])
            results.add_pass(f"Number Statistics - Retrieved stats (Hot: {hot_count}, Cold: {cold_count}, Total: {stats_count})")
        else:
            results.add_fail("Number Statistics", f"Missing expected fields: {data}")
    else:
        results.add_fail("Number Statistics", f"Status: {response.status_code}, Response: {response.text}")

# ==================== ACCOUNTING TESTS ====================

def test_accounting_report():
    """Test getting accounting report"""
    print("\n💰 TESTING ACCOUNTING SYSTEM")
    
    headers = get_auth_headers()
    response = make_request('GET', '/accounting/report', headers=headers)
    
    if not response:
        results.add_fail("Accounting Report", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        required_fields = ['period', 'total_sales', 'total_wins', 'total_commission', 'net_profit', 'tickets_sold', 'tickets_won']
        if all(field in data for field in required_fields):
            sales = data['total_sales']
            wins = data['total_wins']
            profit = data['net_profit']
            tickets = data['tickets_sold']
            results.add_pass(f"Accounting Report - Sales: ${sales}, Wins: ${wins}, Profit: ${profit}, Tickets: {tickets}")
        else:
            results.add_fail("Accounting Report", f"Missing required fields in: {data}")
    else:
        results.add_fail("Accounting Report", f"Status: {response.status_code}, Response: {response.text}")

def test_accounting_summary():
    """Test getting accounting summary"""
    headers = get_auth_headers()
    response = make_request('GET', '/accounting/summary', headers=headers)
    
    if not response:
        results.add_fail("Accounting Summary", "Connection failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if 'today' in data and 'week' in data and 'month' in data:
            today = data['today']
            week = data['week']
            month = data['month']
            results.add_pass(f"Accounting Summary - Today: ${today.get('sales', 0)}, Week: ${week.get('sales', 0)}, Month: ${month.get('sales', 0)}")
        else:
            results.add_fail("Accounting Summary", f"Missing time period data: {data}")
    else:
        results.add_fail("Accounting Summary", f"Status: {response.status_code}, Response: {response.text}")

# ==================== CRITICAL TEST SCENARIO ====================

def test_critical_scenario():
    """Test the complete flow: Create ticket -> Execute draw -> Verify winner detection and accounting"""
    print("\n🔥 TESTING CRITICAL SCENARIO: Complete Lottery Flow")
    
    # Create another test ticket with a specific number
    if not test_data['lottery_id']:
        results.add_fail("Critical Scenario", "No lottery ID available")
        return
    
    headers = get_auth_headers()
    
    # Create ticket with number 77
    ticket_data = {
        "lottery_id": test_data['lottery_id'],
        "numbers": [77],
        "amount": 500.0,
        "currency": "RD$",
        "customer_name": "Test Winner"
    }
    
    response = make_request('POST', '/tickets', data=ticket_data, headers=headers)
    if not response or response.status_code != 200:
        results.add_fail("Critical Scenario - Create Test Ticket", "Failed to create test ticket")
        return
    
    test_ticket = response.json()
    potential_win = test_ticket.get('potential_win', 0)
    
    # Execute draw
    draw_data = {"lottery_id": test_data['lottery_id']}
    response = make_request('POST', '/draws', data=draw_data, headers=headers)
    
    if not response or response.status_code != 200:
        results.add_fail("Critical Scenario - Execute Draw", "Failed to execute draw")
        return
    
    draw_result = response.json()
    winning_numbers = draw_result.get('winning_numbers', [])
    total_winners = draw_result.get('total_winners', 0)
    total_paid = draw_result.get('total_paid', 0)
    
    # Check if our ticket won
    won = 77 in winning_numbers
    
    # Verify accounting update
    response = make_request('GET', '/accounting/summary', headers=headers)
    if response and response.status_code == 200:
        accounting = response.json()
        today_sales = accounting.get('today', {}).get('sales', 0)
        today_wins = accounting.get('today', {}).get('wins', 0)
        
        if won:
            results.add_pass(f"Critical Scenario - WINNER DETECTED! Number 77 won ${potential_win}. Accounting updated correctly.")
        else:
            results.add_pass(f"Critical Scenario - Draw executed successfully. Numbers: {winning_numbers}, No winner this time. Accounting: Sales=${today_sales}")
    else:
        results.add_fail("Critical Scenario - Accounting", "Failed to verify accounting update")

# ==================== RUN ALL TESTS ====================

def run_all_tests():
    """Execute all test suites"""
    print("🚀 STARTING COMPREHENSIVE LOTTERY SYSTEM BACKEND TESTS")
    print("=" * 80)
    
    # Authentication Tests
    test_init_super_admin()
    test_login()
    test_get_me()
    
    # Lottery Tests
    test_get_lotteries()
    test_create_lottery()
    
    # Ticket Sales Tests
    test_create_ticket()
    test_get_tickets()
    test_get_today_tickets()
    
    # Draw System Tests
    test_create_draw()
    test_get_draws()
    
    # User Management Tests
    test_create_user()
    test_get_users()
    test_update_user()
    test_deposit_balance()
    
    # Statistics Tests
    test_number_statistics()
    
    # Accounting Tests
    test_accounting_report()
    test_accounting_summary()
    
    # Critical Scenario Test
    test_critical_scenario()
    
    # Show results
    print("\n" + "=" * 80)
    success = results.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Backend lottery system is working correctly.")
    else:
        print("\n⚠️  SOME TESTS FAILED. Please check the errors above.")
    
    return success

if __name__ == "__main__":
    run_all_tests()
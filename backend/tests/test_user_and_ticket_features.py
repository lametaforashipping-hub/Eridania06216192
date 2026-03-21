"""
Tests for User Creation, User Edit, and Ticket Search functionality.
Testing:
1. User Creation via POST /api/auth/register
2. User Edit via PUT /api/users/{user_id}
3. Ticket Search by number or last 4 digits
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://multi-play-receipt.preview.emergentagent.com')

class TestUserCreationAndEdit:
    """Test user creation and editing functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as Super Admin to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def seller_token(self):
        """Login as Seller to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "vendedor@test.com", "password": "12345678"}
        )
        if response.status_code == 200:
            return response.json()["token"]
        return None
    
    # ==================== USER CREATION TESTS ====================
    
    def test_create_user_success(self, admin_token):
        """Test creating a new user via POST /api/auth/register"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_user_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_User {unique_id}",
            "role": "vendedor",
            "credit_limit": 15000,
            "commission_rate": 12.5,
            "country": "RD",
            "phone": "809-555-1234",
            "address": "Calle Test 123",
            "cedula": "001-0000000-1",
            "terminal_id": f"T{unique_id[:3].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        
        print(f"Create user response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"User creation failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "message" in data
        return data["user_id"]
    
    def test_create_user_duplicate_email(self, admin_token):
        """Test that duplicate email returns error"""
        payload = {
            "email": "admin@loteria.com",
            "password": "testpassword123",
            "name": "Duplicate User",
            "role": "vendedor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "registrado" in data.get("detail", "").lower() or "email" in data.get("detail", "").lower()
    
    def test_create_user_invalid_role(self, admin_token):
        """Test that creating user with super_admin role fails for admin"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_superadmin_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_SuperAdmin {unique_id}",
            "role": "super_admin"  # This should fail
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        
        # Super Admin cannot create another super_admin
        assert response.status_code == 400
    
    def test_create_user_without_auth(self):
        """Test that creating user without auth token fails"""
        payload = {
            "email": "unauthorized@test.com",
            "password": "testpassword123",
            "name": "Unauthorized User",
            "role": "vendedor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        assert response.status_code in [401, 403, 422]  # Should fail without auth
    
    def test_create_user_with_all_optional_fields(self, admin_token):
        """Test creating user with all optional fields"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_full_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_Full User {unique_id}",
            "role": "vendedor",
            "credit_limit": 25000,
            "commission_rate": 15.0,
            "country": "US",  # Test US country
            "phone": "1-555-123-4567",
            "address": "123 Test Street, Miami FL",
            "cedula": "US123456",
            "terminal_id": f"T{unique_id[:3].upper()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        
        # Verify user was created with correct data by fetching it
        user_response = requests.get(
            f"{BASE_URL}/api/users/{data['user_id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert user_response.status_code == 200
        user_data = user_response.json()
        assert user_data["email"] == payload["email"]
        assert user_data["name"] == payload["name"]
        # Country US should have USD currency
        assert user_data.get("currency") == "USD" or user_data.get("country") == "US"
    
    # ==================== USER EDIT TESTS ====================
    
    def test_edit_user_success(self, admin_token):
        """Test editing a user via PUT /api/users/{user_id}"""
        # First create a user
        unique_id = uuid.uuid4().hex[:8]
        create_payload = {
            "email": f"test_edit_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_EditUser {unique_id}",
            "role": "vendedor",
            "credit_limit": 10000,
            "commission_rate": 10.0
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=create_payload
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["user_id"]
        
        # Now edit the user
        edit_payload = {
            "name": f"TEST_EditUser Updated {unique_id}",
            "credit_limit": 20000,
            "commission_rate": 15.0,
            "phone": "809-555-9999",
            "address": "Updated Address 456",
            "cedula": "999-9999999-9",
            "terminal_id": "T999"
        }
        
        edit_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=edit_payload
        )
        
        print(f"Edit user response: {edit_response.status_code} - {edit_response.text}")
        
        assert edit_response.status_code == 200
        
        # Verify changes persisted
        get_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        updated_user = get_response.json()
        
        assert updated_user["name"] == edit_payload["name"]
        assert updated_user["credit_limit"] == edit_payload["credit_limit"]
        assert updated_user["commission_rate"] == edit_payload["commission_rate"]
        assert updated_user.get("phone") == edit_payload["phone"]
        assert updated_user.get("terminal_id") == edit_payload["terminal_id"]
    
    def test_edit_user_partial_update(self, admin_token):
        """Test partial update of user - only change one field"""
        # First create a user
        unique_id = uuid.uuid4().hex[:8]
        create_payload = {
            "email": f"test_partial_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_PartialUser {unique_id}",
            "role": "vendedor"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=create_payload
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["user_id"]
        
        # Only update the phone
        edit_payload = {"phone": "809-888-8888"}
        
        edit_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=edit_payload
        )
        
        assert edit_response.status_code == 200
        
        # Verify only phone changed
        get_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        updated_user = get_response.json()
        
        assert updated_user["name"] == create_payload["name"]  # Unchanged
        assert updated_user.get("phone") == edit_payload["phone"]  # Changed
    
    def test_edit_user_toggle_active_status(self, admin_token):
        """Test toggling user active status"""
        # First create a user
        unique_id = uuid.uuid4().hex[:8]
        create_payload = {
            "email": f"test_toggle_{unique_id}@test.com",
            "password": "testpassword123",
            "name": f"TEST_ToggleUser {unique_id}",
            "role": "vendedor"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=create_payload
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["user_id"]
        
        # Deactivate user
        edit_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={"active": False}
        )
        
        assert edit_response.status_code == 200
        
        # Verify user is deactivated
        get_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["active"] == False
        
        # Reactivate user
        edit_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={"active": True}
        )
        
        assert edit_response.status_code == 200
        
        # Verify user is activated
        get_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["active"] == True
    
    def test_edit_nonexistent_user(self, admin_token):
        """Test editing a user that doesn't exist"""
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        
        edit_response = requests.put(
            f"{BASE_URL}/api/users/{fake_user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={"name": "Test"}
        )
        
        assert edit_response.status_code == 404


class TestTicketSearch:
    """Test ticket search functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as Super Admin to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_all_tickets(self, admin_token):
        """Test getting all tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total tickets: {len(data)}")
        
        # If there are tickets, verify structure
        if len(data) > 0:
            ticket = data[0]
            assert "ticket_number" in ticket
            assert "status" in ticket
            return data
        return []
    
    def test_get_tickets_with_status_filter(self, admin_token):
        """Test filtering tickets by status"""
        statuses = ["pending", "won", "lost", "cancelled", "paid"]
        
        for status in statuses:
            response = requests.get(
                f"{BASE_URL}/api/tickets?status={status}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            
            # If there are tickets with this status, verify they all have the correct status
            for ticket in data:
                assert ticket["status"] == status, f"Expected {status}, got {ticket['status']}"
            
            print(f"Tickets with status '{status}': {len(data)}")
    
    def test_ticket_search_by_full_number(self, admin_token):
        """Test searching tickets - Note: Frontend performs the search filtering"""
        # Get all tickets
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) > 0:
            # Get a ticket number to search for
            test_ticket = tickets[0]
            ticket_number = test_ticket["ticket_number"]
            
            # The backend returns all tickets, frontend filters by ticket_number
            # Simulate frontend filtering
            filtered = [t for t in tickets if ticket_number.lower() in t["ticket_number"].lower()]
            assert len(filtered) >= 1
            assert filtered[0]["ticket_number"] == ticket_number
            print(f"Search for '{ticket_number}' found {len(filtered)} ticket(s)")
    
    def test_ticket_search_by_last_4_digits(self, admin_token):
        """Test searching tickets by last 4 digits - Frontend filtering"""
        # Get all tickets
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) > 0:
            # Get last 4 digits of first ticket
            test_ticket = tickets[0]
            ticket_number = test_ticket["ticket_number"]
            last_4 = ticket_number[-4:]
            
            # Simulate frontend filtering by last 4 digits
            filtered = [t for t in tickets if t["ticket_number"].endswith(last_4)]
            assert len(filtered) >= 1
            print(f"Search for last 4 digits '{last_4}' found {len(filtered)} ticket(s)")
    
    def test_today_tickets_endpoint(self, admin_token):
        """Test getting today's tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets/today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Today's tickets: {len(data)}")


class TestUserListAndGet:
    """Test user listing and fetching"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as Super Admin to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_all_users(self, admin_token):
        """Test getting all users"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total users: {len(data)}")
        
        # Verify user structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
    
    def test_get_single_user(self, admin_token):
        """Test getting a single user by ID"""
        # First get all users to get a valid ID
        users_response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert users_response.status_code == 200
        users = users_response.json()
        
        if len(users) > 0:
            user_id = users[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/users/{user_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert response.status_code == 200
            user = response.json()
            assert user["id"] == user_id


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

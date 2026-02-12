"""
Backend tests for Sistema de Lotería
Testing new features:
1. User creation with additional fields (phone, address, cedula, commission_rate)
2. Ticket verification endpoint (GET /api/tickets/verify/{ticket_number})
3. User listing with commission column
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lottery-admin-2.preview.emergentagent.com').rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_with_valid_credentials(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response missing token"
        assert "user" in data, "Response missing user"
        assert data["user"]["email"] == "admin@loteria.com"
        assert data["user"]["role"] == "super_admin"
        assert "commission_rate" in data["user"], "Missing commission_rate in user response"
        print(f"✅ Login successful, user role: {data['user']['role']}")
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")


class TestUserCreation:
    """Test user creation with new fields (phone, address, cedula, commission_rate)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_create_user_with_all_new_fields(self, auth_token):
        """Test creating user with phone, address, cedula, and commission_rate"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_user_{unique_id}@test.com"
        
        user_data = {
            "email": test_email,
            "password": "test123456",
            "name": f"Test User {unique_id}",
            "role": "vendedor",
            "credit_limit": 5000.0,
            "commission_rate": 15.0,  # Individual commission rate
            "currency": "RD$",
            "phone": "809-555-1234",
            "address": "Calle Test 123, Santo Domingo",
            "cedula": "001-0012345-6"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=user_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        data = response.json()
        assert "user_id" in data, "Missing user_id in response"
        print(f"✅ User created with ID: {data['user_id']}")
        
        # Verify user was created with correct fields by fetching it
        user_response = requests.get(
            f"{BASE_URL}/api/users/{data['user_id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert user_response.status_code == 200, "Failed to fetch created user"
        user = user_response.json()
        
        # Verify all new fields are persisted
        assert user["phone"] == "809-555-1234", f"Phone mismatch: {user.get('phone')}"
        assert user["address"] == "Calle Test 123, Santo Domingo", f"Address mismatch: {user.get('address')}"
        assert user["cedula"] == "001-0012345-6", f"Cedula mismatch: {user.get('cedula')}"
        assert user["commission_rate"] == 15.0, f"Commission rate mismatch: {user.get('commission_rate')}"
        print("✅ All new fields (phone, address, cedula, commission_rate) verified")
    
    def test_create_user_without_optional_fields(self, auth_token):
        """Test creating user without optional fields (phone, address, cedula)"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_minimal_{unique_id}@test.com"
        
        user_data = {
            "email": test_email,
            "password": "test123456",
            "name": f"Minimal User {unique_id}",
            "role": "vendedor",
            "commission_rate": 12.5
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=user_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create minimal user: {response.text}"
        data = response.json()
        print(f"✅ Minimal user created successfully with ID: {data['user_id']}")
    
    def test_create_admin_user(self, auth_token):
        """Test super_admin can create admin user"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_admin_{unique_id}@test.com"
        
        user_data = {
            "email": test_email,
            "password": "admin123456",
            "name": f"Admin User {unique_id}",
            "role": "admin",
            "credit_limit": 50000.0,
            "commission_rate": 8.0,
            "phone": "809-555-0001",
            "cedula": "002-0012345-7"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=user_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create admin user: {response.text}"
        print("✅ Admin user created successfully")


class TestUserListing:
    """Test user listing with commission column visible"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_get_users_list(self, auth_token):
        """Test fetching users list includes commission_rate"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        users = response.json()
        
        assert isinstance(users, list), "Expected list of users"
        print(f"✅ Retrieved {len(users)} users")
        
        # Check that users have commission_rate field
        for user in users:
            assert "commission_rate" in user or user.get("commission_rate") is not None or "commission_rate" in str(user), \
                f"User {user.get('name', 'unknown')} missing commission_rate"
        print("✅ All users have commission_rate field")


class TestTicketVerification:
    """Test ticket verification endpoint (GET /api/tickets/verify/{ticket_number})"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_verify_nonexistent_ticket(self):
        """Test verifying a ticket that doesn't exist (public endpoint, no auth needed)"""
        response = requests.get(f"{BASE_URL}/api/tickets/verify/TKT-NONEXISTENT-1234")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print("✅ Non-existent ticket correctly returns 404")
    
    def test_verify_existing_ticket(self, auth_token):
        """Test creating and verifying a ticket"""
        # First, get a lottery to create a ticket
        lotteries_response = requests.get(f"{BASE_URL}/api/lotteries")
        assert lotteries_response.status_code == 200, "Failed to get lotteries"
        
        lotteries = lotteries_response.json()
        if not lotteries:
            pytest.skip("No lotteries available for testing")
        
        # Find a quiniela lottery for simple testing
        lottery = next((l for l in lotteries if l.get("lottery_type") == "quiniela"), lotteries[0])
        print(f"Using lottery: {lottery['name']}")
        
        # Create a ticket
        ticket_data = {
            "lottery_id": lottery["id"],
            "numbers": [42],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_Customer"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if create_response.status_code != 200:
            # Lottery might be closed
            print(f"Ticket creation failed (lottery might be closed): {create_response.text}")
            # Try to get an existing ticket instead
            tickets_response = requests.get(
                f"{BASE_URL}/api/tickets",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            if tickets_response.status_code == 200 and tickets_response.json():
                ticket = tickets_response.json()[0]
                ticket_number = ticket.get("ticket_number")
            else:
                pytest.skip("No tickets available and cannot create new ones")
        else:
            ticket = create_response.json()
            ticket_number = ticket.get("ticket_number")
        
        print(f"Testing verification with ticket: {ticket_number}")
        
        # Now verify the ticket (PUBLIC endpoint - no auth needed)
        verify_response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        
        assert verify_response.status_code == 200, f"Verification failed: {verify_response.text}"
        verification = verify_response.json()
        
        # Check all expected fields in verification response
        assert "ticket_number" in verification, "Missing ticket_number"
        assert "status" in verification, "Missing status"
        assert "is_winner" in verification, "Missing is_winner"
        assert "is_paid" in verification, "Missing is_paid"
        assert "lottery_name" in verification, "Missing lottery_name"
        assert "amount" in verification, "Missing amount"
        assert "currency" in verification, "Missing currency"
        assert "message" in verification, "Missing message"
        
        print(f"✅ Ticket verified successfully:")
        print(f"   Status: {verification['status']}")
        print(f"   Is Winner: {verification['is_winner']}")
        print(f"   Message: {verification['message']}")
    
    def test_verify_ticket_no_auth_required(self):
        """Verify that ticket verification is public (no auth header needed)"""
        # This should return 404 for non-existent ticket, not 401 (unauthorized)
        response = requests.get(f"{BASE_URL}/api/tickets/verify/TKT-TEST-1234")
        
        # If it returns 401, the endpoint incorrectly requires auth
        assert response.status_code != 401, "Verification endpoint should be public (no auth required)"
        assert response.status_code == 404, f"Expected 404 for non-existent ticket, got {response.status_code}"
        print("✅ Ticket verification is correctly public (no auth required)")


class TestUserUpdate:
    """Test updating user fields including new ones"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_update_user_commission_rate(self, auth_token):
        """Test updating user's commission rate"""
        # First create a user
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_update_{unique_id}@test.com"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "test123456",
                "name": f"Update Test {unique_id}",
                "role": "vendedor",
                "commission_rate": 10.0
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert create_response.status_code == 200, f"Failed to create test user: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Now update the commission rate
        update_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            json={
                "commission_rate": 18.5,
                "phone": "809-999-8888"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert update_response.status_code == 200, f"Failed to update user: {update_response.text}"
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert get_response.status_code == 200
        updated_user = get_response.json()
        
        assert updated_user["commission_rate"] == 18.5, f"Commission rate not updated: {updated_user.get('commission_rate')}"
        assert updated_user["phone"] == "809-999-8888", f"Phone not updated: {updated_user.get('phone')}"
        print("✅ User commission_rate and phone updated successfully")


class TestHealthAndBasics:
    """Basic health and API tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health check passed")
    
    def test_get_lotteries_public(self):
        """Test getting lotteries list (usually public)"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        lotteries = response.json()
        assert isinstance(lotteries, list)
        print(f"✅ Retrieved {len(lotteries)} lotteries")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed users after all tests"""
    yield
    # Teardown: we could delete test users here if needed
    print("\n📋 Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

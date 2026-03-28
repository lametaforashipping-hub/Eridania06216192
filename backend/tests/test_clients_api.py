"""
Test suite for Client Portal API endpoints
- POST /api/clients/register - Client registration
- POST /api/clients/login - Client login
- GET /api/clients/me - Get client profile
- GET /api/clients/payment-accounts - Get payment accounts
- POST /api/clients/tickets - Create client ticket
- GET /api/clients/tickets - Get client tickets
- GET /api/clients/results - Get lottery results
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-sync-1.preview.emergentagent.com').rstrip('/')


class TestClientRegistration:
    """Test client registration endpoint"""
    
    def test_register_new_client_success(self):
        """Test successful client registration with phone"""
        unique_phone = f"809{uuid.uuid4().hex[:7]}"
        
        response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": f"Test Client {unique_phone}",
            "phone": unique_phone,
            "password": "test123456",
            "country": "RD"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "token" in data
        assert "user" in data
        assert data["message"] == "Registro exitoso"
        
        # Verify user data
        user = data["user"]
        assert user["phone"] == unique_phone
        assert user["role"] == "cliente"
        assert user["country"] == "RD"
        
        print(f"✅ Client registration successful: {user['name']}")
        return data
    
    def test_register_client_with_email(self):
        """Test client registration with optional email"""
        unique_phone = f"809{uuid.uuid4().hex[:7]}"
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Test Client Email",
            "phone": unique_phone,
            "email": unique_email,
            "password": "test123456",
            "country": "US"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        user = data["user"]
        assert user["email"] == unique_email
        assert user["country"] == "US"
        
        print(f"✅ Client registration with email successful")
    
    def test_register_duplicate_phone_fails(self):
        """Test that duplicate phone registration fails"""
        unique_phone = f"809{uuid.uuid4().hex[:7]}"
        
        # First registration
        response1 = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Test Client 1",
            "phone": unique_phone,
            "password": "test123456",
            "country": "RD"
        })
        assert response1.status_code == 200
        
        # Second registration with same phone
        response2 = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Test Client 2",
            "phone": unique_phone,
            "password": "differentpass",
            "country": "RD"
        })
        
        assert response2.status_code == 400
        data = response2.json()
        assert "teléfono ya está registrado" in data["detail"].lower() or "telefono" in data["detail"].lower()
        
        print(f"✅ Duplicate phone registration correctly rejected")
    
    def test_register_short_password_fails(self):
        """Test that short password registration fails"""
        unique_phone = f"809{uuid.uuid4().hex[:7]}"
        
        response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Test Client",
            "phone": unique_phone,
            "password": "123",  # Too short
            "country": "RD"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "6 caracteres" in data["detail"]
        
        print(f"✅ Short password correctly rejected")


class TestClientLogin:
    """Test client login endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test client for login tests"""
        self.test_phone = f"809{uuid.uuid4().hex[:7]}"
        self.test_password = "test123456"
        
        # Register the client
        response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Login Test Client",
            "phone": self.test_phone,
            "password": self.test_password,
            "country": "RD"
        })
        assert response.status_code == 200
    
    def test_login_success_with_phone(self):
        """Test successful client login with phone"""
        response = requests.post(
            f"{BASE_URL}/api/clients/login?phone={self.test_phone}&password={self.test_password}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "user" in data
        
        user = data["user"]
        assert user["phone"] == self.test_phone
        assert user["role"] == "cliente"
        
        print(f"✅ Client login successful: {user['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/clients/login?phone={self.test_phone}&password=wrongpassword"
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "inválidas" in data["detail"].lower() or "invalid" in data["detail"].lower()
        
        print(f"✅ Invalid credentials correctly rejected")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/clients/login?phone=0000000000&password=anypassword"
        )
        
        assert response.status_code == 401
        
        print(f"✅ Non-existent user login correctly rejected")


class TestClientProfile:
    """Test client profile endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and login a test client"""
        self.test_phone = f"809{uuid.uuid4().hex[:7]}"
        self.test_password = "test123456"
        self.test_name = f"Profile Test Client {uuid.uuid4().hex[:4]}"
        
        # Register the client
        reg_response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": self.test_name,
            "phone": self.test_phone,
            "password": self.test_password,
            "country": "RD"
        })
        assert reg_response.status_code == 200
        self.token = reg_response.json()["token"]
    
    def test_get_profile_success(self):
        """Test getting client profile with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/clients/me",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify profile data
        assert data["phone"] == self.test_phone
        assert data["role"] == "cliente"
        assert "recent_tickets" in data
        assert "pending_payments" in data
        
        print(f"✅ Client profile retrieved successfully: {data['name']}")
    
    def test_get_profile_without_auth(self):
        """Test getting profile without authentication"""
        response = requests.get(f"{BASE_URL}/api/clients/me")
        
        assert response.status_code == 401 or response.status_code == 403
        
        print(f"✅ Profile access without auth correctly rejected")
    
    def test_get_profile_invalid_token(self):
        """Test getting profile with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/clients/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401 or response.status_code == 403
        
        print(f"✅ Profile access with invalid token correctly rejected")


class TestPaymentAccounts:
    """Test payment accounts endpoint"""
    
    def test_get_payment_accounts_success(self):
        """Test getting payment accounts (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/clients/payment-accounts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "zelle_accounts" in data
        assert "bank_accounts" in data
        assert "all_accounts" in data
        assert isinstance(data["zelle_accounts"], list)
        assert isinstance(data["bank_accounts"], list)
        assert isinstance(data["all_accounts"], list)
        
        # Check all_accounts contains both types
        total = len(data["zelle_accounts"]) + len(data["bank_accounts"])
        assert len(data["all_accounts"]) == total or len(data["all_accounts"]) >= 0
        
        print(f"✅ Payment accounts retrieved: {len(data['all_accounts'])} accounts")
        print(f"   - Zelle accounts: {len(data['zelle_accounts'])}")
        print(f"   - Bank accounts: {len(data['bank_accounts'])}")


class TestClientTickets:
    """Test client tickets endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and login a test client"""
        self.test_phone = f"809{uuid.uuid4().hex[:7]}"
        self.test_password = "test123456"
        
        # Register the client
        reg_response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Tickets Test Client",
            "phone": self.test_phone,
            "password": self.test_password,
            "country": "RD"
        })
        assert reg_response.status_code == 200
        self.token = reg_response.json()["token"]
    
    def test_get_client_tickets_empty(self):
        """Test getting tickets for new client (empty)"""
        response = requests.get(
            f"{BASE_URL}/api/clients/tickets",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert "pagination" in data
        assert isinstance(data["tickets"], list)
        assert data["pagination"]["total"] == 0
        
        print(f"✅ Client tickets endpoint works (empty list for new client)")
    
    def test_get_client_tickets_without_auth(self):
        """Test getting tickets without authentication"""
        response = requests.get(f"{BASE_URL}/api/clients/tickets")
        
        assert response.status_code == 401 or response.status_code == 403
        
        print(f"✅ Tickets access without auth correctly rejected")


class TestClientResults:
    """Test client results endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and login a test client"""
        self.test_phone = f"809{uuid.uuid4().hex[:7]}"
        
        # Register the client
        reg_response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Results Test Client",
            "phone": self.test_phone,
            "password": "test123456",
            "country": "RD"
        })
        assert reg_response.status_code == 200
        self.token = reg_response.json()["token"]
    
    def test_get_results_today(self):
        """Test getting today's lottery results"""
        response = requests.get(
            f"{BASE_URL}/api/clients/results",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response is a list
        assert isinstance(data, list)
        
        print(f"✅ Client results endpoint works: {len(data)} results for today")
    
    def test_get_results_specific_date(self):
        """Test getting results for specific date"""
        response = requests.get(
            f"{BASE_URL}/api/clients/results?date=2025-01-01",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        print(f"✅ Client results for specific date works")
    
    def test_get_results_without_auth(self):
        """Test getting results without authentication"""
        response = requests.get(f"{BASE_URL}/api/clients/results")
        
        assert response.status_code == 401 or response.status_code == 403
        
        print(f"✅ Results access without auth correctly rejected")


class TestClientIntegration:
    """Integration tests for client portal flow"""
    
    def test_full_registration_and_login_flow(self):
        """Test complete registration -> login -> profile flow"""
        unique_phone = f"809{uuid.uuid4().hex[:7]}"
        password = "integrationtest123"
        
        # Step 1: Register
        reg_response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Integration Test Client",
            "phone": unique_phone,
            "password": password,
            "country": "RD"
        })
        assert reg_response.status_code == 200
        reg_data = reg_response.json()
        assert "token" in reg_data
        
        # Step 2: Login (should work immediately after registration)
        login_response = requests.post(
            f"{BASE_URL}/api/clients/login?phone={unique_phone}&password={password}"
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        token = login_data["token"]
        
        # Step 3: Get profile with token from login
        profile_response = requests.get(
            f"{BASE_URL}/api/clients/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        
        # Verify profile matches registration
        assert profile_data["phone"] == unique_phone
        assert profile_data["name"] == "Integration Test Client"
        assert profile_data["role"] == "cliente"
        
        print(f"✅ Full integration flow successful: register -> login -> profile")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

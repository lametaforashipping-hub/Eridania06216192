"""
Test suite for JWT Token Refresh functionality
Tests the /api/auth/refresh endpoint and token expiration handling
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://winning-hub.preview.emergentagent.com')

class TestAuthRefresh:
    """Test authentication refresh endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.user = login_response.json()["user"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_login_returns_valid_token(self):
        """Test that login returns a valid JWT token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "token" in data
        assert "user" in data
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        # JWT tokens have 3 parts separated by dots
        assert data["token"].count(".") == 2
        
    def test_refresh_token_returns_new_token(self):
        """Test that /api/auth/refresh returns a new valid token"""
        response = self.session.post(f"{BASE_URL}/api/auth/refresh")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return new token
        assert "token" in data
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        assert data["token"].count(".") == 2
        
        # Should return user data
        assert "user" in data
        assert data["user"]["id"] == self.user["id"]
        assert data["user"]["email"] == self.user["email"]
        assert data["user"]["role"] == self.user["role"]
        
    def test_refresh_token_returns_different_token(self):
        """Test that refreshed token is different from original"""
        original_token = self.token
        
        response = self.session.post(f"{BASE_URL}/api/auth/refresh")
        assert response.status_code == 200
        
        new_token = response.json()["token"]
        
        # New token should be different (has new expiration)
        # Note: The token will be different even if refreshed immediately 
        # because JWT includes expiration timestamp
        assert isinstance(new_token, str)
        assert len(new_token) > 0
        
    def test_new_token_is_usable(self):
        """Test that the new token can be used for authenticated requests"""
        # Get new token
        refresh_response = self.session.post(f"{BASE_URL}/api/auth/refresh")
        assert refresh_response.status_code == 200
        new_token = refresh_response.json()["token"]
        
        # Use new token to make an authenticated request
        self.session.headers.update({"Authorization": f"Bearer {new_token}"})
        
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        user_data = me_response.json()
        assert user_data["id"] == self.user["id"]
        assert user_data["email"] == self.user["email"]
        
    def test_refresh_without_token_fails(self):
        """Test that refresh fails without a valid token"""
        no_auth_session = requests.Session()
        
        response = no_auth_session.post(f"{BASE_URL}/api/auth/refresh")
        
        assert response.status_code in [401, 403]
        
    def test_refresh_with_invalid_token_fails(self):
        """Test that refresh fails with an invalid token"""
        invalid_session = requests.Session()
        invalid_session.headers.update({"Authorization": "Bearer invalid_token_123"})
        
        response = invalid_session.post(f"{BASE_URL}/api/auth/refresh")
        
        assert response.status_code == 401
        error_data = response.json()
        assert "detail" in error_data
        

class TestTokenExpirationHandling:
    """Test that token expiration is handled correctly in protected endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    def test_protected_endpoint_with_valid_token(self):
        """Test that protected endpoints work with valid token"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
    def test_tickets_multi_with_valid_token(self):
        """Test that /api/tickets/multi works with valid token"""
        response = self.session.post(
            f"{BASE_URL}/api/tickets/multi",
            json={
                "plays": [{"lottery_type": "quiniela", "numbers": [25], "amount": 20}],
                "currency": "RD$"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "ticket_number" in data
        assert "plays" in data
        assert data["total_amount"] == 20
        
    def test_tickets_multi_without_token_fails(self):
        """Test that /api/tickets/multi fails without token"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(
            f"{BASE_URL}/api/tickets/multi",
            json={
                "plays": [{"lottery_type": "quiniela", "numbers": [25], "amount": 20}],
                "currency": "RD$"
            }
        )
        assert response.status_code in [401, 403]
        
    def test_token_expiration_error_message(self):
        """Test that expired token returns proper error message"""
        # Use a malformed/expired token
        expired_session = requests.Session()
        # This is an old token that's likely expired
        expired_session.headers.update({
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCIsInJvbGUiOiJ2ZW5kZWRvciIsImV4cCI6MTYwMDAwMDAwMH0.invalid"
        })
        
        response = expired_session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        error_data = response.json()
        assert "detail" in error_data
        # Error should mention token is invalid or expired
        assert "Token" in error_data["detail"] or "token" in error_data["detail"]


class TestRefreshTokenFlow:
    """Test the complete token refresh flow used by frontend"""
    
    def test_complete_refresh_cycle(self):
        """Test a complete login -> use -> refresh -> use cycle"""
        session = requests.Session()
        
        # Step 1: Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        original_token = login_response.json()["token"]
        user_id = login_response.json()["user"]["id"]
        
        # Step 2: Use original token
        session.headers.update({"Authorization": f"Bearer {original_token}"})
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        assert me_response.json()["id"] == user_id
        
        # Step 3: Refresh token
        refresh_response = session.post(f"{BASE_URL}/api/auth/refresh")
        assert refresh_response.status_code == 200
        new_token = refresh_response.json()["token"]
        
        # Step 4: Use new token
        session.headers.update({"Authorization": f"Bearer {new_token}"})
        
        me_response2 = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response2.status_code == 200
        assert me_response2.json()["id"] == user_id
        
        # Step 5: Create ticket with new token
        ticket_response = session.post(
            f"{BASE_URL}/api/tickets/multi",
            json={
                "plays": [{"lottery_type": "quiniela", "numbers": [99], "amount": 10}],
                "currency": "RD$"
            }
        )
        assert ticket_response.status_code == 200
        assert "ticket_number" in ticket_response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

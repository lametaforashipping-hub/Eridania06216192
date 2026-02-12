"""
Test cases for Terminal Management feature
Tests:
- GET /api/terminals - List terminals
- GET /api/terminals/next-id - Get next available terminal ID
- POST /api/auth/register with terminal_id - Create user with terminal
- User with terminal_id appears in terminals list
"""

import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@loteria.com"
SUPER_ADMIN_PASSWORD = "admin123"


def get_auth_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_token():
    """Fixture to get auth token once per module"""
    return get_auth_token()


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Fixture for auth headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestTerminalsEndpoints:
    """Tests for GET /api/terminals and GET /api/terminals/next-id"""
    
    def test_get_terminals_endpoint_status(self, auth_headers):
        """Test GET /api/terminals returns 200"""
        response = requests.get(f"{BASE_URL}/api/terminals", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"GET /api/terminals returned {len(data)} terminals")
    
    def test_get_terminals_with_search(self, auth_headers):
        """Test GET /api/terminals with search parameter"""
        response = requests.get(f"{BASE_URL}/api/terminals?search=T00", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"Search for 'T00' returned {len(data)} terminals")
    
    def test_get_next_terminal_id(self, auth_headers):
        """Test GET /api/terminals/next-id returns next available ID"""
        response = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "next_terminal_id" in data, "Expected 'next_terminal_id' in response"
        # Verify format T###
        next_id = data["next_terminal_id"]
        assert next_id.startswith("T"), f"Expected terminal ID to start with 'T', got {next_id}"
        assert len(next_id) == 4, f"Expected terminal ID length 4 (T###), got {len(next_id)}"
        print(f"Next terminal ID: {next_id}")
    
    def test_terminals_requires_auth(self):
        """Test that terminals endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/terminals")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_next_terminal_id_requires_auth(self):
        """Test that next-id endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/terminals/next-id")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestUserWithTerminalId:
    """Tests for creating users with terminal_id"""
    
    def test_create_user_with_terminal_id(self, auth_headers):
        """Test creating a user with terminal_id field"""
        # First get the next terminal ID
        next_id_response = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        assert next_id_response.status_code == 200
        terminal_id = next_id_response.json()["next_terminal_id"]
        
        # Generate unique email
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        test_email = f"test_terminal_{random_suffix}@test.com"
        
        # Create user with terminal_id
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": f"Terminal Test User {terminal_id}",
            "role": "vendedor",
            "credit_limit": 5000,
            "commission_rate": 10,
            "country": "RD",
            "currency": "RD$",
            "terminal_id": terminal_id,
            "phone": "809-555-1234"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers=auth_headers,
            json=user_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data, "Expected 'user_id' in response"
        user_id = data["user_id"]
        print(f"Created user with terminal_id={terminal_id}, user_id={user_id}")
        
        # Verify user appears in terminals list
        terminals_response = requests.get(f"{BASE_URL}/api/terminals", headers=auth_headers)
        assert terminals_response.status_code == 200
        terminals = terminals_response.json()
        
        # Find the created terminal
        found_terminal = None
        for t in terminals:
            if t.get("terminal_id") == terminal_id:
                found_terminal = t
                break
        
        assert found_terminal is not None, f"Created terminal {terminal_id} not found in terminals list"
        assert found_terminal["email"] == test_email, "Email mismatch"
        assert found_terminal["terminal_id"] == terminal_id, "Terminal ID mismatch"
        print(f"Verified terminal {terminal_id} appears in terminals list")
    
    def test_create_user_without_terminal_id(self, auth_headers):
        """Test creating a user without terminal_id - should not appear in terminals"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        test_email = f"test_no_terminal_{random_suffix}@test.com"
        
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "User Without Terminal",
            "role": "vendedor",
            "credit_limit": 5000,
            "commission_rate": 10,
            "country": "RD"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers=auth_headers,
            json=user_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify user does NOT appear in terminals list
        terminals_response = requests.get(f"{BASE_URL}/api/terminals", headers=auth_headers)
        terminals = terminals_response.json()
        
        # Check user is not in terminals
        terminal_emails = [t.get("email") for t in terminals]
        assert test_email not in terminal_emails, "User without terminal_id should not appear in terminals list"
        print("User without terminal_id correctly excluded from terminals list")


class TestTerminalSearch:
    """Tests for terminal search functionality"""
    
    def test_search_by_terminal_id(self, auth_headers):
        """Test searching terminals by terminal_id"""
        # First create a terminal with known ID
        next_id_response = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        terminal_id = next_id_response.json()["next_terminal_id"]
        
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        test_email = f"test_search_{random_suffix}@test.com"
        
        # Create terminal
        requests.post(
            f"{BASE_URL}/api/auth/register",
            headers=auth_headers,
            json={
                "email": test_email,
                "password": "test123",
                "name": "Search Test Terminal",
                "role": "vendedor",
                "credit_limit": 5000,
                "commission_rate": 10,
                "country": "RD",
                "terminal_id": terminal_id
            }
        )
        
        # Search by terminal ID
        search_response = requests.get(
            f"{BASE_URL}/api/terminals?search={terminal_id}",
            headers=auth_headers
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        
        # Should find at least the created terminal
        found = any(t.get("terminal_id") == terminal_id for t in results)
        assert found, f"Terminal {terminal_id} not found in search results"
        print(f"Search by terminal_id '{terminal_id}' found {len(results)} result(s)")
    
    def test_search_by_name(self, auth_headers):
        """Test searching terminals by name"""
        # Create terminal with unique name
        next_id_response = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        terminal_id = next_id_response.json()["next_terminal_id"]
        
        unique_name = f"UniqueSearchName{random.randint(1000,9999)}"
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        
        requests.post(
            f"{BASE_URL}/api/auth/register",
            headers=auth_headers,
            json={
                "email": f"test_name_search_{random_suffix}@test.com",
                "password": "test123",
                "name": unique_name,
                "role": "vendedor",
                "credit_limit": 5000,
                "commission_rate": 10,
                "country": "RD",
                "terminal_id": terminal_id
            }
        )
        
        # Search by name
        search_response = requests.get(
            f"{BASE_URL}/api/terminals?search={unique_name}",
            headers=auth_headers
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        
        found = any(t.get("name") == unique_name for t in results)
        assert found, f"Terminal with name '{unique_name}' not found in search results"
        print(f"Search by name found terminal '{unique_name}'")
    
    def test_search_returns_empty_for_no_match(self, auth_headers):
        """Test search returns empty list for non-matching query"""
        search_response = requests.get(
            f"{BASE_URL}/api/terminals?search=ZZZNONEXISTENT999",
            headers=auth_headers
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        assert len(results) == 0, f"Expected empty results, got {len(results)}"
        print("Search for non-existent term correctly returns empty list")


class TestNextTerminalIdSequence:
    """Test next terminal ID generation is sequential"""
    
    def test_next_id_increments_after_creation(self, auth_headers):
        """Test that next terminal ID increments after creating a terminal"""
        # Get initial next ID
        response1 = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        next_id_1 = response1.json()["next_terminal_id"]
        
        # Create a terminal with this ID
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        requests.post(
            f"{BASE_URL}/api/auth/register",
            headers=auth_headers,
            json={
                "email": f"test_seq_{random_suffix}@test.com",
                "password": "test123",
                "name": "Sequence Test Terminal",
                "role": "vendedor",
                "credit_limit": 5000,
                "commission_rate": 10,
                "country": "RD",
                "terminal_id": next_id_1
            }
        )
        
        # Get next ID again
        response2 = requests.get(f"{BASE_URL}/api/terminals/next-id", headers=auth_headers)
        next_id_2 = response2.json()["next_terminal_id"]
        
        # Extract numbers
        num1 = int(next_id_1[1:])
        num2 = int(next_id_2[1:])
        
        assert num2 == num1 + 1, f"Expected next ID to be {num1+1}, got {num2}"
        print(f"Next ID correctly incremented from {next_id_1} to {next_id_2}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

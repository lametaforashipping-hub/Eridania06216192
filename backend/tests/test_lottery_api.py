"""
Lottery API Backend Tests
Tests for login, lotteries, tickets/multi and dashboard endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://lottery-mobile-app.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "admin@loteria.com"
SUPER_ADMIN_PASSWORD = "admin123"


@pytest.fixture
def auth_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["user"]["role"] == "super_admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_get_current_user(self, auth_token):
        """Test getting current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == SUPER_ADMIN_EMAIL


class TestLotteries:
    """Lottery endpoint tests"""
    
    def test_get_lotteries(self):
        """Test getting all lotteries (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check lottery structure
        lottery = data[0]
        assert "id" in lottery
        assert "name" in lottery
        assert "lottery_type" in lottery
        assert "currency" in lottery
        assert "is_open" in lottery
    
    def test_get_open_lotteries(self):
        """Test that at least some lotteries are open"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        
        open_lotteries = [l for l in data if l["is_open"]]
        print(f"Found {len(open_lotteries)} open lotteries")
        # We expect at least 1 open lottery for testing
        # (Quiniela 24H Limite Test and Test Alerta 80% should be open)
        assert len(open_lotteries) >= 1, "No open lotteries found for testing"
    
    def test_lottery_currency_format(self):
        """Test that currency is RD$ or USD (not 'RD')"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        
        for lottery in data:
            currency = lottery.get("currency", "")
            assert currency in ["RD$", "USD"], f"Invalid currency format: {currency}"


class TestMultiPlayTickets:
    """Multi-play ticket endpoint tests"""
    
    def test_create_multi_play_ticket_quiniela(self, auth_token):
        """Test creating a multi-play ticket with quiniela"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "plays": [
                    {"lottery_type": "quiniela", "numbers": [42], "amount": 20}
                ],
                "customer_name": "Test API Quiniela",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "ticket_number" in data
        assert data["ticket_number"].startswith("TKT-")
        assert data["plays_count"] == 1
        assert data["total_amount"] == 20
        assert data["currency"] == "RD$"
    
    def test_create_multi_play_ticket_pale(self, auth_token):
        """Test creating a multi-play ticket with pale (2 numbers)"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "plays": [
                    {"lottery_type": "pale", "numbers": [12, 45], "amount": 20}
                ],
                "customer_name": "Test API Pale",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["ticket_number"].startswith("TKT-")
        assert len(data["plays"][0]["numbers"]) == 2
    
    def test_create_multi_play_ticket_tripleta(self, auth_token):
        """Test creating a multi-play ticket with tripleta (3 numbers)"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "plays": [
                    {"lottery_type": "tripleta", "numbers": [10, 20, 30], "amount": 20}
                ],
                "customer_name": "Test API Tripleta",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["ticket_number"].startswith("TKT-")
        assert len(data["plays"][0]["numbers"]) == 3
    
    def test_create_multi_play_ticket_multiple_plays(self, auth_token):
        """Test creating a ticket with multiple plays (quiniela + pale + tripleta)"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "plays": [
                    {"lottery_type": "quiniela", "numbers": [25], "amount": 20},
                    {"lottery_type": "pale", "numbers": [12, 45], "amount": 20},
                    {"lottery_type": "tripleta", "numbers": [10, 20, 30], "amount": 20}
                ],
                "customer_name": "Test API Multi-Play",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["plays_count"] == 3
        assert data["total_amount"] == 60
        assert "commission_earned" in data


class TestDashboard:
    """Dashboard/Accounting endpoint tests"""
    
    def test_get_accounting_summary(self, auth_token):
        """Test getting accounting summary"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "today" in data
        assert "week" in data
        assert "month" in data
        assert "currency" in data
        
        # Check structure
        assert "sales" in data["today"]
        assert "wins" in data["today"]
        assert "profit" in data["today"]
        assert "tickets" in data["today"]


class TestTicketsRetrieval:
    """Ticket retrieval tests"""
    
    def test_get_today_tickets(self, auth_token):
        """Test getting today's tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

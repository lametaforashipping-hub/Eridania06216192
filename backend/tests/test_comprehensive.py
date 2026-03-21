"""
Comprehensive API Tests for Lottery System
Tests all major API endpoints for frontend integration
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://multi-play-receipt.preview.emergentagent.com')
if not BASE_URL.endswith('.com'):
    BASE_URL = 'https://multi-play-receipt.preview.emergentagent.com'

# Test credentials
SUPER_ADMIN_EMAIL = "admin@loteria.com"
SUPER_ADMIN_PASSWORD = "admin123"
VENDEDOR_EMAIL = "vendedor@test.com"
VENDEDOR_PASSWORD = "12345678"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_super_admin(self):
        """Test Super Admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"
        print(f"Super Admin login successful - role: {data['user']['role']}")
    
    def test_login_invalid_credentials(self):
        """Test invalid login credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint"""
        # First login
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        token = login_resp.json()["token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == SUPER_ADMIN_EMAIL
        print(f"Auth me endpoint working - user: {data['name']}")


class TestUsers:
    """Test user management endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_users_list(self, auth_token):
        """Test getting users list"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"Users list retrieved - {len(users)} users found")
    
    def test_create_user(self, auth_token):
        """Test creating a new user"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "email": f"TEST_user_{unique_id}@test.com",
                "password": "testpass123",
                "name": f"Test User {unique_id}",
                "role": "vendedor",
                "credit_limit": 5000,
                "commission_rate": 10,
                "country": "RD"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"User created successfully - ID: {data['user_id']}")


class TestLotteries:
    """Test lottery management endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_lotteries_list(self, auth_token):
        """Test getting lotteries list"""
        response = requests.get(
            f"{BASE_URL}/api/lotteries",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) > 0
        # Check lottery has required fields
        lottery = lotteries[0]
        assert "id" in lottery
        assert "name" in lottery
        assert "is_open" in lottery
        print(f"Lotteries retrieved - {len(lotteries)} lotteries found")
    
    def test_get_single_lottery(self, auth_token):
        """Test getting single lottery details"""
        # First get list
        list_resp = requests.get(
            f"{BASE_URL}/api/lotteries",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        lottery_id = list_resp.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/lotteries/{lottery_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == lottery_id
        print(f"Lottery details retrieved - {data['name']}")


class TestTickets:
    """Test ticket management endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_tickets_list(self, auth_token):
        """Test getting tickets list"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        assert isinstance(tickets, list)
        print(f"Tickets retrieved - {len(tickets)} tickets found")
    
    def test_get_tickets_with_filter(self, auth_token):
        """Test getting tickets with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?status=pending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        for ticket in tickets:
            assert ticket["status"] == "pending"
        print(f"Filtered tickets retrieved - {len(tickets)} pending tickets")
    
    def test_get_today_tickets(self, auth_token):
        """Test getting today's tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        assert isinstance(tickets, list)
        print(f"Today's tickets retrieved - {len(tickets)} tickets")
    
    def test_verify_ticket(self, auth_token):
        """Test ticket verification endpoint"""
        # Get a ticket number first
        list_resp = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if list_resp.json():
            ticket_number = list_resp.json()[0]["ticket_number"]
            
            response = requests.get(
                f"{BASE_URL}/api/tickets/verify/{ticket_number}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert "is_winner" in data
            print(f"Ticket verification working - status: {data['status']}")
        else:
            pytest.skip("No tickets available for verification")


class TestAccounting:
    """Test accounting and reports endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_accounting_report(self, auth_token):
        """Test accounting report endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_sales" in data
        assert "net_profit" in data
        print(f"Accounting report - Total Sales: {data['total_sales']}, Net Profit: {data['net_profit']}")
    
    def test_get_accounting_summary(self, auth_token):
        """Test accounting summary endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "today" in data
        assert "week" in data
        assert "month" in data
        print(f"Accounting summary - Today sales: {data['today']['sales']}")
    
    def test_get_sellers_report(self, auth_token):
        """Test sellers report endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Sellers report endpoint working")


class TestMonitoring:
    """Test monitoring endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_live_monitoring(self, auth_token):
        """Test live monitoring endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/live",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "global_stats" in data
        assert "users" in data
        print(f"Live monitoring - {len(data['users'])} users being monitored")
    
    def test_get_live_tickets(self, auth_token):
        """Test live tickets endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/live-tickets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert "stats" in data
        print(f"Live tickets - {len(data['tickets'])} recent tickets")


class TestFavorites:
    """Test favorites endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_favorites_list(self, auth_token):
        """Test getting favorites list"""
        response = requests.get(
            f"{BASE_URL}/api/favorites",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        favorites = response.json()
        assert isinstance(favorites, list)
        print(f"Favorites retrieved - {len(favorites)} favorites found")


class TestTerminals:
    """Test terminals endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_terminals_list(self, auth_token):
        """Test getting terminals list"""
        response = requests.get(
            f"{BASE_URL}/api/terminals",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        terminals = response.json()
        assert isinstance(terminals, list)
        print(f"Terminals retrieved - {len(terminals)} terminals found")
    
    def test_get_next_terminal_id(self, auth_token):
        """Test getting next terminal ID"""
        response = requests.get(
            f"{BASE_URL}/api/terminals/next-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "next_terminal_id" in data
        print(f"Next terminal ID: {data['next_terminal_id']}")


class TestDraws:
    """Test draws/sorteos endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_draws_list(self, auth_token):
        """Test getting draws list"""
        response = requests.get(
            f"{BASE_URL}/api/draws",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        draws = response.json()
        assert isinstance(draws, list)
        print(f"Draws retrieved - {len(draws)} draws found")


class TestNotifications:
    """Test notifications endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_notifications_list(self, auth_token):
        """Test getting notifications list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"Notifications retrieved - {len(notifications)} notifications found")
    
    def test_get_unread_count(self, auth_token):
        """Test getting unread notifications count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        print(f"Unread notifications: {data['unread_count']}")


class TestAdminConfig:
    """Test admin configuration endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_system_config(self, auth_token):
        """Test getting system configuration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/config",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "high_risk_threshold_rd" in data
        assert "auto_refresh_interval" in data
        print(f"System config retrieved - High risk threshold: {data['high_risk_threshold_rd']}")


class TestHealthCheck:
    """Test health and basic endpoints"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("API health check passed")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("API root endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

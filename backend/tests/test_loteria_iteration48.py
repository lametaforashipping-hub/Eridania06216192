"""
Loteria Management Web App - Iteration 48 Tests
Testing the mobile-app-like redesigned web interface
Focus: Login, Dashboard with grid menu, navigation with back buttons, all main pages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://multi-play-receipt.preview.emergentagent.com"


class TestAuthenticationAPI:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        assert data["user"]["email"] == "admin@loteria.com"
    
    def test_seller_login_success(self):
        """Test seller login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "vendedor"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_get_current_user(self):
        """Test GET /api/auth/me returns current user"""
        # First login to get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        token = login_res.json()["token"]
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@loteria.com"


class TestDashboardAPI:
    """Dashboard and accounting summary tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_accounting_summary(self, admin_token):
        """Test GET /api/accounting/summary returns stats for dashboard"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Dashboard shows today, week, month stats
        assert "today" in data, "Should have today stats"
        assert "week" in data, "Should have week stats"
        assert "month" in data, "Should have month stats"
    
    def test_accounting_summary_with_country_filter(self, admin_token):
        """Test country filter for super admin"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary?country=RD", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
    
    def test_notifications_unread_count(self, admin_token):
        """Test GET /api/notifications/unread-count for bell badge"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data


class TestUsersAPI:
    """Users management API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_users_list(self, admin_token):
        """Test GET /api/users returns user list"""
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        # Can be list or object with users key
        users = data.get("users") if isinstance(data, dict) else data
        assert isinstance(users, list), "Should return a list of users"
        assert len(users) > 0, "Should have at least one user"


class TestLotteriesAPI:
    """Lotteries management API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_lotteries_list(self, admin_token):
        """Test GET /api/lotteries returns lottery list"""
        response = requests.get(f"{BASE_URL}/api/lotteries?active_only=false", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        lotteries = data.get("lotteries") if isinstance(data, dict) else data
        assert isinstance(lotteries, list)
        assert len(lotteries) > 0, "Should have lotteries configured"


class TestTicketsAPI:
    """Tickets management API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_tickets_list(self, admin_token):
        """Test GET /api/tickets returns ticket list"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets") if isinstance(data, dict) else data
        assert isinstance(tickets, list)


class TestResultsAPI:
    """Lottery results API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_latest_results(self, admin_token):
        """Test GET /api/lottery-results/latest returns results (may take time due to scraping)"""
        response = requests.get(f"{BASE_URL}/api/lottery-results/latest", headers={
            "Authorization": f"Bearer {admin_token}"
        }, timeout=30)  # Extended timeout for external scraping
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        results = data.get("results") if isinstance(data, dict) else data
        assert isinstance(results, list)


class TestStatisticsAPI:
    """Statistics/Admin stats API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_dashboard_stats_today(self, admin_token):
        """Test GET /api/admin/stats/dashboard with today period"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/dashboard?period=today", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data, "Should have summary stats"
    
    def test_get_dashboard_stats_week(self, admin_token):
        """Test GET /api/admin/stats/dashboard with week period"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/dashboard?period=week", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
    
    def test_get_dashboard_stats_month(self, admin_token):
        """Test GET /api/admin/stats/dashboard with month period"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/dashboard?period=month", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200


class TestHealthCheck:
    """Health check endpoint test"""
    
    def test_health_endpoint(self):
        """Test /api/company-profile endpoint (health check requires internal access)"""
        # Using company profile endpoint since /health is internal-only
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200, "API should be accessible"

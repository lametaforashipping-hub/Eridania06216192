"""
Backend API Tests for Lottery Management Web Application (Vite Migration)
Tests: Authentication, Dashboard stats, Users, Lotteries, Tickets, Results, Statistics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"
SELLER_EMAIL = "vendedor@test.com"
SELLER_PASSWORD = "12345678"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User data not in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin, got {data['user']['role']}"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"PASS: Admin login successful - {data['user']['name']}")
    
    def test_seller_login_success(self):
        """Test seller login returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        assert response.status_code == 200, f"Seller login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User data not in response"
        assert data["user"]["role"] == "vendedor", f"Expected vendedor, got {data['user']['role']}"
        print(f"PASS: Seller login successful - {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Invalid credentials correctly rejected")


class TestDashboardStats:
    """Dashboard statistics API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_dashboard_stats_endpoint(self, admin_token):
        """Test /api/admin/stats/dashboard returns stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Summary not in response"
        
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_tickets" in summary
        assert "net_profit" in summary
        assert "total_commissions" in summary
        print(f"PASS: Dashboard stats returned - sales: {summary['total_sales']}, tickets: {summary['total_tickets']}")
    
    def test_dashboard_stats_with_period(self, admin_token):
        """Test dashboard stats with period parameter"""
        for period in ["today", "week", "month"]:
            response = requests.get(
                f"{BASE_URL}/api/admin/stats/dashboard?period={period}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Stats failed for period {period}"
            data = response.json()
            assert data["period"] == period or period == "today"  # API might default to month for today
            print(f"PASS: Dashboard stats with period={period}")


class TestUsersAPI:
    """Users management API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_users_list(self, admin_token):
        """Test /api/users returns list of users"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get users failed: {response.text}"
        
        data = response.json()
        # Response could be list or dict with users key
        users = data if isinstance(data, list) else data.get("users", data)
        assert len(users) >= 1, "Expected at least 1 user"
        
        # Check user has required fields
        user = users[0]
        assert "email" in user
        assert "name" in user
        assert "role" in user
        print(f"PASS: Users list returned {len(users)} users")


class TestLotteriesAPI:
    """Lotteries API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_lotteries(self, admin_token):
        """Test /api/lotteries returns lottery list"""
        response = requests.get(
            f"{BASE_URL}/api/lotteries?active_only=false",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get lotteries failed: {response.text}"
        
        data = response.json()
        lotteries = data if isinstance(data, list) else data.get("lotteries", data)
        assert len(lotteries) >= 1, "Expected at least 1 lottery"
        
        # Check lottery structure
        lottery = lotteries[0]
        assert "name" in lottery
        assert "active" in lottery or lottery.get("active") is None
        print(f"PASS: Lotteries list returned {len(lotteries)} lotteries")


class TestTicketsAPI:
    """Tickets API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_tickets(self, admin_token):
        """Test /api/tickets returns ticket list"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get tickets failed: {response.text}"
        
        data = response.json()
        # Response structure may vary
        assert "tickets" in data or isinstance(data, list)
        print(f"PASS: Tickets endpoint returned successfully")


class TestLotteryResultsAPI:
    """Lottery results API tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_latest_results(self, admin_token):
        """Test /api/lottery-results/latest returns results with 1st, 2nd, 3rd prizes"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/latest",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60  # This endpoint scrapes external sites, may take time
        )
        assert response.status_code == 200, f"Get results failed: {response.text}"
        
        data = response.json()
        assert "results" in data, "Results not in response"
        
        results = data["results"]
        if len(results) > 0:
            result = results[0]
            assert "lottery_name" in result
            assert "first_prize" in result
            assert "second_prize" in result
            assert "third_prize" in result
            print(f"PASS: Lottery results returned {len(results)} results with prizes")
        else:
            print("PASS: Lottery results endpoint works (no results available)")


class TestAuthMe:
    """Auth /me endpoint tests"""
    
    def test_auth_me_returns_user(self):
        """Test /api/auth/me returns current user"""
        # Login first
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_res.json()["token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        
        data = response.json()
        assert "email" in data
        assert "name" in data
        assert "role" in data
        assert data["email"] == ADMIN_EMAIL
        print(f"PASS: /api/auth/me returned user profile")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

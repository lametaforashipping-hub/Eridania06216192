"""
Tests for modular backend routes
Tests the refactored route modules to ensure they work correctly
"""
import pytest
import httpx
import os

API_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://loteria-vite-build.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"
SELLER_EMAIL = "vendedor@test.com"
SELLER_PASSWORD = "12345678"


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = httpx.post(
        f"{API_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    return response.json()["token"]


@pytest.fixture
def seller_token():
    """Get seller authentication token"""
    response = httpx.post(
        f"{API_URL}/api/auth/login",
        json={"email": SELLER_EMAIL, "password": SELLER_PASSWORD}
    )
    assert response.status_code == 200
    return response.json()["token"]


class TestAuthRoutes:
    """Tests for routes/auth.py"""
    
    def test_login_success(self):
        """Test successful login"""
        response = httpx.post(
            f"{API_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = httpx.post(
            f"{API_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
    
    def test_get_me(self, admin_token):
        """Test GET /api/auth/me endpoint"""
        response = httpx.get(
            f"{API_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "role" in data
    
    def test_refresh_token(self, admin_token):
        """Test token refresh endpoint"""
        response = httpx.post(
            f"{API_URL}/api/auth/refresh",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data


class TestUserRoutes:
    """Tests for routes/users.py"""
    
    def test_get_users_admin(self, admin_token):
        """Test GET /api/users as admin"""
        response = httpx.get(
            f"{API_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_users_unauthorized(self, seller_token):
        """Test GET /api/users as seller (should still work but filtered)"""
        response = httpx.get(
            f"{API_URL}/api/users",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        # Sellers might get 403 or filtered results depending on implementation
        assert response.status_code in [200, 403]


class TestLotteriesRoutes:
    """Tests for routes/lotteries.py"""
    
    def test_get_lotteries(self):
        """Test GET /api/lotteries (public endpoint)"""
        response = httpx.get(f"{API_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            lottery = data[0]
            assert "id" in lottery
            assert "name" in lottery
            assert "is_open" in lottery
    
    def test_get_lotteries_by_country(self):
        """Test GET /api/lotteries with country filter"""
        response = httpx.get(f"{API_URL}/api/lotteries?country=RD")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for lottery in data:
            assert lottery.get("country") == "RD"
    
    def test_get_lottery_by_id(self, admin_token):
        """Test GET /api/lotteries/{id}"""
        # First get list to find an ID
        response = httpx.get(f"{API_URL}/api/lotteries")
        lotteries = response.json()
        if len(lotteries) > 0:
            lottery_id = lotteries[0]["id"]
            response = httpx.get(f"{API_URL}/api/lotteries/{lottery_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == lottery_id


class TestFavoritesRoutes:
    """Tests for routes/favorites.py"""
    
    def test_get_favorites(self, seller_token):
        """Test GET /api/favorites"""
        response = httpx.get(
            f"{API_URL}/api/favorites",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestNotificationsRoutes:
    """Tests for routes/notifications.py"""
    
    def test_get_notifications(self, seller_token):
        """Test GET /api/notifications"""
        response = httpx.get(
            f"{API_URL}/api/notifications",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_unread_count(self, seller_token):
        """Test GET /api/notifications/unread-count"""
        response = httpx.get(
            f"{API_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)


class TestAdminRoutes:
    """Tests for routes/admin.py"""
    
    def test_get_system_config(self, admin_token):
        """Test GET /api/admin/config (super admin only)"""
        response = httpx.get(
            f"{API_URL}/api/admin/config",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "high_risk_threshold_rd" in data or "_id" in data
    
    def test_get_high_risk_tickets(self, admin_token):
        """Test GET /api/admin/high-risk-tickets"""
        response = httpx.get(
            f"{API_URL}/api/admin/high-risk-tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "high_risk_tickets" in data
        assert "threshold_rd" in data


class TestCompanyRoutes:
    """Tests for routes/company.py"""
    
    def test_get_company_profile(self, seller_token):
        """Test GET /api/company-profile"""
        response = httpx.get(
            f"{API_URL}/api/company-profile",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "company_name" in data


class TestTerminalsRoutes:
    """Tests for routes/terminals.py"""
    
    def test_get_terminals(self, admin_token):
        """Test GET /api/terminals"""
        response = httpx.get(
            f"{API_URL}/api/terminals",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_next_terminal_id(self, admin_token):
        """Test GET /api/terminals/next-id"""
        response = httpx.get(
            f"{API_URL}/api/terminals/next-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "next_terminal_id" in data
        assert data["next_terminal_id"].startswith("T")


class TestStatisticsRoutes:
    """Tests for routes/statistics.py"""
    
    def test_get_number_stats(self, admin_token):
        """Test GET /api/stats/numbers/{lottery_id}"""
        # First get a lottery ID
        response = httpx.get(f"{API_URL}/api/lotteries")
        lotteries = response.json()
        if len(lotteries) > 0:
            lottery_id = lotteries[0]["id"]
            response = httpx.get(f"{API_URL}/api/stats/numbers/{lottery_id}")
            assert response.status_code == 200
            data = response.json()
            assert "hot_numbers" in data
            assert "cold_numbers" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

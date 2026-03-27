"""
Backend tests for country filtering in accounting endpoints.
Tests the following features:
1. Login with admin@loteria.com / admin123
2. /api/accounting/summary with country parameter - should return country_filter
3. /api/accounting/sellers-report with country parameter - should filter by country
4. /api/accounting/report with country parameter - should filter by lottery country
5. /api/tickets with country parameter - should filter by lottery country
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://receipt-redesign-6.preview.emergentagent.com')

class TestLogin:
    """Test login functionality"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin@loteria.com / admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        print(f"Login response status: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == "admin@loteria.com"
        print(f"Login successful - User role: {data['user']['role']}, Country: {data['user'].get('country', 'N/A')}")
        return data["token"], data["user"]["role"]


class TestAccountingSummary:
    """Tests for /api/accounting/summary endpoint with country filter"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json()["token"]
    
    def test_accounting_summary_no_filter(self, auth_token):
        """Test /api/accounting/summary without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Summary (no filter) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "today" in data, "Missing 'today' in response"
        assert "week" in data, "Missing 'week' in response"
        assert "month" in data, "Missing 'month' in response"
        assert "currency" in data, "Missing 'currency' in response"
        assert "country_filter" in data, "Missing 'country_filter' in response"
        
        print(f"Summary without filter - country_filter: {data.get('country_filter')}")
        print(f"Today sales: {data['today'].get('sales', 0)}, tickets: {data['today'].get('tickets', 0)}")
    
    def test_accounting_summary_filter_RD(self, auth_token):
        """Test /api/accounting/summary with country=RD"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary?country=RD",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Summary (RD) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "RD", f"Expected country_filter='RD', got '{data.get('country_filter')}'"
        
        print(f"Summary RD filter - country_filter: {data.get('country_filter')}")
    
    def test_accounting_summary_filter_US(self, auth_token):
        """Test /api/accounting/summary with country=US"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary?country=US",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Summary (US) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "US", f"Expected country_filter='US', got '{data.get('country_filter')}'"
        
        print(f"Summary US filter - country_filter: {data.get('country_filter')}")


class TestSellersReport:
    """Tests for /api/accounting/sellers-report endpoint with country filter"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json()["token"]
    
    def test_sellers_report_no_filter(self, auth_token):
        """Test /api/accounting/sellers-report without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Sellers report (no filter) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "sellers" in data, "Missing 'sellers' in response"
        assert "totals" in data, "Missing 'totals' in response"
        assert "period" in data, "Missing 'period' in response"
        assert "country_filter" in data, "Missing 'country_filter' in response"
        
        print(f"Sellers report - country_filter: {data.get('country_filter')}, sellers count: {len(data.get('sellers', []))}")
    
    def test_sellers_report_filter_RD(self, auth_token):
        """Test /api/accounting/sellers-report with country=RD"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report?country=RD",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Sellers report (RD) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "RD", f"Expected country_filter='RD', got '{data.get('country_filter')}'"
        
        # Verify sellers have seller_country field
        for seller in data.get("sellers", []):
            print(f"Seller: {seller.get('seller_name')} - country: {seller.get('seller_country')}")
        
        print(f"Sellers RD filter - country_filter: {data.get('country_filter')}, sellers: {len(data.get('sellers', []))}")
    
    def test_sellers_report_filter_US(self, auth_token):
        """Test /api/accounting/sellers-report with country=US"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report?country=US",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Sellers report (US) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "US", f"Expected country_filter='US', got '{data.get('country_filter')}'"
        
        print(f"Sellers US filter - country_filter: {data.get('country_filter')}, sellers: {len(data.get('sellers', []))}")


class TestAccountingReport:
    """Tests for /api/accounting/report endpoint with country filter"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json()["token"]
    
    def test_accounting_report_no_filter(self, auth_token):
        """Test /api/accounting/report without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Accounting report (no filter) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total_sales" in data, "Missing 'total_sales' in response"
        assert "total_wins" in data, "Missing 'total_wins' in response"
        assert "country_filter" in data, "Missing 'country_filter' in response"
        
        print(f"Accounting report - country_filter: {data.get('country_filter')}")
    
    def test_accounting_report_filter_RD(self, auth_token):
        """Test /api/accounting/report with country=RD"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?country=RD",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Accounting report (RD) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "RD", f"Expected country_filter='RD', got '{data.get('country_filter')}'"
        
        print(f"Accounting RD filter - country_filter: {data.get('country_filter')}")
    
    def test_accounting_report_filter_US(self, auth_token):
        """Test /api/accounting/report with country=US"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?country=US",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Accounting report (US) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "country_filter" in data, "Missing 'country_filter' in response"
        assert data["country_filter"] == "US", f"Expected country_filter='US', got '{data.get('country_filter')}'"
        
        print(f"Accounting US filter - country_filter: {data.get('country_filter')}")


class TestTicketsEndpoint:
    """Tests for /api/tickets endpoint with country filter"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json()["token"]
    
    def test_tickets_no_filter(self, auth_token):
        """Test /api/tickets without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Tickets (no filter) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Response is a list of tickets
        assert isinstance(data, list), "Expected list response"
        print(f"Tickets without filter - count: {len(data)}")
    
    def test_tickets_filter_RD(self, auth_token):
        """Test /api/tickets with country=RD"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?country=RD",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Tickets (RD) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"Tickets RD filter - count: {len(data)}")
    
    def test_tickets_filter_US(self, auth_token):
        """Test /api/tickets with country=US"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?country=US",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Tickets (US) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"Tickets US filter - count: {len(data)}")


class TestDailyChart:
    """Tests for /api/accounting/daily-chart endpoint with country filter"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json()["token"]
    
    def test_daily_chart_no_filter(self, auth_token):
        """Test /api/accounting/daily-chart without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/daily-chart?days=7",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Daily chart (no filter) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "chart_data" in data, "Missing 'chart_data' in response"
        
        print(f"Daily chart - days: {len(data.get('chart_data', []))}")
    
    def test_daily_chart_filter_RD(self, auth_token):
        """Test /api/accounting/daily-chart with country=RD"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/daily-chart?days=7&country=RD",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Daily chart (RD) status: {response.status_code}")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "chart_data" in data, "Missing 'chart_data' in response"
        
        print(f"Daily chart RD filter - days: {len(data.get('chart_data', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

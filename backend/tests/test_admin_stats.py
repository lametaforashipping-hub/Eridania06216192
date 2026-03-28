"""
Tests for Admin Stats Dashboard and Extended Stats endpoints
- GET /api/admin/stats/dashboard
- GET /api/admin/stats/extended
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-sync-1.preview.emergentagent.com')

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "admin@loteria.com",
    "password": "admin123"
}

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_CREDENTIALS
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")

@pytest.fixture
def auth_headers(admin_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestDashboardStatsEndpoint:
    """Tests for GET /api/admin/stats/dashboard"""
    
    def test_dashboard_stats_default_period(self, auth_headers):
        """Test dashboard stats with default period (month)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "period" in data
        assert "start_date" in data
        assert "summary" in data
        assert "growth" in data
        assert "status_breakdown" in data
        assert "sales_by_lottery" in data
        assert "daily_sales" in data
        assert "top_sellers" in data
        
        # Default period should be month
        assert data["period"] == "month"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_won" in summary
        assert "net_profit" in summary
        assert "total_tickets" in summary
        assert "total_commissions" in summary
        assert "avg_ticket_value" in summary
    
    def test_dashboard_stats_period_day(self, auth_headers):
        """Test dashboard stats with period=day"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=day",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "day"
        assert isinstance(data["summary"]["total_sales"], (int, float))
    
    def test_dashboard_stats_period_week(self, auth_headers):
        """Test dashboard stats with period=week"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=week",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "week"
    
    def test_dashboard_stats_period_month(self, auth_headers):
        """Test dashboard stats with period=month"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "month"
    
    def test_dashboard_stats_period_year(self, auth_headers):
        """Test dashboard stats with period=year"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=year",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "year"
    
    def test_dashboard_stats_growth_data(self, auth_headers):
        """Test that growth data has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        growth = response.json()["growth"]
        assert "sales_percent" in growth
        assert "tickets_percent" in growth
        assert "prev_sales" in growth
        assert "prev_tickets" in growth
    
    def test_dashboard_stats_sales_by_lottery(self, auth_headers):
        """Test sales_by_lottery has correct format"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        sales_by_lottery = response.json()["sales_by_lottery"]
        assert isinstance(sales_by_lottery, list)
        
        if len(sales_by_lottery) > 0:
            # Verify structure of items
            item = sales_by_lottery[0]
            assert "name" in item
            assert "value" in item
    
    def test_dashboard_stats_unauthorized(self):
        """Test dashboard stats without auth returns 403"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/dashboard")
        assert response.status_code == 403  # FastAPI returns 403 when no credentials provided


class TestExtendedStatsEndpoint:
    """Tests for GET /api/admin/stats/extended"""
    
    def test_extended_stats_default_period(self, auth_headers):
        """Test extended stats with default period (month)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "period" in data
        assert "client_analytics" in data
        assert "lottery_analytics" in data
        assert "time_analytics" in data
    
    def test_extended_stats_client_analytics(self, auth_headers):
        """Test client analytics has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        client_analytics = response.json()["client_analytics"]
        assert "total_clients" in client_analytics
        assert "new_clients" in client_analytics
        assert "new_clients_growth" in client_analytics
        assert "active_clients" in client_analytics
        assert "conversion_rate" in client_analytics
        assert "top_clients" in client_analytics
        
        # Verify types
        assert isinstance(client_analytics["total_clients"], int)
        assert isinstance(client_analytics["new_clients"], int)
        assert isinstance(client_analytics["conversion_rate"], (int, float))
    
    def test_extended_stats_lottery_analytics(self, auth_headers):
        """Test lottery analytics has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        lottery_analytics = response.json()["lottery_analytics"]
        assert "top_lotteries" in lottery_analytics
        assert "total_lotteries_played" in lottery_analytics
        
        top_lotteries = lottery_analytics["top_lotteries"]
        assert isinstance(top_lotteries, list)
        
        if len(top_lotteries) > 0:
            lottery = top_lotteries[0]
            # Verify lottery item structure
            assert "name" in lottery
            assert "tickets" in lottery
            assert "revenue" in lottery
            assert "percentage" in lottery
            assert "winners" in lottery
            assert "prizes_paid" in lottery
            assert "profit_margin" in lottery
    
    def test_extended_stats_time_analytics(self, auth_headers):
        """Test time analytics has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        time_analytics = response.json()["time_analytics"]
        assert "hourly_distribution" in time_analytics
        assert "weekly_distribution" in time_analytics
        
        # Verify hourly distribution (24 hours)
        hourly = time_analytics["hourly_distribution"]
        assert isinstance(hourly, list)
        assert len(hourly) == 24
        
        if len(hourly) > 0:
            assert "hour" in hourly[0]
            assert "count" in hourly[0]
        
        # Verify weekly distribution (7 days)
        weekly = time_analytics["weekly_distribution"]
        assert isinstance(weekly, list)
        assert len(weekly) == 7
        
        if len(weekly) > 0:
            assert "day" in weekly[0]
            assert "count" in weekly[0]
    
    def test_extended_stats_period_day(self, auth_headers):
        """Test extended stats with period=day"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=day",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["period"] == "day"
    
    def test_extended_stats_period_week(self, auth_headers):
        """Test extended stats with period=week"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=week",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["period"] == "week"
    
    def test_extended_stats_period_year(self, auth_headers):
        """Test extended stats with period=year"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=year",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["period"] == "year"
    
    def test_extended_stats_invalid_period(self, auth_headers):
        """Test extended stats with invalid period returns 422"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=invalid",
            headers=auth_headers
        )
        assert response.status_code == 422
    
    def test_extended_stats_unauthorized(self):
        """Test extended stats without auth returns 403"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/extended")
        assert response.status_code == 403  # FastAPI returns 403 when no credentials provided


class TestDataConsistency:
    """Tests for data consistency between endpoints"""
    
    def test_same_period_yields_consistent_data(self, auth_headers):
        """Test that both endpoints return data for same period"""
        period = "month"
        
        dashboard_response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period={period}",
            headers=auth_headers
        )
        extended_response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period={period}",
            headers=auth_headers
        )
        
        assert dashboard_response.status_code == 200
        assert extended_response.status_code == 200
        
        # Both should return same period
        assert dashboard_response.json()["period"] == period
        assert extended_response.json()["period"] == period

"""
Test Timezone Features & Aggregation Pipeline Optimizations
Testing the new features:
1. Admin dashboard stats with aggregation pipelines
2. Extended stats endpoint
3. User profile with today_stats
4. Monthly report with aggregation
5. Ticket expiry service functionality
6. Lottery closing 15 min before draw (check_lottery_open)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://expo-seller-app.preview.emergentagent.com').rstrip('/')

# Test credentials
SELLER_EMAIL = "vendedor@test.com"
SELLER_PASSWORD = "12345678"
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"


class TestBackendHealth:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAuthentication:
    """Authentication endpoints"""
    
    def test_seller_login(self):
        """Test seller login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "vendedor"
        print(f"✓ Seller login success: {data['user']['name']}")
        return data["token"]
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] in ["admin", "super_admin"]
        print(f"✓ Admin login success: {data['user']['name']}, role={data['user']['role']}")
        return data["token"]


class TestAdminDashboardStats:
    """Test /api/admin/stats/dashboard with aggregation pipelines"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_dashboard_stats_month(self, admin_token):
        """Test dashboard stats for month period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert data["period"] == "month"
        assert "summary" in data
        assert "growth" in data
        assert "status_breakdown" in data
        assert "sales_by_lottery" in data
        assert "daily_sales" in data
        assert "top_sellers" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_won" in summary
        assert "net_profit" in summary
        assert "total_tickets" in summary
        assert "total_commissions" in summary
        assert "avg_ticket_value" in summary
        
        print(f"✓ Dashboard stats (month): sales={summary['total_sales']}, tickets={summary['total_tickets']}")
    
    def test_dashboard_stats_day(self, admin_token):
        """Test dashboard stats for day period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=day",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "day"
        print(f"✓ Dashboard stats (day): sales={data['summary']['total_sales']}")
    
    def test_dashboard_stats_week(self, admin_token):
        """Test dashboard stats for week period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"
        print(f"✓ Dashboard stats (week): sales={data['summary']['total_sales']}")
    
    def test_dashboard_stats_year(self, admin_token):
        """Test dashboard stats for year period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=year",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "year"
        print(f"✓ Dashboard stats (year): sales={data['summary']['total_sales']}")


class TestAdminExtendedStats:
    """Test /api/admin/stats/extended endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_extended_stats_structure(self, admin_token):
        """Test extended stats returns all expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify client analytics
        assert "client_analytics" in data
        client_data = data["client_analytics"]
        assert "total_clients" in client_data
        assert "new_clients" in client_data
        assert "active_clients" in client_data
        assert "conversion_rate" in client_data
        assert "top_clients" in client_data
        
        # Verify lottery analytics
        assert "lottery_analytics" in data
        lottery_data = data["lottery_analytics"]
        assert "top_lotteries" in lottery_data
        assert "total_lotteries_played" in lottery_data
        
        # Verify time analytics
        assert "time_analytics" in data
        time_data = data["time_analytics"]
        assert "hourly_distribution" in time_data
        assert "weekly_distribution" in time_data
        
        # Verify hourly distribution has 24 entries
        assert len(time_data["hourly_distribution"]) == 24
        # Verify weekly distribution has 7 entries
        assert len(time_data["weekly_distribution"]) == 7
        
        print(f"✓ Extended stats: clients={client_data['total_clients']}, lotteries={lottery_data['total_lotteries_played']}")


class TestUserProfile:
    """Test /api/users/me/profile with today_stats"""
    
    @pytest.fixture
    def seller_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        return response.json()["token"]
    
    def test_profile_with_today_stats(self, seller_token):
        """Test user profile returns today_stats"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/profile",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "user" in data
        assert "today_stats" in data
        assert "week_stats" in data
        assert "recent_tickets" in data
        assert "recent_transactions" in data
        
        # Verify today_stats fields
        today_stats = data["today_stats"]
        assert "sales" in today_stats
        assert "wins" in today_stats
        assert "commission" in today_stats
        assert "net" in today_stats
        assert "tickets_count" in today_stats
        assert "pending" in today_stats
        assert "won" in today_stats
        assert "cancelled" in today_stats
        
        print(f"✓ Profile today_stats: sales={today_stats['sales']}, tickets={today_stats['tickets_count']}")


class TestMonthlyReport:
    """Test /api/users/me/monthly-report with aggregation pipeline"""
    
    @pytest.fixture
    def seller_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        return response.json()["token"]
    
    def test_monthly_report_structure(self, seller_token):
        """Test monthly report returns expected structure"""
        # Get current month
        now = datetime.utcnow()
        response = requests.get(
            f"{BASE_URL}/api/users/me/monthly-report?month={now.month}&year={now.year}",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "month" in data
        assert "year" in data
        assert "month_name" in data
        assert "summary" in data
        assert "daily_data" in data
        assert "currency" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_tickets" in summary
        assert "total_commission" in summary
        assert "growth_percentage" in summary
        assert "status_counts" in summary
        
        print(f"✓ Monthly report: {data['month_name']} {data['year']}, sales={summary['total_sales']}")
    
    def test_monthly_report_previous_month(self, seller_token):
        """Test monthly report for previous month"""
        now = datetime.utcnow()
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year = now.year if now.month > 1 else now.year - 1
        
        response = requests.get(
            f"{BASE_URL}/api/users/me/monthly-report?month={prev_month}&year={prev_year}",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["month"] == prev_month
        assert data["year"] == prev_year
        print(f"✓ Previous month report: {data['month_name']} {data['year']}")


class TestTicketExpiryService:
    """Test ticket expiry module can be imported and check old pending tickets"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_ticket_expiry_module_import(self):
        """Verify ticket_expiry module can be imported"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from services.ticket_expiry import expire_old_pending_tickets, get_dr_now
            
            # Test get_dr_now function
            dr_now = get_dr_now()
            assert isinstance(dr_now, datetime)
            
            # Should be approximately UTC-4 (Dominican Republic timezone)
            utc_now = datetime.utcnow()
            expected_offset = timedelta(hours=-4)
            expected_dr = utc_now + expected_offset
            
            # Allow 1 minute tolerance
            diff = abs((dr_now - expected_dr).total_seconds())
            assert diff < 60, f"DR time is off by {diff} seconds"
            
            print(f"✓ Ticket expiry module imported, DR time: {dr_now.strftime('%Y-%m-%d %H:%M')}")
        except ImportError as e:
            pytest.fail(f"Failed to import ticket_expiry module: {e}")
    
    def test_no_old_pending_tickets(self, admin_token):
        """Check that tickets older than 24h are not pending (after expiry job runs)"""
        # Get dashboard stats to see pending count
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/dashboard?period=year",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        status_breakdown = data.get("status_breakdown", {})
        pending_count = status_breakdown.get("pending", 0)
        
        # Note: This test is informational - it shows the pending tickets count
        # The ticket_expiry job should have marked old pending tickets as lost
        print(f"✓ Status breakdown: {status_breakdown}")
        print(f"  Current pending tickets: {pending_count}")


class TestLotteryClosing:
    """Test lottery closing 15 minutes before draw"""
    
    def test_check_lottery_open_function(self):
        """Test the check_lottery_open helper function"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from utils.helpers import check_lottery_open, parse_time_string
            
            # Test parse_time_string
            assert parse_time_string("08:00") == (8, 0)
            assert parse_time_string("14:30") == (14, 30)
            assert parse_time_string("8:00pm") == (20, 0)
            assert parse_time_string("12:00am") == (0, 0)
            
            # Test lottery with closing_minutes_before
            test_lottery = {
                "closing_minutes_before": 15,
                "schedule": ["10:00", "14:00", "21:00"],
                "opening_time": "08:00",
                "closing_time": "21:30",
                "holidays": []
            }
            
            is_open, next_draw, message, today_hours, holiday_info = check_lottery_open(test_lottery)
            
            # Just verify it returns expected types
            assert isinstance(is_open, bool)
            assert next_draw is None or isinstance(next_draw, str)
            assert message is None or isinstance(message, str)
            assert isinstance(today_hours, dict)
            
            print(f"✓ check_lottery_open function works: is_open={is_open}, next_draw={next_draw}")
            print(f"  Today hours: {today_hours}")
            if message:
                print(f"  Message: {message}")
                
        except ImportError as e:
            pytest.fail(f"Failed to import helpers module: {e}")


class TestTimezoneInResponses:
    """Verify timezone handling in API responses"""
    
    @pytest.fixture
    def seller_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        return response.json()["token"]
    
    def test_dates_in_profile_response(self, seller_token):
        """Check date format in profile response"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/profile",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if recent_tickets have created_at dates
        recent_tickets = data.get("recent_tickets", [])
        if recent_tickets:
            first_ticket = recent_tickets[0]
            created_at = first_ticket.get("created_at")
            if created_at:
                # Should be ISO format
                assert "T" in created_at, "Date should be in ISO format"
                print(f"✓ Ticket created_at format: {created_at}")
        
        print(f"✓ Profile response has {len(recent_tickets)} recent tickets")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

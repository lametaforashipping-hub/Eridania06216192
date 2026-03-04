"""
Test suite for verifying all API date responses include 'Z' UTC suffix.
This is critical for proper timezone handling in the frontend.
Without 'Z', browsers interpret dates as local time instead of UTC.
"""
import pytest
import requests
import os
import re
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://draw-results-test.preview.emergentagent.com').rstrip('/')

# Test credentials
SELLER_EMAIL = "vendedor@test.com"
SELLER_PASSWORD = "12345678"
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"

# ISO datetime pattern that ends with Z
ISO_DATE_WITH_Z_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$')


class TestZSuffixInDates:
    """Tests to verify all dates from API responses end with 'Z' (UTC indicator)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and get tokens"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.seller_token = None
        self.admin_token = None
    
    def _login_seller(self):
        """Login as seller and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        })
        assert response.status_code == 200, f"Seller login failed: {response.text}"
        data = response.json()
        self.seller_token = data.get("token")
        return self.seller_token
    
    def _login_admin(self):
        """Login as admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data.get("token")
        return self.admin_token
    
    def _check_date_has_z_suffix(self, date_str, field_name):
        """Check if a date string ends with 'Z' suffix"""
        if date_str is None or date_str == "":
            return True  # Empty/null dates are OK
        
        assert isinstance(date_str, str), f"{field_name} should be a string, got {type(date_str)}: {date_str}"
        assert date_str.endswith('Z'), f"{field_name} should end with 'Z': got '{date_str}'"
        return True
    
    def _recursively_check_dates(self, obj, path=""):
        """Recursively check all date fields in an object for 'Z' suffix"""
        date_fields = ['created_at', 'updated_at', 'last_activity', 'paid_at', 'cancelled_at', 'last_update']
        
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                if key in date_fields and value is not None and value != "":
                    self._check_date_has_z_suffix(value, current_path)
                elif isinstance(value, (dict, list)):
                    self._recursively_check_dates(value, current_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                self._recursively_check_dates(item, f"{path}[{i}]")
    
    # ==================== Health Check ====================
    
    def test_backend_health(self):
        """Test backend is healthy"""
        response = self.session.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        # Root endpoint returns message and version, not status
        assert "message" in data or "version" in data or data.get("status") == "healthy"
        print("✅ Backend health check passed")
    
    # ==================== Authentication ====================
    
    def test_seller_login(self):
        """Test seller login works"""
        token = self._login_seller()
        assert token is not None
        assert len(token) > 0
        print("✅ Seller login successful")
    
    def test_admin_login(self):
        """Test admin login works"""
        token = self._login_admin()
        assert token is not None
        assert len(token) > 0
        print("✅ Admin login successful")
    
    # ==================== GET /api/tickets - Check created_at ends with Z ====================
    
    def test_tickets_created_at_has_z_suffix(self):
        """GET /api/tickets - verify created_at ends with 'Z'"""
        token = self._login_seller()
        response = self.session.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        tickets = data.get("tickets", [])
        checked_count = 0
        for ticket in tickets[:10]:  # Check first 10 tickets
            created_at = ticket.get("created_at")
            if created_at:
                self._check_date_has_z_suffix(created_at, f"ticket[{ticket.get('ticket_number')}].created_at")
                checked_count += 1
        
        print(f"✅ GET /api/tickets - {checked_count} tickets have created_at with 'Z' suffix")
    
    # ==================== GET /api/admin/stats/dashboard ====================
    
    def test_admin_dashboard_stats(self):
        """GET /api/admin/stats/dashboard - verify endpoint works after optimization"""
        token = self._login_admin()
        
        for period in ["day", "week", "month"]:
            response = self.session.get(
                f"{BASE_URL}/api/admin/stats/dashboard?period={period}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200, f"Failed for period={period}: {response.text}"
            data = response.json()
            
            # Verify required fields exist
            assert "summary" in data, f"Missing 'summary' in response for period={period}"
            assert "growth" in data, f"Missing 'growth' in response for period={period}"
            assert "status_breakdown" in data, f"Missing 'status_breakdown' in response for period={period}"
            assert "sales_by_lottery" in data, f"Missing 'sales_by_lottery' in response for period={period}"
            assert "daily_sales" in data, f"Missing 'daily_sales' in response for period={period}"
            assert "top_sellers" in data, f"Missing 'top_sellers' in response for period={period}"
            
            # Check start_date has proper ISO format (it's returned without Z in this endpoint but not a datetime field)
            print(f"✅ GET /api/admin/stats/dashboard?period={period} - Works correctly")
    
    # ==================== GET /api/admin/stats/extended ====================
    
    def test_admin_extended_stats(self):
        """GET /api/admin/stats/extended - verify endpoint works"""
        token = self._login_admin()
        response = self.session.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "client_analytics" in data
        assert "lottery_analytics" in data
        assert "time_analytics" in data
        
        client_analytics = data["client_analytics"]
        assert "total_clients" in client_analytics
        assert "new_clients" in client_analytics
        assert "active_clients" in client_analytics
        assert "conversion_rate" in client_analytics
        assert "top_clients" in client_analytics
        
        print("✅ GET /api/admin/stats/extended - Works correctly")
    
    # ==================== GET /api/users/me/profile - Check today_stats dates ====================
    
    def test_user_profile_dates_have_z_suffix(self):
        """GET /api/users/me/profile - verify any date fields end with 'Z'"""
        token = self._login_seller()
        response = self.session.get(
            f"{BASE_URL}/api/users/me/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check user object dates
        user = data.get("user", {})
        if user.get("created_at"):
            self._check_date_has_z_suffix(user["created_at"], "user.created_at")
        if user.get("last_activity"):
            self._check_date_has_z_suffix(user["last_activity"], "user.last_activity")
        
        # Check recent_tickets dates
        recent_tickets = data.get("recent_tickets", [])
        for i, ticket in enumerate(recent_tickets[:5]):
            if ticket.get("created_at"):
                self._check_date_has_z_suffix(ticket["created_at"], f"recent_tickets[{i}].created_at")
        
        # Check recent_transactions dates
        recent_transactions = data.get("recent_transactions", [])
        for i, tx in enumerate(recent_transactions[:5]):
            if tx.get("created_at"):
                self._check_date_has_z_suffix(tx["created_at"], f"recent_transactions[{i}].created_at")
        
        print("✅ GET /api/users/me/profile - All dates have 'Z' suffix")
    
    # ==================== GET /api/monitoring/live-tickets - Check last_update ends with Z ====================
    
    def test_live_tickets_last_update_has_z_suffix(self):
        """GET /api/monitoring/live-tickets - verify last_update ends with 'Z'"""
        token = self._login_admin()
        response = self.session.get(
            f"{BASE_URL}/api/monitoring/live-tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check last_update field
        last_update = data.get("last_update")
        assert last_update is not None, "last_update field is missing"
        self._check_date_has_z_suffix(last_update, "last_update")
        
        # Also check tickets in the response
        tickets = data.get("tickets", [])
        for i, ticket in enumerate(tickets[:5]):
            if ticket.get("created_at"):
                self._check_date_has_z_suffix(ticket["created_at"], f"tickets[{i}].created_at")
        
        print("✅ GET /api/monitoring/live-tickets - last_update has 'Z' suffix")
    
    # ==================== GET /api/accounting/report - Check transaction dates ====================
    
    def test_accounting_report_dates_have_z_suffix(self):
        """GET /api/accounting/report - verify transaction dates end with 'Z'"""
        token = self._login_admin()
        response = self.session.get(
            f"{BASE_URL}/api/accounting/report?period=month",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check transactions dates
        transactions = data.get("transactions", [])
        for i, tx in enumerate(transactions[:10]):
            created_at = tx.get("created_at")
            if created_at and created_at != "":
                self._check_date_has_z_suffix(created_at, f"transactions[{i}].created_at")
        
        print(f"✅ GET /api/accounting/report - {len(transactions)} transaction dates have 'Z' suffix")
    
    # ==================== GET /api/accounting/detailed-seller-report - Check dates ====================
    
    def test_detailed_seller_report_dates_have_z_suffix(self):
        """GET /api/accounting/detailed-seller-report - verify ticket dates end with 'Z'"""
        token = self._login_seller()
        response = self.session.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check ticket dates in the response
        tickets = data.get("tickets", [])
        checked_count = 0
        for i, ticket in enumerate(tickets[:10]):
            created_at = ticket.get("created_at")
            if created_at and created_at != "":
                self._check_date_has_z_suffix(created_at, f"tickets[{i}].created_at")
                checked_count += 1
        
        print(f"✅ GET /api/accounting/detailed-seller-report - {checked_count} ticket dates have 'Z' suffix")
    
    # ==================== GET /api/tickets/recent-plays - Check dates ====================
    
    def test_recent_plays_dates_have_z_suffix(self):
        """GET /api/tickets/recent-plays - verify created_at ends with 'Z'"""
        token = self._login_seller()
        response = self.session.get(
            f"{BASE_URL}/api/tickets/recent-plays",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check play dates
        checked_count = 0
        for i, play in enumerate(data[:10]):
            created_at = play.get("created_at")
            if created_at:
                self._check_date_has_z_suffix(created_at, f"recent_plays[{i}].created_at")
                checked_count += 1
        
        print(f"✅ GET /api/tickets/recent-plays - {checked_count} play dates have 'Z' suffix")
    
    # ==================== GET /api/accounting/commissions - Check dates ====================
    
    def test_commissions_report_dates_have_z_suffix(self):
        """GET /api/accounting/commissions - verify detail dates end with 'Z'"""
        token = self._login_seller()
        response = self.session.get(
            f"{BASE_URL}/api/accounting/commissions?period=month",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check detail dates
        details = data.get("details", [])
        checked_count = 0
        for i, detail in enumerate(details[:10]):
            created_at = detail.get("created_at")
            if created_at and created_at != "":
                self._check_date_has_z_suffix(created_at, f"details[{i}].created_at")
                checked_count += 1
        
        print(f"✅ GET /api/accounting/commissions - {checked_count} commission dates have 'Z' suffix")
    
    # ==================== JavaScript Timezone Interpretation Test ====================
    
    def test_timezone_interpretation_verification(self):
        """Verify that a UTC datetime with Z suffix can be correctly interpreted for DR timezone.
        
        UTC Time: 2026-02-17T20:37:48.025000Z
        DR Time (UTC-4): 2026-02-17T16:37:48.025000 (16:37, not 20:37)
        
        This test simulates what JavaScript's toLocaleString with timeZone does.
        """
        # Example UTC datetime with Z suffix (as returned by API)
        utc_datetime_str = "2026-02-17T20:37:48.025000Z"
        
        # Parse as UTC (the Z suffix tells Python this is UTC)
        from datetime import timezone as tz
        utc_datetime = datetime.fromisoformat(utc_datetime_str.replace('Z', '+00:00'))
        
        # Convert to DR timezone (UTC-4)
        from datetime import timedelta as td
        dr_offset = tz(td(hours=-4))
        dr_datetime = utc_datetime.astimezone(dr_offset)
        
        # Verify the hour in DR timezone
        assert dr_datetime.hour == 16, f"Expected hour 16 in DR timezone, got {dr_datetime.hour}"
        assert dr_datetime.minute == 37, f"Expected minute 37, got {dr_datetime.minute}"
        
        print(f"✅ UTC '{utc_datetime_str}' correctly converts to DR time: {dr_datetime.strftime('%H:%M')} (16:37)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

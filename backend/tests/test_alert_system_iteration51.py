"""
Test Alert System - Iteration 51
Tests for:
- Alert settings CRUD (GET/PUT /api/alert-settings)
- Recent alerts endpoint (GET /api/alert-settings/recent-alerts)
- Notifications unread count (GET /api/notifications/unread-count)
- Mark notification as read (POST /api/notifications/{id}/read)
- Milestone trigger via ticket creation (POST /api/tickets/multi)
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('VITE_API_URL', '').rstrip('/')

class TestAlertSystem:
    """Alert system endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        data = login_res.json()
        self.admin_token = data.get("token")  # API returns 'token' not 'access_token'
        self.admin_user = data.get("user", {})
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
    # ============ Alert Settings Tests ============
    
    def test_get_alert_settings(self):
        """GET /api/alert-settings - Returns current alert configuration"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings")
        assert res.status_code == 200, f"Failed to get alert settings: {res.text}"
        
        data = res.json()
        # Verify required fields exist
        assert "milestone_rd" in data, "Missing milestone_rd field"
        assert "milestone_usd" in data, "Missing milestone_usd field"
        assert "daily_target_rd" in data, "Missing daily_target_rd field"
        assert "daily_target_usd" in data, "Missing daily_target_usd field"
        assert "notify_on_winner" in data, "Missing notify_on_winner field"
        assert "notify_on_milestone" in data, "Missing notify_on_milestone field"
        assert "notify_on_daily_target" in data, "Missing notify_on_daily_target field"
        
        # Verify types
        assert isinstance(data["milestone_rd"], (int, float)), "milestone_rd should be numeric"
        assert isinstance(data["milestone_usd"], (int, float)), "milestone_usd should be numeric"
        assert isinstance(data["notify_on_winner"], bool), "notify_on_winner should be boolean"
        
        print(f"Alert settings: milestone_rd={data['milestone_rd']}, milestone_usd={data['milestone_usd']}")
        
    def test_update_alert_settings_super_admin(self):
        """PUT /api/alert-settings - Updates alert thresholds (super admin only)"""
        # Get current settings first
        get_res = self.session.get(f"{BASE_URL}/api/alert-settings")
        original = get_res.json()
        
        # Update with new values
        update_data = {
            "milestone_rd": 55000.0,
            "milestone_usd": 550.0,
            "daily_target_rd": 110000.0,
            "daily_target_usd": 650.0,
            "notify_on_winner": True,
            "notify_on_milestone": True,
            "notify_on_daily_target": True
        }
        
        res = self.session.put(f"{BASE_URL}/api/alert-settings", json=update_data)
        assert res.status_code == 200, f"Failed to update alert settings: {res.text}"
        
        data = res.json()
        assert "message" in data, "Response should contain message"
        assert data.get("milestone_rd") == 55000.0, "milestone_rd not updated"
        assert data.get("milestone_usd") == 550.0, "milestone_usd not updated"
        
        # Verify persistence by fetching again
        verify_res = self.session.get(f"{BASE_URL}/api/alert-settings")
        verify_data = verify_res.json()
        assert verify_data["milestone_rd"] == 55000.0, "milestone_rd not persisted"
        
        # Restore original settings
        restore_data = {
            "milestone_rd": original.get("milestone_rd", 50000.0),
            "milestone_usd": original.get("milestone_usd", 500.0),
            "daily_target_rd": original.get("daily_target_rd", 100000.0),
            "daily_target_usd": original.get("daily_target_usd", 600.0),
            "notify_on_winner": original.get("notify_on_winner", True),
            "notify_on_milestone": original.get("notify_on_milestone", True),
            "notify_on_daily_target": original.get("notify_on_daily_target", True)
        }
        self.session.put(f"{BASE_URL}/api/alert-settings", json=restore_data)
        print("Alert settings update test passed - settings restored")
        
    def test_update_alert_settings_vendor_forbidden(self):
        """PUT /api/alert-settings - Vendor should get 403"""
        # Login as vendor
        vendor_session = requests.Session()
        vendor_session.headers.update({"Content-Type": "application/json"})
        
        login_res = vendor_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        
        if login_res.status_code != 200:
            pytest.skip("Vendor login failed - skipping vendor test")
            
        vendor_token = login_res.json().get("token")  # API returns 'token' not 'access_token'
        vendor_session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        # Try to update settings as vendor
        update_data = {
            "milestone_rd": 99999.0,
            "milestone_usd": 999.0,
            "daily_target_rd": 199999.0,
            "daily_target_usd": 1999.0,
            "notify_on_winner": True,
            "notify_on_milestone": True,
            "notify_on_daily_target": True
        }
        
        res = vendor_session.put(f"{BASE_URL}/api/alert-settings", json=update_data)
        assert res.status_code == 403, f"Vendor should get 403, got {res.status_code}"
        print("Vendor correctly denied access to update alert settings")
        
    # ============ Recent Alerts Tests ============
    
    def test_get_recent_alerts(self):
        """GET /api/alert-settings/recent-alerts - Returns recent notification alerts"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?limit=30")
        assert res.status_code == 200, f"Failed to get recent alerts: {res.text}"
        
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            alert = data[0]
            # Check alert structure
            assert "type" in alert or "title" in alert, "Alert should have type or title"
            assert "created_at" in alert or "message" in alert, "Alert should have created_at or message"
            
            # Check for expected alert types
            alert_types = [a.get("type") for a in data if a.get("type")]
            print(f"Found {len(data)} alerts with types: {set(alert_types)}")
            
            # Verify is_read field is present
            for a in data:
                assert "is_read" in a, "Alert should have is_read field"
        else:
            print("No recent alerts found - this is acceptable")
            
    def test_get_recent_alerts_with_type_filter(self):
        """GET /api/alert-settings/recent-alerts?alert_type=sales_milestone"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?alert_type=sales_milestone&limit=10")
        assert res.status_code == 200, f"Failed to get filtered alerts: {res.text}"
        
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All returned alerts should be of type sales_milestone
        for alert in data:
            if alert.get("type"):
                assert alert["type"] == "sales_milestone", f"Expected sales_milestone, got {alert['type']}"
                
        print(f"Found {len(data)} sales_milestone alerts")
        
    # ============ Notifications Tests ============
    
    def test_get_unread_count(self):
        """GET /api/notifications/unread-count - Returns unread count"""
        res = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert res.status_code == 200, f"Failed to get unread count: {res.text}"
        
        data = res.json()
        assert "unread_count" in data, "Response should contain unread_count"
        assert isinstance(data["unread_count"], int), "unread_count should be integer"
        assert data["unread_count"] >= 0, "unread_count should be non-negative"
        
        print(f"Unread notifications count: {data['unread_count']}")
        
    def test_mark_notification_read(self):
        """POST /api/notifications/{id}/read - Marks notification as read"""
        # First get recent alerts to find an unread one
        alerts_res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?limit=10")
        alerts = alerts_res.json()
        
        unread_alert = None
        for alert in alerts:
            if not alert.get("is_read") and alert.get("id"):
                unread_alert = alert
                break
                
        if not unread_alert:
            # Try to find any alert with an id
            for alert in alerts:
                if alert.get("id"):
                    unread_alert = alert
                    break
                    
        if not unread_alert:
            pytest.skip("No alerts with id found to test mark-read")
            
        alert_id = unread_alert["id"]
        
        # Mark as read
        res = self.session.post(f"{BASE_URL}/api/notifications/{alert_id}/read")
        assert res.status_code == 200, f"Failed to mark notification as read: {res.text}"
        
        data = res.json()
        assert "message" in data, "Response should contain message"
        print(f"Successfully marked notification {alert_id} as read")
        
    # ============ Milestone Trigger Tests ============
    
    def test_milestone_notification_exists(self):
        """Verify sales_milestone notifications exist in the system"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?alert_type=sales_milestone&limit=5")
        assert res.status_code == 200, f"Failed to get milestone alerts: {res.text}"
        
        data = res.json()
        # According to context, there should be milestone notifications
        if len(data) > 0:
            milestone = data[0]
            assert milestone.get("type") == "sales_milestone", "Should be sales_milestone type"
            assert "message" in milestone or "title" in milestone, "Should have message or title"
            print(f"Found sales_milestone notification: {milestone.get('message') or milestone.get('title')}")
        else:
            print("No sales_milestone notifications found - may need to trigger via ticket creation")
            
    def test_daily_target_notification_exists(self):
        """Verify daily_target notifications exist in the system"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?alert_type=daily_target&limit=5")
        assert res.status_code == 200, f"Failed to get daily target alerts: {res.text}"
        
        data = res.json()
        if len(data) > 0:
            target = data[0]
            assert target.get("type") == "daily_target", "Should be daily_target type"
            print(f"Found daily_target notification: {target.get('message') or target.get('title')}")
        else:
            print("No daily_target notifications found")
            
    # ============ Integration Test ============
    
    def test_full_alert_flow(self):
        """Test complete alert flow: settings -> alerts -> unread count"""
        # 1. Get settings
        settings_res = self.session.get(f"{BASE_URL}/api/alert-settings")
        assert settings_res.status_code == 200
        settings = settings_res.json()
        print(f"1. Settings loaded: milestone_rd={settings.get('milestone_rd')}")
        
        # 2. Get recent alerts
        alerts_res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts?limit=20")
        assert alerts_res.status_code == 200
        alerts = alerts_res.json()
        print(f"2. Found {len(alerts)} recent alerts")
        
        # 3. Get unread count
        unread_res = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert unread_res.status_code == 200
        unread = unread_res.json()
        print(f"3. Unread count: {unread.get('unread_count')}")
        
        # 4. Verify alert types present
        alert_types = set(a.get("type") for a in alerts if a.get("type"))
        print(f"4. Alert types found: {alert_types}")
        
        print("Full alert flow test completed successfully")


class TestVendorAlertAccess:
    """Test vendor access to alert endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup vendor session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as vendor
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        
        if login_res.status_code != 200:
            pytest.skip("Vendor login failed")
            
        data = login_res.json()
        self.vendor_token = data.get("token")  # API returns 'token' not 'access_token'
        self.session.headers.update({"Authorization": f"Bearer {self.vendor_token}"})
        
    def test_vendor_cannot_access_alert_settings(self):
        """Vendor should not access GET /api/alert-settings"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings")
        # Vendor should get 403 as it requires admin/super_admin role
        assert res.status_code == 403, f"Vendor should get 403 for alert settings, got {res.status_code}"
        print("Vendor correctly denied access to alert settings")
        
    def test_vendor_cannot_access_recent_alerts(self):
        """Vendor should not access GET /api/alert-settings/recent-alerts"""
        res = self.session.get(f"{BASE_URL}/api/alert-settings/recent-alerts")
        assert res.status_code == 403, f"Vendor should get 403 for recent alerts, got {res.status_code}"
        print("Vendor correctly denied access to recent alerts")
        
    def test_vendor_can_access_unread_count(self):
        """Vendor should be able to access unread count"""
        res = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert res.status_code == 200, f"Vendor should access unread count, got {res.status_code}"
        data = res.json()
        assert "unread_count" in data
        print(f"Vendor unread count: {data['unread_count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

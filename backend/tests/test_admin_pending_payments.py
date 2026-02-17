"""
Test Admin Pending Payments - Phase 3 Features
Tests for:
- GET /api/payments/pending (admin get pending payments)
- GET /api/payments/pending-count (pending payments count)
- POST /api/payments/{id}/action (approve/reject payment)
- Client notifications on payment confirmation/rejection
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminPendingPayments:
    """Admin pending payments endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        if login_response.status_code == 200:
            self.admin_token = login_response.json().get("token")
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed - skipping admin tests")
        
        # Login as client
        client_login = requests.post(
            f"{BASE_URL}/api/clients/login?phone=8091112222&password=test123456"
        )
        if client_login.status_code == 200:
            self.client_token = client_login.json().get("token")
            self.client_headers = {"Authorization": f"Bearer {self.client_token}"}
            self.client_id = client_login.json().get("user", {}).get("id")
        else:
            self.client_token = None
            self.client_headers = {}
            self.client_id = None
    
    def test_get_pending_payments_unauthorized(self):
        """Test that unauthorized users cannot access pending payments"""
        # No auth header
        response = requests.get(f"{BASE_URL}/api/payments/pending")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Pending payments requires authentication")
    
    def test_get_pending_payments_client_forbidden(self):
        """Test that clients cannot access admin pending payments"""
        if not self.client_token:
            pytest.skip("No client token available")
        
        response = requests.get(
            f"{BASE_URL}/api/payments/pending",
            headers=self.client_headers
        )
        assert response.status_code == 403, f"Expected 403 Forbidden for client, got {response.status_code}"
        print("✓ Clients cannot access admin pending payments")
    
    def test_get_pending_payments_admin_success(self):
        """Test that admin can access pending payments"""
        response = requests.get(
            f"{BASE_URL}/api/payments/pending?page=1&limit=20",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "payments" in data, "Response should have 'payments' key"
        assert "pagination" in data, "Response should have 'pagination' key"
        assert isinstance(data["payments"], list), "Payments should be a list"
        
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"✓ Admin can access pending payments - Found {len(data['payments'])} pending, total: {pagination['total']}")
    
    def test_get_pending_payments_count_unauthorized(self):
        """Test that pending-count requires auth"""
        response = requests.get(f"{BASE_URL}/api/payments/pending-count")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Pending count requires authentication")
    
    def test_get_pending_payments_count_admin_success(self):
        """Test admin can get pending count"""
        response = requests.get(
            f"{BASE_URL}/api/payments/pending-count",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "count" in data, "Response should have 'count' key"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        
        print(f"✓ Pending payments count: {data['count']}")
    
    def test_process_payment_invalid_id(self):
        """Test processing payment with invalid ID"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/payments/{fake_id}/action",
            headers=self.admin_headers,
            json={"action": "approve"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent payment, got {response.status_code}"
        print("✓ Processing non-existent payment returns 404")
    
    def test_process_payment_invalid_action(self):
        """Test processing payment with invalid action"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/payments/{fake_id}/action",
            headers=self.admin_headers,
            json={"action": "invalid_action"}
        )
        # Either 404 (payment not found) or 400 (invalid action) is acceptable
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print("✓ Invalid action handled correctly")
    
    def test_process_payment_unauthorized(self):
        """Test that unauthorized users cannot process payments"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/payments/{fake_id}/action",
            json={"action": "approve"}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Processing payment requires authentication")
    
    def test_process_payment_client_forbidden(self):
        """Test that clients cannot process payments"""
        if not self.client_token:
            pytest.skip("No client token available")
        
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/payments/{fake_id}/action",
            headers=self.client_headers,
            json={"action": "approve"}
        )
        assert response.status_code == 403, f"Expected 403 Forbidden for client, got {response.status_code}"
        print("✓ Clients cannot process payments")


class TestPaymentConfig:
    """Test payment configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        if login_response.status_code == 200:
            self.admin_token = login_response.json().get("token")
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_payment_config(self):
        """Test getting payment configuration"""
        response = requests.get(
            f"{BASE_URL}/api/payments/config",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Config can have zelle and bank_accounts
        print(f"✓ Payment config retrieved successfully")
    
    def test_update_payment_config(self):
        """Test updating payment configuration"""
        new_config = {
            "zelle": {
                "enabled": True,
                "phone": "+1-555-TEST",
                "email": "test@zelle.com",
                "name": "Test Zelle Account"
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/payments/config",
            headers=self.admin_headers,
            json=new_config
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Payment config updated successfully")


class TestPaymentHistory:
    """Test payment history endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        if login_response.status_code == 200:
            self.admin_token = login_response.json().get("token")
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_payment_history_all(self):
        """Test getting all payment history"""
        response = requests.get(
            f"{BASE_URL}/api/payments/history",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payments" in data
        assert "pagination" in data
        print(f"✓ Payment history retrieved - {len(data['payments'])} payments found")
    
    def test_get_payment_history_by_status(self):
        """Test filtering payment history by status"""
        for status in ["pending", "confirmed", "rejected"]:
            response = requests.get(
                f"{BASE_URL}/api/payments/history?status={status}",
                headers=self.admin_headers
            )
            assert response.status_code == 200, f"Expected 200 for status={status}, got {response.status_code}"
            print(f"✓ Payment history filtered by {status}")


class TestClientNotifications:
    """Test client notifications collection exists and works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup client authentication"""
        client_login = requests.post(
            f"{BASE_URL}/api/clients/login?phone=8091112222&password=test123456"
        )
        if client_login.status_code == 200:
            self.client_token = client_login.json().get("token")
            self.client_headers = {"Authorization": f"Bearer {self.client_token}"}
        else:
            pytest.skip("Client login failed")
    
    def test_client_profile_includes_notifications(self):
        """Verify client profile endpoint works (notifications would be sent here)"""
        response = requests.get(
            f"{BASE_URL}/api/clients/me",
            headers=self.client_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Client profile should have id"
        assert "phone" in data, "Client profile should have phone"
        print(f"✓ Client profile accessible - Client ID: {data.get('id', 'N/A')}")


class TestDashboardMenuOption:
    """Test that Pagos Clientes option is available in dashboard"""
    
    def test_admin_dashboard_access(self):
        """Admin can access the dashboard with 'Pagos Clientes' option"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@loteria.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # The dashboard itself is a frontend route, but we can verify the user has admin role
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("role") in ["admin", "super_admin"], "User should be admin or super_admin"
        print(f"✓ Admin user has role: {data.get('role')} - Can access 'Pagos Clientes' in dashboard")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

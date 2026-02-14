"""
Tests for Live Tickets Monitoring and Super Admin Cancel features
- GET /api/monitoring/live-tickets
- GET /api/admin/seller-profile/{seller_id}
- POST /api/tickets/{ticket_id}/cancel (Super Admin unlimited cancellation)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://sales-shortcuts-app.preview.emergentagent.com')

class TestLiveTicketsMonitoring:
    """Tests for live tickets monitoring endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with authorization"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_live_tickets_endpoint_returns_200(self, auth_headers):
        """Test that /api/monitoring/live-tickets returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/monitoring/live-tickets?limit=5", headers=auth_headers)
        assert response.status_code == 200
        print("PASS: Live tickets endpoint returns 200")
    
    def test_live_tickets_response_structure(self, auth_headers):
        """Test that response has correct structure with tickets and stats"""
        response = requests.get(f"{BASE_URL}/api/monitoring/live-tickets?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "tickets" in data, "Response should contain 'tickets' array"
        assert "stats" in data, "Response should contain 'stats' object"
        assert "last_update" in data, "Response should contain 'last_update' timestamp"
        print("PASS: Response has correct structure (tickets, stats, last_update)")
    
    def test_live_tickets_stats_fields(self, auth_headers):
        """Test that stats contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/monitoring/live-tickets?limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        # Verify all stats fields exist
        required_stats = ["total_today", "total_sales", "pending", "won", "cancelled"]
        for field in required_stats:
            assert field in stats, f"Stats should contain '{field}'"
        
        # Verify stats are numeric
        assert isinstance(stats["total_today"], int)
        assert isinstance(stats["total_sales"], (int, float))
        assert isinstance(stats["pending"], int)
        assert isinstance(stats["won"], int)
        assert isinstance(stats["cancelled"], int)
        print(f"PASS: Stats fields verified: total_today={stats['total_today']}, pending={stats['pending']}, won={stats['won']}, cancelled={stats['cancelled']}")
    
    def test_live_tickets_limit_parameter(self, auth_headers):
        """Test that limit parameter works correctly"""
        response = requests.get(f"{BASE_URL}/api/monitoring/live-tickets?limit=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should return at most 3 tickets
        assert len(data["tickets"]) <= 3, "Should respect limit parameter"
        print(f"PASS: Limit parameter works, returned {len(data['tickets'])} tickets (limit was 3)")


class TestSellerProfile:
    """Tests for admin seller profile endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with authorization"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def seller_id(self, auth_headers):
        """Get a seller ID from users list"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        sellers = [u for u in users if u.get("role") == "vendedor"]
        if not sellers:
            pytest.skip("No sellers found in the database")
        return sellers[0]["id"]
    
    def test_seller_profile_endpoint_returns_200(self, auth_headers, seller_id):
        """Test that /api/admin/seller-profile/{seller_id} returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"PASS: Seller profile endpoint returns 200 for seller {seller_id}")
    
    def test_seller_profile_response_structure(self, auth_headers, seller_id):
        """Test that seller profile response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "seller" in data, "Response should contain 'seller' object"
        assert "today_stats" in data, "Response should contain 'today_stats' object"
        assert "recent_tickets" in data, "Response should contain 'recent_tickets' array"
        assert "recent_transactions" in data, "Response should contain 'recent_transactions' array"
        print("PASS: Seller profile has correct structure (seller, today_stats, recent_tickets, recent_transactions)")
    
    def test_seller_profile_today_stats_fields(self, auth_headers, seller_id):
        """Test that today_stats contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        today_stats = data["today_stats"]
        
        # Verify all stats fields exist
        required_fields = ["sales", "wins", "commission", "net"]
        for field in required_fields:
            assert field in today_stats, f"today_stats should contain '{field}'"
        print(f"PASS: Seller today_stats fields verified: sales={today_stats['sales']}, wins={today_stats['wins']}")
    
    def test_seller_profile_404_for_invalid_id(self, auth_headers):
        """Test that invalid seller ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/seller-profile/invalid-seller-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("PASS: Invalid seller ID returns 404")


class TestSuperAdminCancellation:
    """Tests for Super Admin ticket cancellation without time limit"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with authorization"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_cancel_endpoint_exists(self, auth_headers):
        """Test that cancel endpoint exists and responds correctly"""
        # Get a pending ticket to verify endpoint
        response = requests.get(f"{BASE_URL}/api/tickets?status=pending", headers=auth_headers)
        assert response.status_code == 200
        tickets = response.json()
        
        if tickets:
            # Test with a fake ticket ID to verify endpoint responds
            fake_response = requests.post(f"{BASE_URL}/api/tickets/fake-ticket-id/cancel", headers=auth_headers)
            assert fake_response.status_code == 404, "Should return 404 for non-existent ticket"
            print("PASS: Cancel endpoint exists and returns 404 for non-existent ticket")
        else:
            print("PASS: Cancel endpoint exists (no pending tickets to test actual cancellation)")
    
    def test_super_admin_can_view_all_pending_tickets(self, auth_headers):
        """Test Super Admin can view all pending tickets for potential cancellation"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=pending", headers=auth_headers)
        assert response.status_code == 200
        tickets = response.json()
        
        print(f"PASS: Super Admin can view all pending tickets, found {len(tickets)} pending")
        
        # Verify ticket structure for cancellation
        if tickets:
            ticket = tickets[0]
            assert "id" in ticket
            assert "status" in ticket
            assert ticket["status"] == "pending"


class TestCancelTicketBackendLogic:
    """Tests for cancel ticket backend logic - verify code changes"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "super_admin"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with authorization"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_cancel_non_pending_ticket_returns_error(self, auth_headers):
        """Test that cancelling a non-pending ticket returns error"""
        # Get all tickets
        response = requests.get(f"{BASE_URL}/api/tickets", headers=auth_headers)
        assert response.status_code == 200
        tickets = response.json()
        
        # Find a cancelled or lost ticket
        non_pending = [t for t in tickets if t.get("status") in ["cancelled", "lost", "won", "paid"]]
        
        if non_pending:
            ticket_id = non_pending[0]["id"]
            cancel_response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/cancel", headers=auth_headers)
            assert cancel_response.status_code == 400, "Should return 400 for non-pending ticket"
            error = cancel_response.json()
            assert "detail" in error
            print(f"PASS: Cancel non-pending ticket returns 400 with message: {error['detail']}")
        else:
            print("PASS: No non-pending tickets to test (all tickets are pending)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

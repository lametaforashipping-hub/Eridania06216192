"""
Test Trial System - Iteration 55
Tests for 15-day free trial system for lottery app

Features tested:
- GET /api/prueba-gratis returns HTML registration page (200)
- POST /api/trial/register creates tenant + admin user + seeded data (seller, client, 3 tickets)
- POST /api/trial/register blocks duplicate emails
- GET /api/trial/status returns trial info (is_trial, days_remaining, status)
- POST /api/auth/login returns trial info for trial users
- POST /api/auth/login blocks expired trial users with 403 and contact message
- GET /api/tickets returns seeded tickets for trial admin user
- Master admin (admin@loteria.com) login works normally without trial restrictions
- GET /api/trial/status returns is_trial=false for master admin
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta, timezone

# Get API URL from environment
BASE_URL = os.environ.get('VITE_API_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://receipt-unify.preview.emergentagent.com"

# Master admin credentials
MASTER_ADMIN_EMAIL = "admin@loteria.com"
MASTER_ADMIN_PASSWORD = "admin123"

# Contact phone for expired trial message
CONTACT_PHONE = "718-916-1401"


class TestTrialRegistrationPage:
    """Test GET /api/prueba-gratis returns HTML registration page"""
    
    def test_prueba_gratis_returns_html(self):
        """GET /api/prueba-gratis should return HTML page with 200 status"""
        response = requests.get(f"{BASE_URL}/api/prueba-gratis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("content-type", ""), "Expected HTML content type"
        
    def test_prueba_gratis_contains_form(self):
        """Registration page should contain the trial form"""
        response = requests.get(f"{BASE_URL}/api/prueba-gratis")
        assert response.status_code == 200
        html = response.text
        assert "trialForm" in html, "Page should contain trial form"
        assert "15 Dias" in html or "15 dias" in html.lower(), "Page should mention 15 days"
        assert "companyName" in html, "Page should have company name field"
        assert "email" in html, "Page should have email field"
        assert "password" in html, "Page should have password field"
        
    def test_prueba_gratis_contains_features(self):
        """Registration page should list features"""
        response = requests.get(f"{BASE_URL}/api/prueba-gratis")
        html = response.text
        assert "Venta de boletos" in html or "boletos" in html.lower(), "Should mention ticket sales"
        assert "Reportes" in html or "reportes" in html.lower(), "Should mention reports"


class TestTrialRegistration:
    """Test POST /api/trial/register creates tenant + admin user + seeded data"""
    
    @pytest.fixture
    def unique_email(self):
        """Generate unique email for each test"""
        return f"test_trial_{uuid.uuid4().hex[:8]}@test.com"
    
    def test_register_trial_success(self, unique_email):
        """POST /api/trial/register should create tenant, admin user, and seeded data"""
        payload = {
            "company_name": "Test Banca Trial",
            "email": unique_email,
            "phone": "809-555-0001",
            "password": "test1234",
            "country": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "message" in data, "Response should have message"
        assert "token" in data, "Response should have token"
        assert "tenant_id" in data, "Response should have tenant_id"
        assert "trial_end" in data, "Response should have trial_end"
        assert "days_remaining" in data, "Response should have days_remaining"
        assert "user" in data, "Response should have user info"
        
        # Verify trial duration
        assert data["days_remaining"] == 15, f"Expected 15 days, got {data['days_remaining']}"
        
        # Verify user info
        user = data["user"]
        assert user["email"] == unique_email, "User email should match"
        assert user["role"] == "admin", "User should be admin"
        assert user["currency"] == "RD$", "Currency should be RD$ for RD country"
        
        return data
    
    def test_register_trial_creates_seeded_data(self, unique_email):
        """Trial registration should create seller, client, and 3 tickets"""
        payload = {
            "company_name": "Test Banca Seeded",
            "email": unique_email,
            "phone": "809-555-0002",
            "password": "test1234",
            "country": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        token = data["token"]
        
        # Verify tickets were created by fetching them
        headers = {"Authorization": f"Bearer {token}"}
        tickets_response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert tickets_response.status_code == 200, f"Failed to get tickets: {tickets_response.text}"
        
        tickets_data = tickets_response.json()
        # API returns {"tickets": [...]}
        tickets = tickets_data.get("tickets", tickets_data) if isinstance(tickets_data, dict) else tickets_data
        
        # Should have at least 3 seeded tickets
        assert len(tickets) >= 3, f"Expected at least 3 seeded tickets, got {len(tickets)}"
        
        # Verify ticket structure
        for ticket in tickets[:3]:
            assert "ticket_number" in ticket, "Ticket should have ticket_number"
            assert "DEMO" in ticket.get("ticket_number", ""), "Seeded tickets should have DEMO prefix"
            assert "seller_name" in ticket, "Ticket should have seller_name"
            assert "Vendedor Demo" in ticket.get("seller_name", ""), "Seller should be Vendedor Demo"
    
    def test_register_trial_us_country(self):
        """Trial registration with US country should use USD currency"""
        unique_email = f"test_trial_us_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "company_name": "Test Banca US",
            "email": unique_email,
            "phone": "718-555-0001",
            "password": "test1234",
            "country": "US"
        }
        response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["user"]["currency"] == "USD", "Currency should be USD for US country"
        assert data["user"]["country"] == "US", "Country should be US"


class TestTrialDuplicateEmail:
    """Test POST /api/trial/register blocks duplicate emails"""
    
    def test_duplicate_email_blocked(self):
        """Registering with same email twice should return 400"""
        unique_email = f"test_dup_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "company_name": "Test Banca Dup",
            "email": unique_email,
            "phone": "809-555-0003",
            "password": "test1234",
            "country": "RD"
        }
        
        # First registration should succeed
        response1 = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response1.status_code == 200, f"First registration failed: {response1.text}"
        
        # Second registration with same email should fail
        response2 = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        
        data = response2.json()
        assert "detail" in data, "Error response should have detail"
        assert "email" in data["detail"].lower() or "registrado" in data["detail"].lower(), \
            f"Error should mention email already registered: {data['detail']}"


class TestTrialStatus:
    """Test GET /api/trial/status returns trial info"""
    
    @pytest.fixture
    def trial_user_token(self):
        """Create a trial user and return token"""
        unique_email = f"test_status_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "company_name": "Test Banca Status",
            "email": unique_email,
            "phone": "809-555-0004",
            "password": "test1234",
            "country": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_trial_status_returns_info(self, trial_user_token):
        """GET /api/trial/status should return trial info for trial user"""
        headers = {"Authorization": f"Bearer {trial_user_token}"}
        response = requests.get(f"{BASE_URL}/api/trial/status", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_trial" in data, "Response should have is_trial"
        assert "days_remaining" in data, "Response should have days_remaining"
        assert "status" in data, "Response should have status"
        assert "contact_phone" in data, "Response should have contact_phone"
        
        # Verify values
        assert data["is_trial"] == True, "is_trial should be True for trial user"
        assert data["days_remaining"] == 15 or data["days_remaining"] == 14, \
            f"days_remaining should be 14-15, got {data['days_remaining']}"
        assert data["status"] == "active", f"status should be active, got {data['status']}"
        assert data["contact_phone"] == CONTACT_PHONE, f"contact_phone should be {CONTACT_PHONE}"


class TestTrialLogin:
    """Test POST /api/auth/login returns trial info for trial users"""
    
    def test_login_returns_trial_info(self):
        """Login for trial user should include trial info"""
        unique_email = f"test_login_{uuid.uuid4().hex[:8]}@test.com"
        password = "test1234"
        
        # First register
        payload = {
            "company_name": "Test Banca Login",
            "email": unique_email,
            "phone": "809-555-0005",
            "password": password,
            "country": "RD"
        }
        reg_response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert reg_response.status_code == 200
        
        # Now login
        login_payload = {"email": unique_email, "password": password}
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "token" in data, "Login should return token"
        assert "user" in data, "Login should return user"
        assert "trial" in data, "Login should return trial info for trial user"
        
        trial = data["trial"]
        assert trial["is_trial"] == True, "is_trial should be True"
        assert trial["days_remaining"] >= 14, f"days_remaining should be >= 14, got {trial['days_remaining']}"
        assert "trial_end" in trial, "trial info should have trial_end"


class TestExpiredTrialBlocking:
    """Test POST /api/auth/login blocks expired trial users with 403"""
    
    def test_expired_trial_login_blocked(self):
        """Login for expired trial user should return 403 with contact message"""
        import pymongo
        
        # Create a trial user
        unique_email = f"test_expired_{uuid.uuid4().hex[:8]}@test.com"
        password = "test1234"
        
        payload = {
            "company_name": "Test Banca Expired",
            "email": unique_email,
            "phone": "809-555-0006",
            "password": password,
            "country": "RD"
        }
        reg_response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert reg_response.status_code == 200
        
        tenant_id = reg_response.json()["tenant_id"]
        
        # Manually set trial_end to past date using pymongo
        mongo_client = pymongo.MongoClient("mongodb://localhost:27017")
        db = mongo_client["test_database"]
        
        past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        result = db.tenants.update_one(
            {"id": tenant_id},
            {"$set": {"trial_end": past_date, "status": "expired"}}
        )
        assert result.modified_count == 1, "Failed to update tenant trial_end"
        
        # Now try to login - should be blocked
        login_payload = {"email": unique_email, "password": password}
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        
        assert login_response.status_code == 403, \
            f"Expected 403 for expired trial, got {login_response.status_code}: {login_response.text}"
        
        data = login_response.json()
        assert "detail" in data, "Error should have detail"
        assert CONTACT_PHONE in data["detail"], \
            f"Error message should contain contact phone {CONTACT_PHONE}: {data['detail']}"
        assert "expirado" in data["detail"].lower() or "expired" in data["detail"].lower(), \
            f"Error should mention expired: {data['detail']}"
        
        mongo_client.close()
    
    def test_expired_trial_api_access_blocked(self):
        """API access for expired trial user should return 403"""
        import pymongo
        
        # Create a trial user
        unique_email = f"test_expired_api_{uuid.uuid4().hex[:8]}@test.com"
        password = "test1234"
        
        payload = {
            "company_name": "Test Banca Expired API",
            "email": unique_email,
            "phone": "809-555-0007",
            "password": password,
            "country": "RD"
        }
        reg_response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert reg_response.status_code == 200
        
        token = reg_response.json()["token"]
        tenant_id = reg_response.json()["tenant_id"]
        
        # Manually set trial_end to past date
        mongo_client = pymongo.MongoClient("mongodb://localhost:27017")
        db = mongo_client["test_database"]
        
        past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        db.tenants.update_one(
            {"id": tenant_id},
            {"$set": {"trial_end": past_date, "status": "expired"}}
        )
        
        # Try to access API with the token - should be blocked
        headers = {"Authorization": f"Bearer {token}"}
        tickets_response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
        
        assert tickets_response.status_code == 403, \
            f"Expected 403 for expired trial API access, got {tickets_response.status_code}"
        
        data = tickets_response.json()
        assert CONTACT_PHONE in data.get("detail", ""), \
            f"Error should contain contact phone: {data}"
        
        mongo_client.close()


class TestMasterAdminNoTrialRestrictions:
    """Test master admin works normally without trial restrictions"""
    
    def test_master_admin_login_success(self):
        """Master admin login should work without trial info"""
        login_payload = {"email": MASTER_ADMIN_EMAIL, "password": MASTER_ADMIN_PASSWORD}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        
        assert response.status_code == 200, f"Master admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Login should return token"
        assert "user" in data, "Login should return user"
        
        # Master admin should NOT have trial info (or trial should be None/missing)
        # Since master admin has no tenant_id, trial info should not be present
        if "trial" in data:
            assert data["trial"] is None or data["trial"].get("is_trial") == False, \
                "Master admin should not have trial restrictions"
    
    def test_master_admin_trial_status_not_trial(self):
        """GET /api/trial/status for master admin should return is_trial=false"""
        # Login as master admin
        login_payload = {"email": MASTER_ADMIN_EMAIL, "password": MASTER_ADMIN_PASSWORD}
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        token = login_response.json()["token"]
        
        # Get trial status
        headers = {"Authorization": f"Bearer {token}"}
        status_response = requests.get(f"{BASE_URL}/api/trial/status", headers=headers)
        assert status_response.status_code == 200, f"Trial status failed: {status_response.text}"
        
        data = status_response.json()
        assert data["is_trial"] == False, f"Master admin is_trial should be False, got {data['is_trial']}"
        assert data["status"] == "full", f"Master admin status should be 'full', got {data['status']}"
    
    def test_master_admin_can_access_all_apis(self):
        """Master admin should have full API access"""
        # Login as master admin
        login_payload = {"email": MASTER_ADMIN_EMAIL, "password": MASTER_ADMIN_PASSWORD}
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test various endpoints
        endpoints = [
            "/api/tickets",
            "/api/users",
            "/api/lotteries",
            "/api/statistics/dashboard"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code in [200, 404], \
                f"Master admin should access {endpoint}, got {response.status_code}: {response.text}"


class TestTrialTicketsAccess:
    """Test GET /api/tickets returns seeded tickets for trial admin user"""
    
    def test_trial_user_sees_seeded_tickets(self):
        """Trial user should see their seeded demo tickets"""
        unique_email = f"test_tickets_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "company_name": "Test Banca Tickets",
            "email": unique_email,
            "phone": "809-555-0008",
            "password": "test1234",
            "country": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/trial/register", json=payload)
        assert response.status_code == 200
        
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get tickets
        tickets_response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert tickets_response.status_code == 200
        
        tickets_data = tickets_response.json()
        # API returns {"tickets": [...]}
        tickets = tickets_data.get("tickets", tickets_data) if isinstance(tickets_data, dict) else tickets_data
        assert len(tickets) >= 3, f"Should have at least 3 seeded tickets, got {len(tickets)}"
        
        # Verify tickets are demo tickets
        demo_tickets = [t for t in tickets if "DEMO" in t.get("ticket_number", "")]
        assert len(demo_tickets) >= 3, f"Should have at least 3 DEMO tickets, got {len(demo_tickets)}"
        
        # Verify ticket statuses (should have pending, won, lost)
        statuses = set(t.get("status") for t in demo_tickets)
        assert "pending" in statuses or "won" in statuses or "lost" in statuses, \
            f"Demo tickets should have various statuses, got {statuses}"


class TestTrialDataIsolation:
    """Test that trial data is isolated by tenant"""
    
    def test_trial_users_see_only_their_data(self):
        """Two trial users should not see each other's data"""
        # Create first trial user
        email1 = f"test_iso1_{uuid.uuid4().hex[:8]}@test.com"
        payload1 = {
            "company_name": "Banca Isolation 1",
            "email": email1,
            "phone": "809-555-0010",
            "password": "test1234",
            "country": "RD"
        }
        resp1 = requests.post(f"{BASE_URL}/api/trial/register", json=payload1)
        assert resp1.status_code == 200
        token1 = resp1.json()["token"]
        tenant1 = resp1.json()["tenant_id"]
        
        # Create second trial user
        email2 = f"test_iso2_{uuid.uuid4().hex[:8]}@test.com"
        payload2 = {
            "company_name": "Banca Isolation 2",
            "email": email2,
            "phone": "809-555-0011",
            "password": "test1234",
            "country": "RD"
        }
        resp2 = requests.post(f"{BASE_URL}/api/trial/register", json=payload2)
        assert resp2.status_code == 200
        token2 = resp2.json()["token"]
        tenant2 = resp2.json()["tenant_id"]
        
        # Verify different tenant IDs
        assert tenant1 != tenant2, "Each trial should have unique tenant_id"
        
        # Get tickets for user 1
        headers1 = {"Authorization": f"Bearer {token1}"}
        tickets1_resp = requests.get(f"{BASE_URL}/api/tickets", headers=headers1)
        assert tickets1_resp.status_code == 200
        tickets1_data = tickets1_resp.json()
        tickets1 = tickets1_data.get("tickets", tickets1_data) if isinstance(tickets1_data, dict) else tickets1_data
        
        # Get tickets for user 2
        headers2 = {"Authorization": f"Bearer {token2}"}
        tickets2_resp = requests.get(f"{BASE_URL}/api/tickets", headers=headers2)
        assert tickets2_resp.status_code == 200
        tickets2_data = tickets2_resp.json()
        tickets2 = tickets2_data.get("tickets", tickets2_data) if isinstance(tickets2_data, dict) else tickets2_data
        
        # Verify tickets are different (different ticket numbers)
        ticket_nums1 = set(t.get("ticket_number") for t in tickets1)
        ticket_nums2 = set(t.get("ticket_number") for t in tickets2)
        
        # There should be no overlap in ticket numbers
        overlap = ticket_nums1.intersection(ticket_nums2)
        assert len(overlap) == 0, f"Trial users should have isolated data, found overlap: {overlap}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

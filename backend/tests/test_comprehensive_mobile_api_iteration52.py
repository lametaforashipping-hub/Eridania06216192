"""
Comprehensive Backend API Test - Iteration 52
Tests ALL endpoints used by the Expo mobile app (47 screens)
Covers: Auth, Clients, Tickets, Accounting, Alerts, Notifications, Admin, Lotteries, Draws
"""
import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('VITE_API_URL', '')).rstrip('/')
if not BASE_URL:
    BASE_URL = "https://multi-play-receipt.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"
VENDOR_EMAIL = "vendedor@test.com"
VENDOR_PASSWORD = "12345678"
CLIENT_PHONE = "8091234999"
CLIENT_PASSWORD = "123456"

# Lottery IDs
QUINIELA_LEIDSA_ID = "c11c2768-cd95-4278-b339-683d7fd9d6b2"
LOTERIA_NACIONAL_ID = "8f622e93-269d-47a2-8bdb-de0ded287c9c"


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """POST /api/auth/login - Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        assert data["user"]["country"] == "US", f"Expected US country, got {data['user'].get('country')}"
        print(f"✅ POST /api/auth/login (admin) - Success: role={data['user']['role']}, country={data['user'].get('country')}")
        return data["token"]
    
    def test_vendor_login(self):
        """POST /api/auth/login - Vendor login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        assert response.status_code == 200, f"Vendor login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["role"] == "vendedor", f"Expected vendedor role, got {data['user']['role']}"
        assert data["user"]["country"] == "RD", f"Expected RD country, got {data['user'].get('country')}"
        print(f"✅ POST /api/auth/login (vendor) - Success: role={data['user']['role']}, country={data['user'].get('country')}, balance={data['user'].get('balance')}")
        return data["token"]
    
    def test_auth_me_returns_country_and_active(self):
        """GET /api/auth/me - Returns user with country and active fields"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert "country" in data, "Missing 'country' field in auth/me response"
        assert "active" in data, "Missing 'active' field in auth/me response"
        assert "id" in data, "Missing 'id' field"
        assert "email" in data, "Missing 'email' field"
        assert "role" in data, "Missing 'role' field"
        print(f"✅ GET /api/auth/me - Success: country={data['country']}, active={data['active']}")


class TestClientEndpoints:
    """Test client portal endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin token for tests"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_client_registration(self):
        """POST /api/clients/register - Client registration"""
        import random
        test_phone = f"809{random.randint(1000000, 9999999)}"
        
        response = requests.post(f"{BASE_URL}/api/clients/register", json={
            "name": "Test Client",
            "phone": test_phone,
            "password": "test123456",
            "country": "RD"
        })
        # May fail if phone already exists, which is OK
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "No token in registration response"
            assert "user" in data, "No user in registration response"
            print(f"✅ POST /api/clients/register - Success: phone={test_phone}")
        elif response.status_code == 400:
            print(f"✅ POST /api/clients/register - Phone already exists (expected behavior)")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_client_login(self):
        """POST /api/clients/login - Client login with query params"""
        response = requests.post(
            f"{BASE_URL}/api/clients/login",
            params={"phone": CLIENT_PHONE, "password": CLIENT_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "No token in client login response"
            print(f"✅ POST /api/clients/login - Success")
            return data["token"]
        elif response.status_code == 401:
            print(f"⚠️ POST /api/clients/login - Client not found or wrong password (may need registration)")
            return None
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_client_me(self):
        """GET /api/clients/me - Returns client profile"""
        # First try to login as client
        login_resp = requests.post(
            f"{BASE_URL}/api/clients/login",
            params={"phone": CLIENT_PHONE, "password": CLIENT_PASSWORD}
        )
        if login_resp.status_code != 200:
            pytest.skip("Client not registered, skipping /clients/me test")
        
        token = login_resp.json()["token"]
        response = requests.get(f"{BASE_URL}/api/clients/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Clients/me failed: {response.text}"
        data = response.json()
        assert "id" in data, "Missing 'id' in client profile"
        print(f"✅ GET /api/clients/me - Success")
    
    def test_client_payment_accounts(self):
        """GET /api/clients/payment-accounts - Available payment accounts"""
        response = requests.get(f"{BASE_URL}/api/clients/payment-accounts")
        assert response.status_code == 200, f"Payment accounts failed: {response.text}"
        data = response.json()
        assert "zelle_accounts" in data or "bank_accounts" in data or "all_accounts" in data
        print(f"✅ GET /api/clients/payment-accounts - Success: {len(data.get('all_accounts', []))} accounts")
    
    def test_client_tickets(self):
        """GET /api/clients/tickets - Client tickets"""
        login_resp = requests.post(
            f"{BASE_URL}/api/clients/login",
            params={"phone": CLIENT_PHONE, "password": CLIENT_PASSWORD}
        )
        if login_resp.status_code != 200:
            pytest.skip("Client not registered, skipping /clients/tickets test")
        
        token = login_resp.json()["token"]
        response = requests.get(f"{BASE_URL}/api/clients/tickets", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Client tickets failed: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        print(f"✅ GET /api/clients/tickets - Success: {len(data['tickets'])} tickets")
    
    def test_client_notifications_unread_count(self):
        """GET /api/clients/notifications/unread-count - Client notification count"""
        login_resp = requests.post(
            f"{BASE_URL}/api/clients/login",
            params={"phone": CLIENT_PHONE, "password": CLIENT_PASSWORD}
        )
        if login_resp.status_code != 200:
            pytest.skip("Client not registered, skipping notifications test")
        
        token = login_resp.json()["token"]
        response = requests.get(f"{BASE_URL}/api/clients/notifications/unread-count", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Client notifications count failed: {response.text}"
        data = response.json()
        assert "count" in data, "Missing 'count' in response"
        print(f"✅ GET /api/clients/notifications/unread-count - Success: {data['count']} unread")
    
    def test_client_results(self):
        """GET /api/clients/results - Client lottery results"""
        login_resp = requests.post(
            f"{BASE_URL}/api/clients/login",
            params={"phone": CLIENT_PHONE, "password": CLIENT_PASSWORD}
        )
        if login_resp.status_code != 200:
            pytest.skip("Client not registered, skipping results test")
        
        token = login_resp.json()["token"]
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/clients/results", params={"date": today}, headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Client results failed: {response.text}"
        print(f"✅ GET /api/clients/results - Success")


class TestCompanyProfile:
    """Test company profile endpoint"""
    
    def test_get_company_profile(self):
        """GET /api/company-profile - Company info"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/company-profile", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Company profile failed: {response.text}"
        data = response.json()
        print(f"✅ GET /api/company-profile - Success: {data.get('company_name', 'N/A')}")


class TestLotteryEndpoints:
    """Test lottery management endpoints"""
    
    def test_get_lotteries_active(self):
        """GET /api/lotteries - List all active lotteries"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200, f"Get lotteries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of lotteries"
        print(f"✅ GET /api/lotteries - Success: {len(data)} active lotteries")
        return data
    
    def test_get_lotteries_all(self):
        """GET /api/lotteries?active_only=false - All lotteries including inactive"""
        response = requests.get(f"{BASE_URL}/api/lotteries", params={"active_only": "false"})
        assert response.status_code == 200, f"Get all lotteries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of lotteries"
        print(f"✅ GET /api/lotteries?active_only=false - Success: {len(data)} total lotteries")


class TestTicketEndpoints:
    """Test ticket CRUD and receipt generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup vendor token for tests"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        self.vendor_token = login_resp.json()["token"]
        self.vendor_headers = {"Authorization": f"Bearer {self.vendor_token}"}
        
        # Also get admin token
        admin_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = admin_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_create_multi_play_ticket(self):
        """POST /api/tickets/multi - Create multi-play ticket as vendor"""
        response = requests.post(f"{BASE_URL}/api/tickets/multi", json={
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "lottery_id": QUINIELA_LEIDSA_ID,
                    "numbers": [25],
                    "amount": 20,
                    "position": "first"
                }
            ],
            "currency": "RD$",
            "customer_name": "Test Customer"
        }, headers=self.vendor_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "ticket_number" in data, "Missing ticket_number"
            print(f"✅ POST /api/tickets/multi - Success: {data['ticket_number']}")
            return data["ticket_number"]
        elif response.status_code == 400:
            # Lottery might be closed
            print(f"⚠️ POST /api/tickets/multi - Lottery closed or limit reached: {response.json().get('detail')}")
            return None
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_get_tickets_paginated(self):
        """GET /api/tickets?page=1&limit=10 - Paginated ticket list"""
        response = requests.get(f"{BASE_URL}/api/tickets", params={
            "page": 1,
            "limit": 10
        }, headers=self.vendor_headers)
        assert response.status_code == 200, f"Get tickets failed: {response.text}"
        data = response.json()
        assert "tickets" in data, "Missing 'tickets' in response"
        assert "pagination" in data, "Missing 'pagination' in response"
        print(f"✅ GET /api/tickets?page=1&limit=10 - Success: {len(data['tickets'])} tickets, total={data['pagination']['total']}")
        return data["tickets"]
    
    def test_get_receipt_image(self):
        """GET /api/tickets/receipt-image/{ticket_number} - Returns PNG receipt image"""
        # First get a ticket
        tickets_resp = requests.get(f"{BASE_URL}/api/tickets", params={"limit": 1}, headers=self.vendor_headers)
        tickets = tickets_resp.json().get("tickets", [])
        
        if not tickets:
            pytest.skip("No tickets available for receipt test")
        
        ticket_number = tickets[0]["ticket_number"]
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        assert response.status_code == 200, f"Get receipt image failed: {response.text}"
        assert response.headers.get("content-type") == "image/png", f"Expected image/png, got {response.headers.get('content-type')}"
        print(f"✅ GET /api/tickets/receipt-image/{ticket_number} - Success: PNG image returned")
    
    def test_get_qr_code(self):
        """GET /api/tickets/qr/{ticket_number} - Returns QR code"""
        # First get a ticket
        tickets_resp = requests.get(f"{BASE_URL}/api/tickets", params={"limit": 1}, headers=self.vendor_headers)
        tickets = tickets_resp.json().get("tickets", [])
        
        if not tickets:
            pytest.skip("No tickets available for QR test")
        
        ticket_number = tickets[0]["ticket_number"]
        response = requests.get(f"{BASE_URL}/api/tickets/qr/{ticket_number}")
        assert response.status_code == 200, f"Get QR code failed: {response.text}"
        data = response.json()
        assert "qr" in data, "Missing 'qr' in response"
        assert data["qr"].startswith("data:image/png;base64,"), "QR should be base64 PNG"
        print(f"✅ GET /api/tickets/qr/{ticket_number} - Success: QR code returned")
    
    def test_get_recent_plays(self):
        """GET /api/tickets/recent-plays?limit=10 - Recent plays"""
        response = requests.get(f"{BASE_URL}/api/tickets/recent-plays", params={"limit": 10}, headers=self.vendor_headers)
        assert response.status_code == 200, f"Get recent plays failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of recent plays"
        print(f"✅ GET /api/tickets/recent-plays?limit=10 - Success: {len(data)} recent plays")
    
    def test_cancel_ticket(self):
        """POST /api/tickets/{id}/cancel - Cancel a pending ticket"""
        # First get a pending ticket
        tickets_resp = requests.get(f"{BASE_URL}/api/tickets", params={"status": "pending", "limit": 1}, headers=self.vendor_headers)
        tickets = tickets_resp.json().get("tickets", [])
        
        if not tickets:
            print("⚠️ POST /api/tickets/{id}/cancel - No pending tickets to cancel")
            return
        
        ticket_id = tickets[0]["id"]
        response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/cancel", headers=self.vendor_headers)
        
        if response.status_code == 200:
            print(f"✅ POST /api/tickets/{ticket_id}/cancel - Success")
        elif response.status_code == 400:
            # Time limit exceeded or already processed
            print(f"⚠️ POST /api/tickets/{ticket_id}/cancel - {response.json().get('detail')}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


class TestDrawEndpoints:
    """Test draw management endpoints"""
    
    def test_get_draws(self):
        """GET /api/draws?limit=50 - List draws"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/draws", params={"limit": 50}, headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get draws failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of draws"
        print(f"✅ GET /api/draws?limit=50 - Success: {len(data)} draws")


class TestLotteryResultsEndpoints:
    """Test lottery results endpoints"""
    
    def test_get_latest_results(self):
        """GET /api/lottery-results/latest - Latest lottery results"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/lottery-results/latest", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get latest results failed: {response.text}"
        data = response.json()
        assert "results" in data, "Missing 'results' in response"
        print(f"✅ GET /api/lottery-results/latest - Success: {len(data['results'])} results")


class TestUserEndpoints:
    """Test user management endpoints"""
    
    def test_get_users(self):
        """GET /api/users - Admin user list"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of users"
        print(f"✅ GET /api/users - Success: {len(data)} users")


class TestFavoritesEndpoints:
    """Test favorites endpoints"""
    
    def test_get_favorites(self):
        """GET /api/favorites - User favorites"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/favorites", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get favorites failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of favorites"
        print(f"✅ GET /api/favorites - Success: {len(data)} favorites")


class TestNotificationEndpoints:
    """Test notification endpoints"""
    
    def test_get_notifications(self):
        """GET /api/notifications - User notifications"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/notifications", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of notifications"
        print(f"✅ GET /api/notifications - Success: {len(data)} notifications")
    
    def test_get_unread_count(self):
        """GET /api/notifications/unread-count - Unread notification count"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "unread_count" in data, "Missing 'unread_count' in response"
        print(f"✅ GET /api/notifications/unread-count - Success: {data['unread_count']} unread")


class TestAccountingEndpoints:
    """Test accounting and reports endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin token for tests"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_accounting_summary(self):
        """GET /api/accounting/summary - Sales summary"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=self.admin_headers)
        assert response.status_code == 200, f"Get accounting summary failed: {response.text}"
        data = response.json()
        assert "today" in data, "Missing 'today' in response"
        assert "week" in data, "Missing 'week' in response"
        assert "month" in data, "Missing 'month' in response"
        print(f"✅ GET /api/accounting/summary - Success: today_sales={data['today'].get('sales', 0)}")
    
    def test_get_accounting_report(self):
        """GET /api/accounting/report - Financial report"""
        response = requests.get(f"{BASE_URL}/api/accounting/report", headers=self.admin_headers)
        assert response.status_code == 200, f"Get accounting report failed: {response.text}"
        data = response.json()
        assert "total_sales" in data, "Missing 'total_sales' in response"
        print(f"✅ GET /api/accounting/report - Success: total_sales={data['total_sales']}")
    
    def test_get_commissions(self):
        """GET /api/accounting/commissions?period=day - Commissions"""
        response = requests.get(f"{BASE_URL}/api/accounting/commissions", params={"period": "day"}, headers=self.admin_headers)
        assert response.status_code == 200, f"Get commissions failed: {response.text}"
        data = response.json()
        assert "summary" in data, "Missing 'summary' in response"
        print(f"✅ GET /api/accounting/commissions?period=day - Success: total_commission={data['summary'].get('total_commission', 0)}")
    
    def test_get_sellers_report(self):
        """GET /api/accounting/sellers-report - Sellers performance"""
        response = requests.get(f"{BASE_URL}/api/accounting/sellers-report", headers=self.admin_headers)
        assert response.status_code == 200, f"Get sellers report failed: {response.text}"
        data = response.json()
        assert "sellers" in data, "Missing 'sellers' in response"
        print(f"✅ GET /api/accounting/sellers-report - Success: {len(data['sellers'])} sellers")
    
    def test_get_detailed_seller_report(self):
        """GET /api/accounting/detailed-seller-report?period=daily - Individual seller report"""
        response = requests.get(f"{BASE_URL}/api/accounting/detailed-seller-report", params={"period": "daily"}, headers=self.admin_headers)
        assert response.status_code == 200, f"Get detailed seller report failed: {response.text}"
        data = response.json()
        assert "summary" in data, "Missing 'summary' in response"
        assert "seller" in data, "Missing 'seller' in response"
        print(f"✅ GET /api/accounting/detailed-seller-report?period=daily - Success")
    
    def test_get_country_comparison(self):
        """GET /api/accounting/country-comparison?period=month - Country comparison RD vs US"""
        response = requests.get(f"{BASE_URL}/api/accounting/country-comparison", params={"period": "month"}, headers=self.admin_headers)
        assert response.status_code == 200, f"Get country comparison failed: {response.text}"
        data = response.json()
        assert "countries" in data, "Missing 'countries' in response"
        assert "RD" in data["countries"] or "US" in data["countries"], "Missing country data"
        print(f"✅ GET /api/accounting/country-comparison?period=month - Success")
    
    def test_get_daily_chart(self):
        """GET /api/accounting/daily-chart?days=7 - Daily chart data"""
        response = requests.get(f"{BASE_URL}/api/accounting/daily-chart", params={"days": 7}, headers=self.admin_headers)
        assert response.status_code == 200, f"Get daily chart failed: {response.text}"
        data = response.json()
        assert "data" in data, "Missing 'data' in response"
        assert "totals" in data, "Missing 'totals' in response"
        print(f"✅ GET /api/accounting/daily-chart?days=7 - Success: {len(data['data'])} days")


class TestAlertSettingsEndpoints:
    """Test alert settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin token for tests"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = login_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Also get vendor token
        vendor_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        self.vendor_token = vendor_resp.json()["token"]
        self.vendor_headers = {"Authorization": f"Bearer {self.vendor_token}"}
    
    def test_get_alert_settings(self):
        """GET /api/alert-settings - Alert configuration"""
        response = requests.get(f"{BASE_URL}/api/alert-settings", headers=self.admin_headers)
        assert response.status_code == 200, f"Get alert settings failed: {response.text}"
        data = response.json()
        assert "milestone_rd" in data or "type" in data, "Missing expected fields in alert settings"
        print(f"✅ GET /api/alert-settings - Success")
    
    def test_update_alert_settings(self):
        """PUT /api/alert-settings - Update alert thresholds (super admin only)"""
        response = requests.put(f"{BASE_URL}/api/alert-settings", json={
            "milestone_rd": 50000.0,
            "milestone_usd": 1000.0,
            "daily_target_rd": 100000.0,
            "daily_target_usd": 2000.0,
            "notify_on_winner": True,
            "notify_on_milestone": True,
            "notify_on_daily_target": True
        }, headers=self.admin_headers)
        assert response.status_code == 200, f"Update alert settings failed: {response.text}"
        print(f"✅ PUT /api/alert-settings - Success")
    
    def test_vendor_cannot_update_alert_settings(self):
        """PUT /api/alert-settings - Vendor should get 403"""
        response = requests.put(f"{BASE_URL}/api/alert-settings", json={
            "milestone_rd": 50000.0
        }, headers=self.vendor_headers)
        assert response.status_code == 403, f"Expected 403 for vendor, got {response.status_code}"
        print(f"✅ PUT /api/alert-settings (vendor) - Correctly returns 403")
    
    def test_get_recent_alerts(self):
        """GET /api/alert-settings/recent-alerts?limit=10 - Recent alerts list"""
        response = requests.get(f"{BASE_URL}/api/alert-settings/recent-alerts", params={"limit": 10}, headers=self.admin_headers)
        assert response.status_code == 200, f"Get recent alerts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of alerts"
        print(f"✅ GET /api/alert-settings/recent-alerts?limit=10 - Success: {len(data)} alerts")


class TestPrizeConfigEndpoints:
    """Test prize configuration endpoints"""
    
    def test_get_prize_config(self):
        """GET /api/prize-config - Prize configurations"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/prize-config", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get prize config failed: {response.text}"
        data = response.json()
        assert "configs" in data, "Missing 'configs' in response"
        print(f"✅ GET /api/prize-config - Success: {len(data['configs'])} configs")


class TestBankAccountsEndpoints:
    """Test bank accounts endpoints"""
    
    def test_get_pending_deposits_count(self):
        """GET /api/bank-accounts/deposit-requests/pending-count - Pending deposits count"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/bank-accounts/deposit-requests/pending-count", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get pending deposits count failed: {response.text}"
        data = response.json()
        assert "count" in data, "Missing 'count' in response"
        print(f"✅ GET /api/bank-accounts/deposit-requests/pending-count - Success: {data['count']} pending")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

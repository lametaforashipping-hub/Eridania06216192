"""
Test cases for ticket creation (/api/tickets/multi) and detailed seller report
Testing: 
- Multi-play ticket creation
- Ticket verification via /api/tickets/verify
- Detailed seller report endpoint
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
SELLER_CREDENTIALS = {"email": "vendedor@test.com", "password": "12345678"}
SUPER_ADMIN_CREDENTIALS = {"email": "admin@loteria.com", "password": "admin123"}


@pytest.fixture(scope="module")
def seller_token():
    """Get seller auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SELLER_CREDENTIALS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Seller login failed: {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get super admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDENTIALS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.text}")


@pytest.fixture(scope="module")
def lotteries(admin_token):
    """Get available lotteries"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/lotteries", headers=headers)
    if response.status_code == 200:
        return response.json()
    pytest.skip(f"Failed to get lotteries: {response.text}")


class TestSellerLogin:
    """Test seller authentication"""
    
    def test_seller_login_success(self):
        """Test seller can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SELLER_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        print(f"Seller login successful: {data['user'].get('name')}")
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Admin login successful: {data['user'].get('name')}")


class TestMultiPlayTicketCreation:
    """Test /api/tickets/multi endpoint"""
    
    def test_create_multi_play_ticket_success(self, seller_token, lotteries):
        """Test creating a multi-play ticket"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        
        # Find an active lottery with quiniela type
        quiniela_lottery = None
        for lottery in lotteries:
            if lottery.get("active") and lottery.get("lottery_type") == "quiniela":
                quiniela_lottery = lottery
                break
        
        if not quiniela_lottery:
            # Use the first active lottery
            for lottery in lotteries:
                if lottery.get("active"):
                    quiniela_lottery = lottery
                    break
        
        if not quiniela_lottery:
            pytest.skip("No active lotteries found")
        
        # Create multi-play ticket
        payload = {
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "lottery_id": quiniela_lottery.get("id"),
                    "numbers": [42],
                    "amount": 50.0,
                    "position": None
                }
            ],
            "currency": "RD$",
            "customer_name": "TEST_Customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", headers=headers, json=payload)
        print(f"Multi-play response status: {response.status_code}")
        print(f"Multi-play response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to create multi-play ticket: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "ticket_number" in data, "Missing ticket_number"
        assert "plays" in data, "Missing plays"
        assert "total_amount" in data, "Missing total_amount"
        assert data["total_amount"] == 50.0, f"Expected 50.0, got {data['total_amount']}"
        
        # Store ticket number for verification test
        TestMultiPlayTicketCreation.created_ticket_number = data["ticket_number"]
        print(f"Created ticket: {data['ticket_number']}")
        
        return data
    
    def test_create_multi_play_with_multiple_plays(self, seller_token, lotteries):
        """Test creating a ticket with multiple plays"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        
        # Find any active lottery
        active_lottery = next((l for l in lotteries if l.get("active")), None)
        if not active_lottery:
            pytest.skip("No active lotteries found")
        
        payload = {
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "lottery_id": active_lottery.get("id"),
                    "numbers": [25],
                    "amount": 25.0
                },
                {
                    "lottery_type": "quiniela",
                    "lottery_id": active_lottery.get("id"),
                    "numbers": [50],
                    "amount": 25.0
                }
            ],
            "currency": "RD$",
            "customer_name": "TEST_MultiPlay"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", headers=headers, json=payload)
        print(f"Multiple plays response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert len(data.get("plays", [])) == 2, "Expected 2 plays"
            assert data.get("total_amount") == 50.0, "Expected total 50.0"
            print(f"Created multi-play ticket with 2 plays: {data['ticket_number']}")
        else:
            # May fail due to lottery hours - log but don't fail test
            print(f"Multi-play failed (may be lottery hours): {response.text[:200]}")
            if "cerrada" in response.text.lower() or "closed" in response.text.lower():
                pytest.skip("Lottery is closed")
            else:
                assert False, f"Unexpected error: {response.text}"
    
    def test_create_multi_play_no_auth(self):
        """Test multi-play creation without authentication fails"""
        payload = {
            "plays": [{"lottery_type": "quiniela", "numbers": [1], "amount": 10.0}],
            "currency": "RD$"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", json=payload)
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("Correctly rejected unauthenticated request")
    
    def test_create_multi_play_empty_plays(self, seller_token):
        """Test multi-play with empty plays array fails"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        payload = {
            "plays": [],
            "currency": "RD$"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", headers=headers, json=payload)
        assert response.status_code == 400, f"Expected 400 for empty plays, got {response.status_code}"
        print("Correctly rejected empty plays")


class TestTicketVerification:
    """Test /api/tickets/verify/{ticket_number} endpoint"""
    
    def test_verify_existing_ticket(self, seller_token, lotteries):
        """Test verifying an existing ticket"""
        # First create a ticket to verify
        headers = {"Authorization": f"Bearer {seller_token}"}
        
        active_lottery = next((l for l in lotteries if l.get("active")), None)
        if not active_lottery:
            pytest.skip("No active lotteries")
        
        payload = {
            "plays": [{"lottery_type": "quiniela", "lottery_id": active_lottery.get("id"), "numbers": [77], "amount": 25.0}],
            "currency": "RD$",
            "customer_name": "TEST_Verify"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/tickets/multi", headers=headers, json=payload)
        
        if create_response.status_code != 200:
            # Check if we have a previously created ticket
            if hasattr(TestMultiPlayTicketCreation, 'created_ticket_number'):
                ticket_number = TestMultiPlayTicketCreation.created_ticket_number
            else:
                pytest.skip(f"Cannot create ticket to verify: {create_response.text[:200]}")
        else:
            ticket_number = create_response.json()["ticket_number"]
        
        # Now verify the ticket - this is a public endpoint (no auth required)
        verify_response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        print(f"Verify response status: {verify_response.status_code}")
        print(f"Verify response: {verify_response.text[:500]}")
        
        assert verify_response.status_code == 200, f"Verify failed: {verify_response.text}"
        data = verify_response.json()
        
        # Validate response structure
        assert "ticket_number" in data
        assert "status" in data
        assert "lottery_name" in data
        assert "amount" in data
        assert "message" in data
        
        print(f"Verified ticket {ticket_number}: status={data['status']}")
    
    def test_verify_nonexistent_ticket(self):
        """Test verifying a non-existent ticket returns 404"""
        response = requests.get(f"{BASE_URL}/api/tickets/verify/TKT-NONEXISTENT-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent ticket")


class TestDetailedSellerReport:
    """Test /api/accounting/detailed-seller-report endpoint"""
    
    def test_detailed_seller_report_exists(self, seller_token):
        """Test that detailed-seller-report endpoint exists"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        
        response = requests.get(f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily", headers=headers)
        print(f"Detailed seller report status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        # CRITICAL: This endpoint returns 404 - it doesn't exist!
        if response.status_code == 404:
            pytest.fail("CRITICAL: /api/accounting/detailed-seller-report endpoint does NOT exist in backend!")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate expected structure
        assert "summary" in data, "Missing summary"
        assert "ticket_counts" in data, "Missing ticket_counts"
    
    def test_detailed_seller_report_periods(self, seller_token):
        """Test detailed-seller-report with different periods"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        
        for period in ["daily", "weekly", "biweekly", "monthly"]:
            response = requests.get(
                f"{BASE_URL}/api/accounting/detailed-seller-report?period={period}",
                headers=headers
            )
            print(f"Period {period}: status={response.status_code}")
            
            if response.status_code == 404:
                pytest.fail(f"Endpoint missing for period={period}")


class TestAccountingEndpoints:
    """Test other accounting endpoints"""
    
    def test_accounting_summary(self, seller_token):
        """Test /api/accounting/summary endpoint"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        
        assert response.status_code == 200, f"Summary failed: {response.text}"
        data = response.json()
        
        assert "today" in data
        assert "week" in data
        assert "month" in data
        print(f"Accounting summary: today sales={data['today'].get('sales', 0)}")
    
    def test_daily_chart(self, seller_token):
        """Test /api/accounting/daily-chart endpoint"""
        headers = {"Authorization": f"Bearer {seller_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/daily-chart?days=7", headers=headers)
        
        assert response.status_code == 200, f"Daily chart failed: {response.text}"
        data = response.json()
        
        assert "data" in data
        assert len(data["data"]) == 7, f"Expected 7 days, got {len(data['data'])}"
        print("Daily chart data retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

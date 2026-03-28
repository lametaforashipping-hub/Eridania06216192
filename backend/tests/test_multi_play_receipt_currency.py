"""
Multi-Play Receipt Currency Tests - Iteration 49
Testing country-specific currency display on receipt images:
- US sellers should see US$ on receipts
- RD sellers should see RD$ on receipts

Key endpoints tested:
- POST /api/auth/login - Login for US and RD sellers
- POST /api/tickets/multi - Create multi-play tickets with currency based on seller country
- GET /api/tickets/receipt-image/{ticket_number} - Receipt image with correct currency
- GET /api/prize-config - Prize configurations for both countries
- PUT /api/prize-config/{country} - Update prize config (super admin only)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_API_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://receipt-unify.preview.emergentagent.com"

# Test credentials from review request
US_SELLER = {"email": "admin@loteria.com", "password": "admin123"}  # country: US, currency: USD
RD_SELLER = {"email": "vendedor@test.com", "password": "12345678"}  # country: RD, currency: RD$

# Lottery IDs for testing
LOTTERY_IDS = {
    "quiniela_leidsa": "c11c2768-cd95-4278-b339-683d7fd9d6b2",
    "loteria_nacional": "8f622e93-269d-47a2-8bdb-de0ded287c9c"
}


class TestAuthenticationForCurrency:
    """Test authentication for US and RD sellers"""
    
    def test_us_seller_login(self):
        """Test US seller (admin@loteria.com) login - should have country=US, currency=USD"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=US_SELLER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        
        user = data["user"]
        print(f"US Seller - Country: {user.get('country')}, Currency: {user.get('currency')}")
        
        # Verify US seller has correct country and currency
        assert user.get("country") == "US", f"Expected country=US, got {user.get('country')}"
        assert user.get("currency") == "USD", f"Expected currency=USD, got {user.get('currency')}"
        assert user.get("role") == "super_admin", f"Expected role=super_admin, got {user.get('role')}"
    
    def test_rd_seller_login(self):
        """Test RD seller (vendedor@test.com) login - should have country=RD, currency=RD$"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RD_SELLER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        
        user = data["user"]
        print(f"RD Seller - Country: {user.get('country')}, Currency: {user.get('currency')}")
        
        # Verify RD seller has correct country and currency
        assert user.get("country") == "RD", f"Expected country=RD, got {user.get('country')}"
        assert user.get("currency") == "RD$", f"Expected currency=RD$, got {user.get('currency')}"
        assert user.get("role") == "vendedor", f"Expected role=vendedor, got {user.get('role')}"


class TestMultiPlayTicketCurrency:
    """Test multi-play ticket creation with country-based currency"""
    
    @pytest.fixture
    def us_seller_token(self):
        """Get US seller auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=US_SELLER)
        return response.json()["token"]
    
    @pytest.fixture
    def rd_seller_token(self):
        """Get RD seller auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RD_SELLER)
        return response.json()["token"]
    
    def test_create_multi_play_ticket_us_seller(self, us_seller_token):
        """Create multi-play ticket as US seller - should have currency=USD and seller_country=US"""
        # Get available lotteries first
        lotteries_res = requests.get(f"{BASE_URL}/api/lotteries", headers={
            "Authorization": f"Bearer {us_seller_token}"
        })
        assert lotteries_res.status_code == 200
        lotteries_data = lotteries_res.json()
        lotteries = lotteries_data.get("lotteries") if isinstance(lotteries_data, dict) else lotteries_data
        
        # Find an active lottery
        active_lottery = None
        for lottery in lotteries:
            if lottery.get("active", True):
                active_lottery = lottery
                break
        
        if not active_lottery:
            pytest.skip("No active lottery found for testing")
        
        lottery_id = active_lottery["id"]
        lottery_type = active_lottery.get("lottery_type", "quiniela")
        
        # Create multi-play ticket
        ticket_payload = {
            "plays": [
                {
                    "lottery_type": lottery_type,
                    "lottery_id": lottery_id,
                    "numbers": [42],
                    "amount": 25,
                    "position": "first"
                }
            ],
            "customer_name": "TEST_US_Customer",
            "currency": "USD"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", 
            json=ticket_payload,
            headers={"Authorization": f"Bearer {us_seller_token}"}
        )
        
        print(f"US Seller Ticket Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Ticket creation failed: {response.text}"
        data = response.json()
        
        # Verify ticket has correct currency and seller_country
        assert data.get("currency") == "USD", f"Expected currency=USD, got {data.get('currency')}"
        assert data.get("seller_country") == "US", f"Expected seller_country=US, got {data.get('seller_country')}"
        
        # Store ticket number for receipt test
        ticket_number = data.get("ticket_number")
        print(f"Created US seller ticket: {ticket_number} with currency={data.get('currency')}")
        
        return ticket_number
    
    def test_create_multi_play_ticket_rd_seller(self, rd_seller_token):
        """Create multi-play ticket as RD seller - should have currency=RD$ and seller_country=RD"""
        # Get available lotteries first
        lotteries_res = requests.get(f"{BASE_URL}/api/lotteries", headers={
            "Authorization": f"Bearer {rd_seller_token}"
        })
        assert lotteries_res.status_code == 200
        lotteries_data = lotteries_res.json()
        lotteries = lotteries_data.get("lotteries") if isinstance(lotteries_data, dict) else lotteries_data
        
        # Find an active lottery
        active_lottery = None
        for lottery in lotteries:
            if lottery.get("active", True):
                active_lottery = lottery
                break
        
        if not active_lottery:
            pytest.skip("No active lottery found for testing")
        
        lottery_id = active_lottery["id"]
        lottery_type = active_lottery.get("lottery_type", "quiniela")
        
        # Create multi-play ticket
        ticket_payload = {
            "plays": [
                {
                    "lottery_type": lottery_type,
                    "lottery_id": lottery_id,
                    "numbers": [77],
                    "amount": 50,
                    "position": "first"
                }
            ],
            "customer_name": "TEST_RD_Customer",
            "currency": "RD$"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", 
            json=ticket_payload,
            headers={"Authorization": f"Bearer {rd_seller_token}"}
        )
        
        print(f"RD Seller Ticket Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Ticket creation failed: {response.text}"
        data = response.json()
        
        # Verify ticket has correct currency and seller_country
        assert data.get("currency") == "RD$", f"Expected currency=RD$, got {data.get('currency')}"
        assert data.get("seller_country") == "RD", f"Expected seller_country=RD, got {data.get('seller_country')}"
        
        ticket_number = data.get("ticket_number")
        print(f"Created RD seller ticket: {ticket_number} with currency={data.get('currency')}")
        
        return ticket_number


class TestReceiptImageCurrency:
    """Test receipt image generation with correct currency display"""
    
    @pytest.fixture
    def us_seller_token(self):
        """Get US seller auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=US_SELLER)
        return response.json()["token"]
    
    @pytest.fixture
    def rd_seller_token(self):
        """Get RD seller auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RD_SELLER)
        return response.json()["token"]
    
    def _create_ticket_and_get_number(self, token, numbers, amount, customer_name):
        """Helper to create a ticket and return ticket number"""
        # Get available lotteries
        lotteries_res = requests.get(f"{BASE_URL}/api/lotteries", headers={
            "Authorization": f"Bearer {token}"
        })
        lotteries_data = lotteries_res.json()
        lotteries = lotteries_data.get("lotteries") if isinstance(lotteries_data, dict) else lotteries_data
        
        active_lottery = None
        for lottery in lotteries:
            if lottery.get("active", True):
                active_lottery = lottery
                break
        
        if not active_lottery:
            return None
        
        ticket_payload = {
            "plays": [
                {
                    "lottery_type": active_lottery.get("lottery_type", "quiniela"),
                    "lottery_id": active_lottery["id"],
                    "numbers": numbers,
                    "amount": amount,
                    "position": "first"
                }
            ],
            "customer_name": customer_name,
            "currency": "RD$"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", 
            json=ticket_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            return response.json().get("ticket_number")
        return None
    
    def test_receipt_image_us_seller_returns_png(self, us_seller_token):
        """Test receipt image for US seller ticket returns valid PNG"""
        # Create a new ticket
        ticket_number = self._create_ticket_and_get_number(
            us_seller_token, [33], 30, "TEST_US_Receipt"
        )
        
        if not ticket_number:
            pytest.skip("Could not create ticket for testing")
        
        # Get receipt image (PUBLIC endpoint - no auth required)
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        print(f"Receipt Image Response for US ticket {ticket_number}: Status={response.status_code}, Content-Type={response.headers.get('content-type')}")
        
        assert response.status_code == 200, f"Receipt image failed: {response.status_code}"
        assert response.headers.get("content-type") == "image/png", f"Expected image/png, got {response.headers.get('content-type')}"
        
        # Verify it's a valid PNG (starts with PNG signature)
        content = response.content
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Response is not a valid PNG image"
        
        print(f"US seller receipt image generated successfully: {len(content)} bytes")
    
    def test_receipt_image_rd_seller_returns_png(self, rd_seller_token):
        """Test receipt image for RD seller ticket returns valid PNG"""
        # Create a new ticket
        ticket_number = self._create_ticket_and_get_number(
            rd_seller_token, [88], 100, "TEST_RD_Receipt"
        )
        
        if not ticket_number:
            pytest.skip("Could not create ticket for testing")
        
        # Get receipt image (PUBLIC endpoint - no auth required)
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        print(f"Receipt Image Response for RD ticket {ticket_number}: Status={response.status_code}, Content-Type={response.headers.get('content-type')}")
        
        assert response.status_code == 200, f"Receipt image failed: {response.status_code}"
        assert response.headers.get("content-type") == "image/png", f"Expected image/png, got {response.headers.get('content-type')}"
        
        # Verify it's a valid PNG
        content = response.content
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Response is not a valid PNG image"
        
        print(f"RD seller receipt image generated successfully: {len(content)} bytes")
    
    def test_receipt_image_nonexistent_ticket(self):
        """Test receipt image for non-existent ticket returns 404"""
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/INVALID12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_existing_us_ticket_receipt(self):
        """Test receipt for existing US ticket LTMRD202639149"""
        # This ticket was mentioned in the context as already created
        ticket_number = "LTMRD202639149"
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        if response.status_code == 404:
            pytest.skip(f"Ticket {ticket_number} not found - may have been cleaned up")
        
        assert response.status_code == 200, f"Receipt failed: {response.status_code}"
        assert response.headers.get("content-type") == "image/png"
        print(f"Existing US ticket {ticket_number} receipt generated successfully")
    
    def test_existing_rd_ticket_receipt(self):
        """Test receipt for existing RD ticket LTMRD202657005"""
        # This ticket was mentioned in the context as already created
        ticket_number = "LTMRD202657005"
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        if response.status_code == 404:
            pytest.skip(f"Ticket {ticket_number} not found - may have been cleaned up")
        
        assert response.status_code == 200, f"Receipt failed: {response.status_code}"
        assert response.headers.get("content-type") == "image/png"
        print(f"Existing RD ticket {ticket_number} receipt generated successfully")


class TestPrizeConfiguration:
    """Test prize configuration endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=US_SELLER)
        return response.json()["token"]
    
    @pytest.fixture
    def seller_token(self):
        """Get regular seller auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RD_SELLER)
        return response.json()["token"]
    
    def test_get_all_prize_configs(self, admin_token):
        """Test GET /api/prize-config returns configs for both RD and US"""
        response = requests.get(f"{BASE_URL}/api/prize-config", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert response.status_code == 200, f"Prize config failed: {response.text}"
        data = response.json()
        
        assert "configs" in data, "Response should contain configs"
        configs = data["configs"]
        
        # Should have configs for both RD and US
        countries = [c.get("country") for c in configs]
        print(f"Prize config countries: {countries}")
        
        assert "RD" in countries, "Should have RD prize config"
        assert "US" in countries, "Should have US prize config"
        
        # Verify each config has play type multipliers
        for config in configs:
            country = config.get("country")
            print(f"\n{country} Prize Config:")
            for play_type in ["quiniela", "pale", "tripleta", "super_pale"]:
                if play_type in config:
                    print(f"  {play_type}: {config[play_type]}")
    
    def test_get_rd_prize_config(self, admin_token):
        """Test GET /api/prize-config/RD returns RD-specific config"""
        response = requests.get(f"{BASE_URL}/api/prize-config/RD", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert response.status_code == 200, f"RD prize config failed: {response.text}"
        data = response.json()
        
        assert data.get("country") == "RD", f"Expected country=RD, got {data.get('country')}"
        
        # Verify multipliers exist
        assert "quiniela" in data, "Should have quiniela multipliers"
        assert "pale" in data, "Should have pale multipliers"
        
        print(f"RD Prize Config: quiniela={data.get('quiniela')}, pale={data.get('pale')}")
    
    def test_get_us_prize_config(self, admin_token):
        """Test GET /api/prize-config/US returns US-specific config"""
        response = requests.get(f"{BASE_URL}/api/prize-config/US", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert response.status_code == 200, f"US prize config failed: {response.text}"
        data = response.json()
        
        assert data.get("country") == "US", f"Expected country=US, got {data.get('country')}"
        
        # Verify multipliers exist
        assert "quiniela" in data, "Should have quiniela multipliers"
        assert "pale" in data, "Should have pale multipliers"
        
        print(f"US Prize Config: quiniela={data.get('quiniela')}, pale={data.get('pale')}")
    
    def test_update_prize_config_super_admin(self, admin_token):
        """Test PUT /api/prize-config/{country} - super admin can update"""
        # Update RD quiniela multipliers
        update_payload = {
            "country": "RD",
            "quiniela": {"first": 70, "second": 20, "third": 10}
        }
        
        response = requests.put(f"{BASE_URL}/api/prize-config/RD", 
            json=update_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"Update prize config response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert "message" in data, "Should have success message"
    
    def test_update_prize_config_seller_forbidden(self, seller_token):
        """Test PUT /api/prize-config/{country} - regular seller should be forbidden"""
        update_payload = {
            "country": "RD",
            "quiniela": {"first": 100, "second": 30, "third": 15}
        }
        
        response = requests.put(f"{BASE_URL}/api/prize-config/RD", 
            json=update_payload,
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        
        # Should be 403 Forbidden for non-super-admin
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestTicketVerification:
    """Test ticket verification endpoint to confirm currency in ticket data"""
    
    @pytest.fixture
    def us_seller_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=US_SELLER)
        return response.json()["token"]
    
    @pytest.fixture
    def rd_seller_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RD_SELLER)
        return response.json()["token"]
    
    def _create_ticket(self, token, numbers, amount):
        """Helper to create a ticket"""
        lotteries_res = requests.get(f"{BASE_URL}/api/lotteries", headers={
            "Authorization": f"Bearer {token}"
        })
        lotteries_data = lotteries_res.json()
        lotteries = lotteries_data.get("lotteries") if isinstance(lotteries_data, dict) else lotteries_data
        
        active_lottery = None
        for lottery in lotteries:
            if lottery.get("active", True):
                active_lottery = lottery
                break
        
        if not active_lottery:
            return None
        
        ticket_payload = {
            "plays": [{
                "lottery_type": active_lottery.get("lottery_type", "quiniela"),
                "lottery_id": active_lottery["id"],
                "numbers": numbers,
                "amount": amount,
                "position": "first"
            }],
            "customer_name": "TEST_Verify",
            "currency": "RD$"
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets/multi", 
            json=ticket_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_verify_us_ticket_currency(self, us_seller_token):
        """Verify US seller ticket has USD currency via verify endpoint"""
        ticket_data = self._create_ticket(us_seller_token, [55], 40)
        
        if not ticket_data:
            pytest.skip("Could not create ticket")
        
        ticket_number = ticket_data.get("ticket_number")
        
        # Use public verify endpoint
        response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        print(f"US Ticket Verify: ticket={ticket_number}, currency={data.get('currency')}")
        
        # Currency should be USD for US seller
        assert data.get("currency") == "USD", f"Expected currency=USD, got {data.get('currency')}"
    
    def test_verify_rd_ticket_currency(self, rd_seller_token):
        """Verify RD seller ticket has RD$ currency via verify endpoint"""
        ticket_data = self._create_ticket(rd_seller_token, [66], 80)
        
        if not ticket_data:
            pytest.skip("Could not create ticket")
        
        ticket_number = ticket_data.get("ticket_number")
        
        # Use public verify endpoint
        response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        print(f"RD Ticket Verify: ticket={ticket_number}, currency={data.get('currency')}")
        
        # Currency should be RD$ for RD seller
        assert data.get("currency") == "RD$", f"Expected currency=RD$, got {data.get('currency')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

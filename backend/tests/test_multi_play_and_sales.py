"""
Test: Multi-Play Cart System and Country Flags
Tests the new sales screen with cart system and POST /api/tickets/multi endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://seller-analytics-hub-2.preview.emergentagent.com')

class TestMultiPlayEndpoint:
    """Tests for POST /api/tickets/multi endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.user = data["user"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_login_success(self):
        """Test login returns correct user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["email"] == "admin@loteria.com"
        print("✓ Login successful with super_admin role")
    
    def test_multi_play_endpoint_exists(self):
        """Test that /api/tickets/multi endpoint exists and accepts POST"""
        # Test with empty plays array - should return 400 validation error
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={"plays": [], "currency": "RD$"}  # Correct currency enum value
        )
        # 400 = endpoint exists and validates input
        # 404 = endpoint doesn't exist (bad)
        assert response.status_code != 404, "Multi-play endpoint /api/tickets/multi not found!"
        assert response.status_code == 400, f"Expected 400 for empty plays, got {response.status_code}"
        print("✓ Multi-play endpoint exists and validates input")
    
    def test_multi_play_requires_at_least_one_play(self):
        """Test that multi-play ticket requires at least one play"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [],
                "customer_name": "Test Customer",
                "currency": "RD$"  # Correct currency enum value
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "al menos una jugada" in data.get("detail", "").lower() or "at least" in data.get("detail", "").lower()
        print("✓ Multi-play validates at least one play required")
    
    def test_multi_play_validates_lottery_type(self):
        """Test that invalid lottery type returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "invalid_type_xyz",
                    "numbers": [42],
                    "amount": 20
                }],
                "currency": "RD$"  # Correct currency enum value
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "no encontrado" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        print("✓ Multi-play validates lottery type")
    
    def test_multi_play_validates_quiniela_numbers(self):
        """Test quiniela requires exactly 1 number"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "quiniela",
                    "numbers": [42, 43],  # 2 numbers instead of 1
                    "amount": 20
                }],
                "currency": "RD$"  # Correct currency enum value
            }
        )
        # Should return 400 because quiniela needs 1 number only
        assert response.status_code == 400
        print("✓ Multi-play validates quiniela requires 1 number")
    
    def test_multi_play_validates_pale_numbers(self):
        """Test pale requires exactly 2 numbers"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "pale",
                    "numbers": [42],  # 1 number instead of 2
                    "amount": 20
                }],
                "currency": "RD$"  # Correct currency enum value
            }
        )
        # Should return 400 because pale needs 2 numbers
        assert response.status_code == 400
        print("✓ Multi-play validates pale requires 2 numbers")
    
    def test_multi_play_validates_tripleta_numbers(self):
        """Test tripleta requires exactly 3 numbers"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "tripleta",
                    "numbers": [42, 43],  # 2 numbers instead of 3
                    "amount": 20
                }],
                "currency": "RD$"  # Correct currency enum value
            }
        )
        # Should return 400 because tripleta needs 3 numbers
        assert response.status_code == 400
        print("✓ Multi-play validates tripleta requires 3 numbers")
    
    def test_multi_play_validates_number_range(self):
        """Test that numbers out of range are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "quiniela",
                    "numbers": [150],  # Out of range (0-99)
                    "amount": 20
                }],
                "currency": "RD$"  # Correct currency enum value
            }
        )
        # Should return 400 because number is out of range
        assert response.status_code == 400
        data = response.json()
        assert "fuera de rango" in data.get("detail", "").lower() or "out of range" in data.get("detail", "").lower()
        print("✓ Multi-play validates number range")
    
    def test_multi_play_creates_ticket_successfully(self):
        """Test creating a multi-play ticket successfully"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [{
                    "lottery_type": "quiniela",
                    "numbers": [42],
                    "amount": 20
                }],
                "customer_name": "TEST_MultiPlay",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Multi-play creation failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response missing id"
        assert "ticket_number" in data, "Response missing ticket_number"
        assert "plays" in data, "Response missing plays"
        assert "total_amount" in data, "Response missing total_amount"
        assert "total_potential_win" in data, "Response missing total_potential_win"
        assert "commission_earned" in data, "Response missing commission_earned"
        assert data["ticket_type"] == "multi_play"
        assert data["plays_count"] == 1
        assert data["total_amount"] == 20
        
        print(f"✓ Multi-play ticket created: {data['ticket_number']}")
    
    def test_multi_play_with_multiple_plays(self):
        """Test creating a multi-play ticket with multiple plays"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers=self.headers,
            json={
                "plays": [
                    {"lottery_type": "quiniela", "numbers": [10], "amount": 20},
                    {"lottery_type": "quiniela", "numbers": [25], "amount": 20},
                    {"lottery_type": "pale", "numbers": [10, 25], "amount": 20}
                ],
                "customer_name": "TEST_MultiPlay2",
                "currency": "RD$"
            }
        )
        assert response.status_code == 200, f"Multi-play creation failed: {response.text}"
        data = response.json()
        
        assert data["plays_count"] == 3, f"Expected 3 plays, got {data['plays_count']}"
        assert data["total_amount"] == 60, f"Expected total 60, got {data['total_amount']}"
        
        print(f"✓ Multi-play ticket with 3 plays created: {data['ticket_number']}")


class TestLotteriesAPI:
    """Tests for lotteries API with country flags support"""
    
    def test_get_lotteries_returns_country(self):
        """Test that lotteries endpoint returns country field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Lotteries should return a list"
        assert len(data) > 0, "Should have at least one lottery"
        
        # Verify each lottery has country field - accept RD, USA, US, TEST
        valid_countries = ["RD", "USA", "US", "TEST"]
        for lottery in data:
            assert "country" in lottery, f"Lottery {lottery.get('name')} missing country field"
            assert lottery["country"] in valid_countries, f"Invalid country: {lottery.get('country')}"
            assert "name" in lottery
            assert "lottery_type" in lottery
            assert "currency" in lottery
            assert "is_open" in lottery
        
        print(f"✓ Found {len(data)} lotteries with country fields")
        
        # Count by country
        rd_count = len([l for l in data if l["country"] == "RD"])
        us_count = len([l for l in data if l["country"] in ["USA", "US"]])
        print(f"  RD lotteries: {rd_count}, US lotteries: {us_count}")
    
    def test_get_lotteries_with_country_filter(self):
        """Test filtering lotteries by country"""
        # Test RD filter
        response_rd = requests.get(f"{BASE_URL}/api/lotteries?country=RD")
        assert response_rd.status_code == 200
        data_rd = response_rd.json()
        for lottery in data_rd:
            assert lottery["country"] == "RD", f"Expected RD, got {lottery['country']}"
        
        # Test US filter
        response_us = requests.get(f"{BASE_URL}/api/lotteries?country=US")
        assert response_us.status_code == 200
        data_us = response_us.json()
        for lottery in data_us:
            assert lottery["country"] == "US", f"Expected US, got {lottery['country']}"
        
        print(f"✓ Lottery country filter working: RD={len(data_rd)}, US={len(data_us)}")
    
    def test_lottery_has_required_fields_for_cart(self):
        """Test that lotteries have all fields needed for cart system"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "id", "name", "country", "lottery_type",
            "min_number", "max_number", "numbers_to_pick",
            "price", "currency", "prize_multiplier",
            "is_open"
        ]
        
        for lottery in data[:5]:  # Check first 5
            for field in required_fields:
                assert field in lottery, f"Lottery {lottery.get('name')} missing {field}"
        
        print("✓ Lotteries have all required fields for cart system")


class TestDashboardAPI:
    """Tests for dashboard accounting summary with country filter and flags"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_accounting_summary_returns_currency(self):
        """Test that accounting summary returns currency for flag display"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "currency" in data, "Summary should include currency field"
        assert "today" in data
        assert "week" in data
        assert "month" in data
        
        # Verify currency is one of expected values
        assert data["currency"] in ["RD$", "USD", "$"], f"Unexpected currency: {data['currency']}"
        
        print(f"✓ Accounting summary returns currency: {data['currency']}")
    
    def test_accounting_summary_country_filter_rd(self):
        """Test accounting summary with RD country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary?country=RD",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "country_filter" in data, "Should return country_filter field"
        assert data["country_filter"] == "RD"
        print(f"✓ Accounting summary with country=RD filter working")
    
    def test_accounting_summary_country_filter_us(self):
        """Test accounting summary with US country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary?country=US",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "country_filter" in data, "Should return country_filter field"
        assert data["country_filter"] == "US"
        print(f"✓ Accounting summary with country=US filter working")


class TestSellersReportAPI:
    """Tests for sellers report with country flags"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_sellers_report_returns_currency(self):
        """Test that sellers report returns currency per seller for flag display"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "sellers" in data
        assert "totals" in data
        
        # Check if sellers have currency field
        for seller in data["sellers"]:
            assert "currency" in seller, f"Seller {seller.get('seller_name')} missing currency"
        
        print(f"✓ Sellers report returns {len(data['sellers'])} sellers with currency fields")
    
    def test_sellers_report_country_filter(self):
        """Test sellers report with country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report?country=RD",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "country_filter" in data, "Should return country_filter field"
        assert data["country_filter"] == "RD"
        print(f"✓ Sellers report country filter working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

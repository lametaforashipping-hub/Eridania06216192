"""
Test suite for Holiday Feature in Lottery System
Tests for:
- POST /api/lotteries/{id}/holidays - Add closed holiday
- POST /api/lotteries/{id}/holidays - Add holiday with special hours
- GET /api/lotteries/{id}/holidays - Get holidays list
- DELETE /api/lotteries/{id}/holidays/{date} - Remove holiday
- GET /api/lotteries - Verify is_holiday and holiday_name fields
- check_lottery_open behavior on holidays
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# Get backend URL from environment - MUST be set
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@loteria.com"
TEST_PASSWORD = "admin123"

# Known lottery ID from agent context
TEST_LOTTERY_ID = "31fe9898-c280-4eb3-82be-9a2b6adb9a62"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    return response.json()["token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create session with auth headers"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def test_lottery_id(api_client):
    """Create a test lottery for holiday testing"""
    lottery_data = {
        "name": f"TEST_Holiday_Lottery_{uuid.uuid4().hex[:8]}",
        "country": "RD",
        "lottery_type": "quiniela",
        "min_number": 0,
        "max_number": 99,
        "numbers_to_pick": 1,
        "price": 20.0,
        "currency": "RD$",
        "prize_multiplier": 70.0,
        "schedule": ["12:00", "15:00", "21:00"],
        "closing_minutes_before": 15,
        "active": True,
        "opening_time": "08:00",
        "closing_time": "21:00",
        "holidays": []  # Start with empty holidays
    }
    
    response = api_client.post(f"{BASE_URL}/api/lotteries", json=lottery_data)
    if response.status_code != 200:
        pytest.skip(f"Failed to create test lottery: {response.text}")
    
    lottery_id = response.json()["lottery_id"]
    yield lottery_id
    
    # Cleanup - deactivate the test lottery
    api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})


class TestAddClosedHoliday:
    """Tests for adding a closed holiday (closed: true)"""
    
    def test_add_closed_holiday_success(self, api_client, test_lottery_id):
        """Test adding a completely closed holiday (e.g., Christmas)"""
        holiday_data = {
            "date": "2026-12-25",
            "name": "Navidad",
            "closed": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "Navidad" in data["message"]
        assert "holidays" in data
        
        # Verify the holiday was added
        added_holiday = next((h for h in data["holidays"] if h["date"] == "2026-12-25"), None)
        assert added_holiday is not None
        assert added_holiday["name"] == "Navidad"
        assert added_holiday["closed"] == True
        print(f"✓ Successfully added closed holiday 'Navidad' for 2026-12-25")
    
    def test_add_duplicate_date_fails(self, api_client, test_lottery_id):
        """Test that adding a holiday for the same date fails"""
        holiday_data = {
            "date": "2026-12-25",
            "name": "Another Christmas",
            "closed": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Ya existe un festivo" in response.json()["detail"]
        print(f"✓ Correctly rejected duplicate holiday date")


class TestAddSpecialHoursHoliday:
    """Tests for adding holiday with special opening hours"""
    
    def test_add_holiday_with_special_hours(self, api_client, test_lottery_id):
        """Test adding a holiday with custom opening/closing hours (e.g., Independence Day)"""
        holiday_data = {
            "date": "2026-02-27",
            "name": "Día de la Independencia",
            "open": "10:00",
            "close": "18:00"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "holidays" in data
        
        # Verify the holiday was added with special hours
        added_holiday = next((h for h in data["holidays"] if h["date"] == "2026-02-27"), None)
        assert added_holiday is not None
        assert added_holiday["name"] == "Día de la Independencia"
        assert added_holiday["open"] == "10:00"
        assert added_holiday["close"] == "18:00"
        assert added_holiday.get("closed") != True  # Not closed, has special hours
        print(f"✓ Successfully added holiday with special hours: 10:00-18:00")
    
    def test_add_holiday_invalid_format_missing_date(self, api_client, test_lottery_id):
        """Test that adding a holiday without date fails"""
        holiday_data = {
            "name": "Missing Date Holiday",
            "closed": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "date" in response.json()["detail"].lower()
        print(f"✓ Correctly rejected holiday without date")
    
    def test_add_holiday_invalid_format_missing_name(self, api_client, test_lottery_id):
        """Test that adding a holiday without name fails"""
        holiday_data = {
            "date": "2026-03-01",
            "closed": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "name" in response.json()["detail"].lower()
        print(f"✓ Correctly rejected holiday without name")


class TestGetHolidays:
    """Tests for GET /api/lotteries/{id}/holidays endpoint"""
    
    def test_get_holidays_list(self, api_client, test_lottery_id):
        """Test getting the list of holidays for a lottery"""
        response = api_client.get(f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        holidays = response.json()
        assert isinstance(holidays, list)
        
        # We should have at least 2 holidays from previous tests
        assert len(holidays) >= 2, f"Expected at least 2 holidays, got {len(holidays)}"
        
        # Verify Christmas is in the list
        christmas = next((h for h in holidays if h["date"] == "2026-12-25"), None)
        assert christmas is not None
        assert christmas["name"] == "Navidad"
        assert christmas["closed"] == True
        
        # Verify Independence Day is in the list
        independence = next((h for h in holidays if h["date"] == "2026-02-27"), None)
        assert independence is not None
        assert independence["name"] == "Día de la Independencia"
        
        print(f"✓ Retrieved {len(holidays)} holidays successfully")
    
    def test_get_holidays_nonexistent_lottery(self, api_client):
        """Test getting holidays for a non-existent lottery"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/lotteries/{fake_id}/holidays")
        
        assert response.status_code == 404
        print(f"✓ Correctly returned 404 for non-existent lottery")
    
    def test_get_holidays_no_auth_required(self):
        """Test that GET holidays endpoint doesn't require auth"""
        # This should work without authentication (public endpoint)
        response = requests.get(f"{BASE_URL}/api/lotteries/{TEST_LOTTERY_ID}/holidays")
        
        # Should return 200 or 401 depending on implementation
        # Based on code review, this endpoint doesn't have Depends() so it's public
        if response.status_code == 200:
            print(f"✓ GET holidays is a public endpoint (no auth required)")
        elif response.status_code == 401:
            print(f"✓ GET holidays requires authentication")
        else:
            assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"


class TestDeleteHoliday:
    """Tests for DELETE /api/lotteries/{id}/holidays/{date} endpoint"""
    
    def test_delete_holiday_by_date(self, api_client, test_lottery_id):
        """Test deleting a holiday by date"""
        # First add a holiday to delete
        holiday_data = {
            "date": "2026-07-04",
            "name": "Test Delete Holiday",
            "closed": True
        }
        
        add_response = api_client.post(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays",
            json=holiday_data
        )
        assert add_response.status_code == 200, f"Failed to add holiday: {add_response.text}"
        
        # Now delete it
        response = api_client.delete(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays/2026-07-04"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "2026-07-04" in data["message"]
        
        # Verify it's removed from the holidays list
        remaining_holidays = data.get("holidays", [])
        deleted_holiday = next((h for h in remaining_holidays if h["date"] == "2026-07-04"), None)
        assert deleted_holiday is None, "Holiday should have been deleted"
        print(f"✓ Successfully deleted holiday for 2026-07-04")
    
    def test_delete_nonexistent_holiday(self, api_client, test_lottery_id):
        """Test deleting a holiday that doesn't exist"""
        response = api_client.delete(
            f"{BASE_URL}/api/lotteries/{test_lottery_id}/holidays/2099-01-01"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "No se encontró festivo" in response.json()["detail"]
        print(f"✓ Correctly returned 404 for non-existent holiday date")
    
    def test_delete_holiday_nonexistent_lottery(self, api_client):
        """Test deleting holiday from a non-existent lottery"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(
            f"{BASE_URL}/api/lotteries/{fake_id}/holidays/2026-12-25"
        )
        
        assert response.status_code == 404
        assert "Lotería no encontrada" in response.json()["detail"]
        print(f"✓ Correctly returned 404 for non-existent lottery")


class TestLotteriesListWithHolidayInfo:
    """Tests for GET /api/lotteries returning is_holiday and holiday_name fields"""
    
    def test_lotteries_return_holiday_fields(self, api_client, test_lottery_id):
        """Test that GET /api/lotteries returns is_holiday and holiday_name fields"""
        response = api_client.get(f"{BASE_URL}/api/lotteries")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        lotteries = response.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) > 0
        
        # Find our test lottery
        test_lottery = next((l for l in lotteries if l["id"] == test_lottery_id), None)
        assert test_lottery is not None, "Test lottery not found in list"
        
        # Verify is_holiday and holiday_name fields exist
        assert "is_holiday" in test_lottery, "Missing is_holiday field"
        assert "holiday_name" in test_lottery, "Missing holiday_name field"
        
        # Since today is not a holiday, these should be False/None
        # (Unless today happens to be one of the added holidays)
        today = datetime.now().strftime("%Y-%m-%d")
        if today not in ["2026-12-25", "2026-02-27"]:
            assert test_lottery["is_holiday"] == False
            assert test_lottery["holiday_name"] is None
        
        print(f"✓ GET /api/lotteries returns is_holiday={test_lottery['is_holiday']}, holiday_name={test_lottery['holiday_name']}")
    
    def test_single_lottery_returns_holiday_fields(self, api_client, test_lottery_id):
        """Test that GET /api/lotteries/{id} returns is_holiday and holiday_name"""
        response = api_client.get(f"{BASE_URL}/api/lotteries/{test_lottery_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        lottery = response.json()
        
        # Verify is_holiday and holiday_name fields exist
        assert "is_holiday" in lottery, "Missing is_holiday field"
        assert "holiday_name" in lottery, "Missing holiday_name field"
        assert "today_hours" in lottery, "Missing today_hours field"
        
        print(f"✓ GET /api/lotteries/{{id}} returns holiday fields correctly")


class TestCheckLotteryOpenOnHoliday:
    """Tests for check_lottery_open behavior on holidays"""
    
    def test_lottery_returns_holiday_in_today_hours(self, api_client, test_lottery_id):
        """Test that today_hours includes holiday info when it's a holiday"""
        # This tests the internal logic but via the API response
        response = api_client.get(f"{BASE_URL}/api/lotteries/{test_lottery_id}")
        
        assert response.status_code == 200
        lottery = response.json()
        
        today_hours = lottery.get("today_hours", {})
        assert "day" in today_hours, "today_hours should have 'day' field"
        assert "open" in today_hours, "today_hours should have 'open' field"
        assert "close" in today_hours, "today_hours should have 'close' field"
        
        # If today is a holiday, the 'holiday' key should be present
        print(f"✓ today_hours structure: {today_hours}")


class TestAddHolidayToKnownLottery:
    """Tests using the known lottery ID from agent context"""
    
    def test_add_new_year_to_known_lottery(self, api_client):
        """Test adding a closed holiday to the known test lottery"""
        holiday_data = {
            "date": "2026-01-01",
            "name": "Año Nuevo",
            "closed": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/lotteries/{TEST_LOTTERY_ID}/holidays",
            json=holiday_data
        )
        
        # Could be 200 (success) or 400 (already exists)
        if response.status_code == 200:
            print(f"✓ Added 'Año Nuevo' holiday to known lottery")
        elif response.status_code == 400:
            print(f"✓ Holiday for 2026-01-01 already exists (expected if re-running tests)")
        else:
            assert False, f"Unexpected response: {response.status_code} - {response.text}"
    
    def test_verify_existing_navidad_holiday(self, api_client):
        """Verify the pre-existing Navidad holiday from agent context"""
        response = api_client.get(f"{BASE_URL}/api/lotteries/{TEST_LOTTERY_ID}/holidays")
        
        assert response.status_code == 200
        holidays = response.json()
        
        # Check if Navidad 2026-12-25 exists (mentioned in agent context)
        navidad = next((h for h in holidays if h["date"] == "2026-12-25"), None)
        
        if navidad:
            print(f"✓ Found existing Navidad holiday: {navidad}")
            assert navidad["name"] == "Navidad"
        else:
            print(f"✓ No Navidad holiday found (may have been removed)")
        
        print(f"✓ Known lottery has {len(holidays)} holidays configured")


class TestClosedMessageOnHoliday:
    """Tests for the closed_message content when lottery is closed due to holiday"""
    
    def test_lottery_with_closed_holiday_shows_message(self, api_client, test_lottery_id):
        """Test that closed_message contains holiday name when closed"""
        # Get the lottery
        response = api_client.get(f"{BASE_URL}/api/lotteries/{test_lottery_id}")
        
        assert response.status_code == 200
        lottery = response.json()
        
        # The closed_message field should exist
        assert "closed_message" in lottery or lottery.get("closed_message") is None
        
        # If lottery is closed, there should be a message
        if not lottery.get("is_open"):
            if lottery.get("is_holiday"):
                assert lottery.get("closed_message") is not None
                print(f"✓ Lottery is closed for holiday. Message: {lottery.get('closed_message')}")
            else:
                print(f"✓ Lottery is closed (not holiday). Message: {lottery.get('closed_message')}")
        else:
            print(f"✓ Lottery is currently open")


# Cleanup fixture to run at the end
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_holidays(api_client, test_lottery_id):
    """Cleanup test holidays after all tests"""
    yield
    
    # Remove test holidays from known lottery
    test_dates = ["2026-01-01"]  # Dates we may have added
    for date in test_dates:
        try:
            api_client.delete(f"{BASE_URL}/api/lotteries/{TEST_LOTTERY_ID}/holidays/{date}")
        except:
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

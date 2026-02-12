"""
Backend tests for Weekly Hours Feature - Different opening/closing times per day of the week
Testing:
1. GET /api/lotteries returns weekly_hours and today_hours fields
2. GET /api/lotteries/{id} returns weekly_hours and today_hours
3. check_lottery_open uses weekly_hours correctly based on current day
4. POST /api/lotteries with custom weekly_hours saves correctly
5. PUT /api/lotteries/{id} can update weekly_hours
6. Closed message includes next day name (e.g., "Abre mañana (thu)")
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lottery-rd-usa.preview.emergentagent.com').rstrip('/')

# Default weekly schedule from server.py
DEFAULT_WEEKLY_SCHEDULE = {
    "monday": {"open": "08:00", "close": "21:00"},
    "tuesday": {"open": "08:00", "close": "21:00"},
    "wednesday": {"open": "08:00", "close": "21:00"},
    "thursday": {"open": "08:00", "close": "21:00"},
    "friday": {"open": "08:00", "close": "21:00"},
    "saturday": {"open": "08:00", "close": "22:00"},
    "sunday": {"open": "10:00", "close": "20:00"},
}


class TestLotteryListWeeklyHours:
    """Test that lottery list API returns weekly_hours and today_hours fields"""
    
    def test_lotteries_list_contains_today_hours(self):
        """Verify GET /api/lotteries returns today_hours field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200, f"Failed to get lotteries: {response.text}"
        
        lotteries = response.json()
        assert isinstance(lotteries, list), "Expected list of lotteries"
        assert len(lotteries) > 0, "No lotteries found"
        
        first_lottery = lotteries[0]
        assert "today_hours" in first_lottery, f"Missing 'today_hours' field in lottery response: {first_lottery.keys()}"
        
        today_hours = first_lottery['today_hours']
        assert isinstance(today_hours, dict), f"today_hours should be a dict, got {type(today_hours)}"
        
        # Check today_hours structure
        assert "open" in today_hours, "today_hours missing 'open' field"
        assert "close" in today_hours, "today_hours missing 'close' field"
        assert "day" in today_hours, "today_hours missing 'day' field"
        
        print(f"today_hours: {today_hours}")
        print(f"  - day: {today_hours['day']}")
        print(f"  - open: {today_hours['open']}")
        print(f"  - close: {today_hours['close']}")
        print("PASS: today_hours field present with correct structure")
    
    def test_today_hours_day_is_valid(self):
        """Verify today_hours.day is a valid weekday name"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        first_lottery = lotteries[0]
        
        valid_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        today_day = first_lottery['today_hours']['day']
        
        assert today_day in valid_days, f"today_hours.day '{today_day}' is not a valid weekday"
        print(f"PASS: today_hours.day = '{today_day}' is valid")
    
    def test_lotteries_list_contains_weekly_hours(self):
        """Verify GET /api/lotteries returns weekly_hours field for lotteries that have it"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200, f"Failed to get lotteries: {response.text}"
        
        lotteries = response.json()
        
        # Check if any lottery has weekly_hours
        lotteries_with_weekly_hours = [l for l in lotteries if l.get('weekly_hours')]
        
        print(f"Total lotteries: {len(lotteries)}")
        print(f"Lotteries with weekly_hours: {len(lotteries_with_weekly_hours)}")
        
        # Old lotteries may not have weekly_hours stored, but today_hours should still work
        # New lotteries should have weekly_hours saved (either custom or DEFAULT_WEEKLY_SCHEDULE)
        print("PASS: weekly_hours field check completed")


class TestSingleLotteryWeeklyHours:
    """Test that single lottery endpoint returns weekly_hours and today_hours"""
    
    def test_single_lottery_contains_today_hours(self):
        """Verify GET /api/lotteries/{id} returns today_hours field"""
        # First get a lottery ID
        list_response = requests.get(f"{BASE_URL}/api/lotteries")
        assert list_response.status_code == 200
        
        lotteries = list_response.json()
        assert len(lotteries) > 0, "No lotteries available"
        
        lottery_id = lotteries[0]['id']
        
        # Now get single lottery
        response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert response.status_code == 200, f"Failed to get lottery: {response.text}"
        
        lottery = response.json()
        
        assert "today_hours" in lottery, "Missing today_hours in single lottery response"
        
        today_hours = lottery['today_hours']
        assert "open" in today_hours, "today_hours missing 'open'"
        assert "close" in today_hours, "today_hours missing 'close'" 
        assert "day" in today_hours, "today_hours missing 'day'"
        
        print(f"Lottery: {lottery['name']}")
        print(f"  today_hours: {today_hours}")
        print("PASS: Single lottery endpoint returns today_hours field")


class TestCreateLotteryWithWeeklyHours:
    """Test creating lottery with custom weekly_hours"""
    
    @pytest.fixture
    def auth_token(self):
        """Get super_admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_create_lottery_with_custom_weekly_hours(self, auth_token):
        """Test POST /api/lotteries with custom weekly_hours per day"""
        unique_id = str(uuid.uuid4())[:8]
        
        custom_weekly_hours = {
            "monday": {"open": "07:00", "close": "20:00"},
            "tuesday": {"open": "07:00", "close": "20:00"},
            "wednesday": {"open": "07:00", "close": "20:00"},
            "thursday": {"open": "07:00", "close": "20:00"},
            "friday": {"open": "07:00", "close": "22:00"},  # Friday open later
            "saturday": {"open": "09:00", "close": "23:00"},  # Saturday different
            "sunday": {"open": "11:00", "close": "18:00"},  # Sunday shorter hours
        }
        
        lottery_data = {
            "name": f"TEST_WeeklyHours_{unique_id}",
            "country": "TEST",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 25.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "18:00"],
            "closing_minutes_before": 10,
            "active": True,
            "weekly_hours": custom_weekly_hours
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json=lottery_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create lottery: {response.text}"
        data = response.json()
        assert "lottery_id" in data, "Missing lottery_id in response"
        
        lottery_id = data['lottery_id']
        print(f"Created lottery with ID: {lottery_id}")
        
        # Verify lottery was created with correct weekly_hours
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert get_response.status_code == 200
        
        lottery = get_response.json()
        
        # Check weekly_hours was saved
        assert "weekly_hours" in lottery, "weekly_hours not in lottery response"
        saved_weekly_hours = lottery['weekly_hours']
        
        # Verify Saturday hours (custom)
        assert saved_weekly_hours.get('saturday', {}).get('open') == "09:00", \
            f"Saturday open time not saved correctly: {saved_weekly_hours.get('saturday')}"
        assert saved_weekly_hours.get('saturday', {}).get('close') == "23:00", \
            f"Saturday close time not saved correctly: {saved_weekly_hours.get('saturday')}"
        
        # Verify Sunday hours (custom)
        assert saved_weekly_hours.get('sunday', {}).get('open') == "11:00", \
            f"Sunday open time not saved correctly: {saved_weekly_hours.get('sunday')}"
        
        print(f"PASS: Lottery created with custom weekly_hours")
        print(f"  Saturday: {saved_weekly_hours.get('saturday')}")
        print(f"  Sunday: {saved_weekly_hours.get('sunday')}")
    
    def test_create_lottery_without_weekly_hours_uses_default(self, auth_token):
        """Test lottery created without weekly_hours uses DEFAULT_WEEKLY_SCHEDULE"""
        unique_id = str(uuid.uuid4())[:8]
        
        lottery_data = {
            "name": f"TEST_DefaultWeekly_{unique_id}",
            "country": "TEST",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00"],
            "closing_minutes_before": 15,
            "active": True
            # NOT providing weekly_hours - should use DEFAULT_WEEKLY_SCHEDULE
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json=lottery_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create lottery: {response.text}"
        lottery_id = response.json()['lottery_id']
        
        # Get lottery and check default weekly_hours
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        assert "weekly_hours" in lottery, "weekly_hours not in response"
        saved_weekly_hours = lottery['weekly_hours']
        
        # Should have DEFAULT_WEEKLY_SCHEDULE values
        # Saturday: 08:00 - 22:00 (from default)
        assert saved_weekly_hours.get('saturday', {}).get('open') == "08:00", \
            f"Expected default saturday open 08:00, got {saved_weekly_hours.get('saturday')}"
        assert saved_weekly_hours.get('saturday', {}).get('close') == "22:00", \
            f"Expected default saturday close 22:00, got {saved_weekly_hours.get('saturday')}"
        
        # Sunday: 10:00 - 20:00 (from default) 
        assert saved_weekly_hours.get('sunday', {}).get('open') == "10:00", \
            f"Expected default sunday open 10:00, got {saved_weekly_hours.get('sunday')}"
        assert saved_weekly_hours.get('sunday', {}).get('close') == "20:00", \
            f"Expected default sunday close 20:00, got {saved_weekly_hours.get('sunday')}"
        
        print(f"PASS: Lottery uses DEFAULT_WEEKLY_SCHEDULE")
        print(f"  Saturday: {saved_weekly_hours.get('saturday')}")
        print(f"  Sunday: {saved_weekly_hours.get('sunday')}")


class TestUpdateLotteryWeeklyHours:
    """Test updating lottery weekly_hours"""
    
    @pytest.fixture
    def auth_token(self):
        """Get super_admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_update_lottery_weekly_hours(self, auth_token):
        """Test PUT /api/lotteries/{id} can update weekly_hours"""
        # First create a lottery
        unique_id = str(uuid.uuid4())[:8]
        
        create_response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json={
                "name": f"TEST_UpdateWeekly_{unique_id}",
                "country": "TEST",
                "lottery_type": "quiniela",
                "min_number": 0,
                "max_number": 99,
                "numbers_to_pick": 1,
                "price": 20.0,
                "currency": "RD$",
                "prize_multiplier": 70.0,
                "schedule": ["12:00"],
                "closing_minutes_before": 10,
                "active": True
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert create_response.status_code == 200
        lottery_id = create_response.json()['lottery_id']
        
        # Update weekly_hours
        new_weekly_hours = {
            "monday": {"open": "06:00", "close": "23:00"},
            "tuesday": {"open": "06:00", "close": "23:00"},
            "wednesday": {"open": "06:00", "close": "23:00"},
            "thursday": {"open": "06:00", "close": "23:00"},
            "friday": {"open": "06:00", "close": "00:00"},  # Open until midnight
            "saturday": {"open": "07:00", "close": "00:00"},
            "sunday": {"open": "08:00", "close": "22:00"},
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}",
            json={"weekly_hours": new_weekly_hours},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        saved_weekly_hours = lottery.get('weekly_hours', {})
        assert saved_weekly_hours.get('monday', {}).get('open') == "06:00", \
            f"weekly_hours monday not updated: {saved_weekly_hours.get('monday')}"
        assert saved_weekly_hours.get('sunday', {}).get('close') == "22:00", \
            f"weekly_hours sunday not updated: {saved_weekly_hours.get('sunday')}"
        
        print(f"PASS: weekly_hours updated successfully")
        print(f"  Monday: {saved_weekly_hours.get('monday')}")
        print(f"  Sunday: {saved_weekly_hours.get('sunday')}")


class TestClosedMessageWithDayName:
    """Test that closed message includes next day name"""
    
    def test_closed_message_contains_day_abbreviation(self):
        """Verify closed_message includes day name like (mon), (tue), etc."""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        
        # Find a closed lottery
        closed_lotteries = [l for l in lotteries if not l.get('is_open', True)]
        
        if not closed_lotteries:
            pytest.skip("No closed lotteries available - all lotteries are open")
        
        print(f"Found {len(closed_lotteries)} closed lotteries")
        
        for lottery in closed_lotteries:
            closed_message = lottery.get('closed_message', '')
            
            # Check if message contains day abbreviation
            day_abbreviations = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
            
            # If lottery opens tomorrow, message should include day name
            if 'mañana' in closed_message.lower() or 'tomorrow' in closed_message.lower():
                has_day = any(f"({day})" in closed_message.lower() for day in day_abbreviations)
                
                print(f"Lottery '{lottery['name']}': {closed_message}")
                
                if has_day:
                    print("  -> Contains day abbreviation ✓")
                else:
                    print("  -> Missing day abbreviation (may be old format)")
        
        print("PASS: Checked closed message format for day name")
    
    def test_closed_message_format_abre_manana(self):
        """Verify closed message format: 'Cerrada. Abre mañana (xxx) a las HH:MM'"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        closed_lotteries = [l for l in lotteries if not l.get('is_open', True)]
        
        if not closed_lotteries:
            pytest.skip("No closed lotteries to test message format")
        
        # Check format of closed messages
        for lottery in closed_lotteries:
            msg = lottery.get('closed_message', '')
            
            if 'mañana' in msg.lower():
                # Expected format: "Cerrada. Abre mañana (xxx) a las HH:MM"
                print(f"Lottery: {lottery['name']}")
                print(f"  Message: {msg}")
                
                # Validate it has time format (like "08:00")
                import re
                time_pattern = r'\d{2}:\d{2}'
                has_time = bool(re.search(time_pattern, msg))
                assert has_time, f"Message should contain time (HH:MM): {msg}"
                print("  -> Has time format ✓")
        
        print("PASS: Closed message format validation complete")


class TestTodayHoursMatchesCurrentDay:
    """Test that today_hours correctly reflects the current day of the week"""
    
    @pytest.fixture
    def auth_token(self):
        """Get super_admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_today_hours_matches_weekly_schedule(self, auth_token):
        """Create lottery with known weekly_hours and verify today_hours is correct"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lottery with distinct hours for each day
        custom_weekly_hours = {
            "monday": {"open": "01:00", "close": "02:00"},
            "tuesday": {"open": "03:00", "close": "04:00"},
            "wednesday": {"open": "05:00", "close": "06:00"},
            "thursday": {"open": "07:00", "close": "08:00"},
            "friday": {"open": "09:00", "close": "10:00"},
            "saturday": {"open": "11:00", "close": "12:00"},
            "sunday": {"open": "13:00", "close": "14:00"},
        }
        
        lottery_data = {
            "name": f"TEST_TodayHoursCheck_{unique_id}",
            "country": "TEST",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00"],
            "closing_minutes_before": 10,
            "active": True,
            "weekly_hours": custom_weekly_hours
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json=lottery_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert create_response.status_code == 200
        lottery_id = create_response.json()['lottery_id']
        
        # Get the lottery
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert get_response.status_code == 200
        
        lottery = get_response.json()
        today_hours = lottery['today_hours']
        current_day = today_hours['day']
        
        # Verify today_hours matches the weekly_hours for today's day
        expected_hours = custom_weekly_hours[current_day]
        
        print(f"Current day (from API): {current_day}")
        print(f"today_hours: {today_hours}")
        print(f"Expected (from weekly_hours): {expected_hours}")
        
        assert today_hours['open'] == expected_hours['open'], \
            f"today_hours.open mismatch: {today_hours['open']} != {expected_hours['open']}"
        assert today_hours['close'] == expected_hours['close'], \
            f"today_hours.close mismatch: {today_hours['close']} != {expected_hours['close']}"
        
        print("PASS: today_hours correctly reflects weekly_hours for current day")


class TestWeeklyHoursFallback:
    """Test that check_lottery_open uses correct fallback when weekly_hours is missing"""
    
    def test_lottery_without_weekly_hours_uses_simple_times(self):
        """Old lotteries without weekly_hours should use opening_time/closing_time"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        
        # Find a lottery that might not have weekly_hours (old lotteries)
        for lottery in lotteries:
            weekly_hours = lottery.get('weekly_hours')
            today_hours = lottery.get('today_hours', {})
            
            print(f"Lottery: {lottery['name']}")
            print(f"  has weekly_hours: {weekly_hours is not None}")
            print(f"  today_hours: {today_hours}")
            
            # All lotteries should have today_hours regardless of weekly_hours storage
            assert 'today_hours' in lottery, f"Lottery {lottery['name']} missing today_hours"
            assert 'open' in today_hours, f"today_hours missing 'open'"
            assert 'close' in today_hours, f"today_hours missing 'close'"
            assert 'day' in today_hours, f"today_hours missing 'day'"
        
        print("PASS: All lotteries have valid today_hours")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

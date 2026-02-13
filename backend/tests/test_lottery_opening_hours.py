"""
Backend tests for Lottery Opening/Closing Hours Feature
Testing:
1. GET /api/lotteries returns opening_time, closing_time, is_open, closed_message
2. GET /api/lotteries/{id} returns single lottery with open/close status
3. POST /api/tickets returns error when lottery is closed
4. POST /api/lotteries with opening_time and closing_time fields
5. PUT /api/lotteries/{id} can update opening_time and closing_time
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lottery-shortcuts.preview.emergentagent.com').rstrip('/')


class TestLotteryListOpeningHours:
    """Test that lottery list API returns opening hours fields"""
    
    def test_lotteries_list_contains_is_open(self):
        """Verify GET /api/lotteries returns is_open field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200, f"Failed to get lotteries: {response.text}"
        
        lotteries = response.json()
        assert isinstance(lotteries, list), "Expected list of lotteries"
        assert len(lotteries) > 0, "No lotteries found"
        
        # Check first lottery has is_open field
        first_lottery = lotteries[0]
        assert "is_open" in first_lottery, f"Missing 'is_open' field in lottery response: {first_lottery.keys()}"
        print(f"is_open value: {first_lottery['is_open']} (type: {type(first_lottery['is_open']).__name__})")
        assert isinstance(first_lottery['is_open'], bool), "is_open should be boolean"
        print("PASS: is_open field present and is boolean")
    
    def test_lotteries_list_contains_closed_message(self):
        """Verify GET /api/lotteries returns closed_message field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        first_lottery = lotteries[0]
        
        # closed_message can be null when open, or string when closed
        assert "closed_message" in first_lottery, f"Missing 'closed_message' field in lottery response"
        
        # If lottery is closed, message should be a string
        if not first_lottery['is_open']:
            assert first_lottery['closed_message'] is None or isinstance(first_lottery['closed_message'], str), \
                "closed_message should be string or null"
            print(f"Lottery is CLOSED. Message: {first_lottery['closed_message']}")
        else:
            print(f"Lottery is OPEN. closed_message: {first_lottery['closed_message']}")
        print("PASS: closed_message field present")
    
    def test_lotteries_list_contains_next_draw_time(self):
        """Verify GET /api/lotteries returns next_draw_time field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        first_lottery = lotteries[0]
        
        assert "next_draw_time" in first_lottery, f"Missing 'next_draw_time' field in lottery response"
        print(f"next_draw_time value: {first_lottery['next_draw_time']}")
        print("PASS: next_draw_time field present")
    
    def test_all_lotteries_have_opening_fields(self):
        """Verify all lotteries in list have opening hours related fields"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        required_fields = ['is_open', 'closed_message', 'next_draw_time']
        
        for lottery in lotteries:
            for field in required_fields:
                assert field in lottery, f"Lottery '{lottery.get('name', 'unknown')}' missing field '{field}'"
        
        print(f"PASS: All {len(lotteries)} lotteries have required opening hours fields")


class TestSingleLotteryOpeningHours:
    """Test that single lottery endpoint returns opening hours fields"""
    
    def test_single_lottery_contains_opening_fields(self):
        """Verify GET /api/lotteries/{id} returns opening hours fields"""
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
        
        # Check required fields
        assert "is_open" in lottery, "Missing is_open in single lottery response"
        assert "closed_message" in lottery, "Missing closed_message in single lottery response"
        assert "next_draw_time" in lottery, "Missing next_draw_time in single lottery response"
        
        print(f"Lottery: {lottery['name']}")
        print(f"  is_open: {lottery['is_open']}")
        print(f"  closed_message: {lottery['closed_message']}")
        print(f"  next_draw_time: {lottery['next_draw_time']}")
        print("PASS: Single lottery endpoint returns all opening hours fields")


class TestTicketCreationWhenClosed:
    """Test that ticket creation fails when lottery is closed"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Authentication failed")
    
    def test_create_ticket_on_closed_lottery_returns_error(self, auth_token):
        """Verify POST /api/tickets returns 400 when lottery is closed"""
        # Get a closed lottery
        list_response = requests.get(f"{BASE_URL}/api/lotteries")
        assert list_response.status_code == 200
        
        lotteries = list_response.json()
        
        # Find a closed lottery
        closed_lottery = next((l for l in lotteries if not l.get('is_open', True)), None)
        
        if not closed_lottery:
            pytest.skip("No closed lotteries available for testing - all lotteries are open")
        
        print(f"Testing with closed lottery: {closed_lottery['name']}")
        print(f"  closed_message: {closed_lottery.get('closed_message')}")
        
        # Try to create a ticket
        ticket_data = {
            "lottery_id": closed_lottery['id'],
            "numbers": [42] if closed_lottery['numbers_to_pick'] == 1 else [1, 2],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_Closed_Lottery_Customer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should return 400 (Bad Request) because lottery is closed
        assert response.status_code == 400, f"Expected 400 for closed lottery, got {response.status_code}: {response.text}"
        
        error_data = response.json()
        assert "detail" in error_data, "Missing error detail in response"
        
        # Check error message contains closure information
        error_message = error_data['detail'].lower()
        assert any(word in error_message for word in ['cerrada', 'closed', 'abre', 'open']), \
            f"Error message should mention lottery being closed: {error_data['detail']}"
        
        print(f"PASS: Ticket creation correctly blocked with message: {error_data['detail']}")
    
    def test_create_ticket_error_contains_opening_time(self, auth_token):
        """Verify error message mentions when lottery opens"""
        list_response = requests.get(f"{BASE_URL}/api/lotteries")
        assert list_response.status_code == 200
        
        lotteries = list_response.json()
        closed_lottery = next((l for l in lotteries if not l.get('is_open', True)), None)
        
        if not closed_lottery:
            pytest.skip("No closed lotteries available")
        
        ticket_data = {
            "lottery_id": closed_lottery['id'],
            "numbers": [42] if closed_lottery['numbers_to_pick'] == 1 else [1, 2],
            "amount": 20.0,
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 400
        error_data = response.json()
        
        # Error should mention opening time (08:00 is default)
        error_msg = error_data['detail']
        print(f"Error message: {error_msg}")
        
        # Check for time format in message (like "08:00" or "mañana")
        has_time_info = any(x in error_msg for x in ['08:00', 'mañana', 'tomorrow', 'Abre', 'opens'])
        assert has_time_info, f"Error message should contain opening time info: {error_msg}"
        
        print("PASS: Error message contains opening time information")


class TestCreateLotteryWithOpeningHours:
    """Test creating lottery with opening_time and closing_time fields"""
    
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
    
    def test_create_lottery_with_custom_opening_hours(self, auth_token):
        """Test POST /api/lotteries with opening_time and closing_time"""
        unique_id = str(uuid.uuid4())[:8]
        
        lottery_data = {
            "name": f"TEST_Lottery_{unique_id}",
            "country": "TEST",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 25.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["10:00", "14:00", "18:00"],
            "closing_minutes_before": 10,
            "active": True,
            "opening_time": "06:00",  # Custom opening time
            "closing_time": "23:00"   # Custom closing time
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
        
        # Verify lottery was created with correct opening times
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert get_response.status_code == 200
        
        lottery = get_response.json()
        assert lottery.get('opening_time') == "06:00", f"opening_time mismatch: {lottery.get('opening_time')}"
        assert lottery.get('closing_time') == "23:00", f"closing_time mismatch: {lottery.get('closing_time')}"
        
        print(f"PASS: Lottery created with custom hours - opens: {lottery['opening_time']}, closes: {lottery['closing_time']}")
    
    def test_create_lottery_with_default_opening_hours(self, auth_token):
        """Test lottery created without opening times uses defaults"""
        unique_id = str(uuid.uuid4())[:8]
        
        lottery_data = {
            "name": f"TEST_DefaultHours_{unique_id}",
            "country": "TEST",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "18:00"],
            "closing_minutes_before": 15,
            "active": True
            # NOT providing opening_time and closing_time
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json=lottery_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create lottery: {response.text}"
        lottery_id = response.json()['lottery_id']
        
        # Get lottery and check defaults
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        # Default times should be 08:00 - 21:00
        assert lottery.get('opening_time') == "08:00", f"Default opening_time should be 08:00, got: {lottery.get('opening_time')}"
        assert lottery.get('closing_time') == "21:00", f"Default closing_time should be 21:00, got: {lottery.get('closing_time')}"
        
        print(f"PASS: Lottery uses default hours - opens: {lottery['opening_time']}, closes: {lottery['closing_time']}")


class TestUpdateLotteryOpeningHours:
    """Test updating lottery opening and closing times"""
    
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
    
    def test_update_lottery_opening_time(self, auth_token):
        """Test PUT /api/lotteries/{id} can update opening_time"""
        # First create a lottery
        unique_id = str(uuid.uuid4())[:8]
        
        create_response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json={
                "name": f"TEST_UpdateOpening_{unique_id}",
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
                "opening_time": "08:00",
                "closing_time": "21:00"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert create_response.status_code == 200
        lottery_id = create_response.json()['lottery_id']
        
        # Update opening time
        update_response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}",
            json={
                "opening_time": "07:00"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        assert lottery.get('opening_time') == "07:00", f"opening_time not updated: {lottery.get('opening_time')}"
        print(f"PASS: opening_time updated to {lottery['opening_time']}")
    
    def test_update_lottery_closing_time(self, auth_token):
        """Test PUT /api/lotteries/{id} can update closing_time"""
        # First create a lottery
        unique_id = str(uuid.uuid4())[:8]
        
        create_response = requests.post(
            f"{BASE_URL}/api/lotteries",
            json={
                "name": f"TEST_UpdateClosing_{unique_id}",
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
        
        # Update closing time
        update_response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}",
            json={
                "closing_time": "22:30"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        assert lottery.get('closing_time') == "22:30", f"closing_time not updated: {lottery.get('closing_time')}"
        print(f"PASS: closing_time updated to {lottery['closing_time']}")


class TestLotteryOpenClosedStatus:
    """Test lottery is_open status calculation"""
    
    def test_lottery_closed_status_matches_message(self):
        """Verify is_open=false has a closed_message"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        
        for lottery in lotteries:
            if not lottery['is_open']:
                # Closed lottery should have a message
                assert lottery['closed_message'] is not None, \
                    f"Closed lottery '{lottery['name']}' has no closed_message"
                print(f"Lottery '{lottery['name']}': CLOSED - {lottery['closed_message']}")
            else:
                print(f"Lottery '{lottery['name']}': OPEN")
        
        print("PASS: All closed lotteries have appropriate closed_message")
    
    def test_closed_message_format(self):
        """Verify closed_message has expected format"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        closed_lotteries = [l for l in lotteries if not l['is_open']]
        
        if not closed_lotteries:
            pytest.skip("No closed lotteries to test message format")
        
        for lottery in closed_lotteries:
            msg = lottery.get('closed_message', '')
            # Message should mention when it opens or that it's closed
            valid_patterns = ['Abre', 'abre', 'Cerrada', 'cerrada', 'mañana', 'sorteo']
            has_valid_pattern = any(p in msg for p in valid_patterns)
            assert has_valid_pattern, f"closed_message format invalid: {msg}"
            print(f"Lottery '{lottery['name']}' closed_message: {msg}")
        
        print("PASS: All closed_message values have expected format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

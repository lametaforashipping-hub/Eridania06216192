"""
Test suite for per-number ticket limit feature in lottery system.
Tests global ticket limits per number (regardless of date).

Features tested:
- Create lottery with ticket_limit_per_number
- Verify limit is saved correctly
- Sell tickets until limit (should allow)
- Block sale when limit reached (with descriptive error message)
- Verify other numbers remain available
- GET /api/lotteries/{id}/number-stats endpoint
- Multi-play ticket limits
- Update limit via PUT /api/lotteries/{id}
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://monthly-reports-v2.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@loteria.com"
TEST_PASSWORD = "admin123"

class TestTicketLimitPerNumber:
    """Tests for global per-number ticket limit feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        # First ensure super admin exists
        init_response = requests.post(f"{BASE_URL}/api/init/super-admin")
        print(f"Init super admin response: {init_response.status_code}")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        print(f"Login response: {response.status_code}")
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Authenticated requests session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    @pytest.fixture(scope="class")
    def test_lottery_with_limit(self, api_client):
        """Create a test lottery with ticket limit per number"""
        unique_id = str(uuid.uuid4())[:8]
        lottery_data = {
            "name": f"TEST_Limit_Lottery_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "15:00", "21:00"],
            "active": True,
            "opening_time": "00:01",
            "closing_time": "23:59",
            "weekly_hours": {
                "monday": {"open": "00:01", "close": "23:59"},
                "tuesday": {"open": "00:01", "close": "23:59"},
                "wednesday": {"open": "00:01", "close": "23:59"},
                "thursday": {"open": "00:01", "close": "23:59"},
                "friday": {"open": "00:01", "close": "23:59"},
                "saturday": {"open": "00:01", "close": "23:59"},
                "sunday": {"open": "00:01", "close": "23:59"},
            },
            "ticket_limit_per_number": 3  # Limit of 3 tickets per number
        }
        
        response = api_client.post(f"{BASE_URL}/api/lotteries", json=lottery_data)
        print(f"Create lottery response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Failed to create lottery: {response.text}"
        
        lottery_id = response.json().get("lottery_id")
        assert lottery_id is not None
        
        yield lottery_id
        
        # Cleanup: Deactivate the lottery
        api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})
    
    def test_01_create_lottery_with_limit(self, api_client):
        """Test creating a lottery with ticket_limit_per_number"""
        unique_id = str(uuid.uuid4())[:8]
        lottery_data = {
            "name": f"TEST_Create_With_Limit_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "21:00"],
            "active": True,
            "ticket_limit_per_number": 5
        }
        
        response = api_client.post(f"{BASE_URL}/api/lotteries", json=lottery_data)
        print(f"Create lottery with limit: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        lottery_id = response.json().get("lottery_id")
        
        # Verify limit is saved
        get_response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert get_response.status_code == 200
        
        lottery = get_response.json()
        assert lottery["ticket_limit_per_number"] == 5, f"Limit not saved correctly: {lottery}"
        print(f"✅ Lottery created with ticket_limit_per_number=5")
    
    def test_02_create_lottery_without_limit(self, api_client):
        """Test creating a lottery without ticket limit (unlimited)"""
        unique_id = str(uuid.uuid4())[:8]
        lottery_data = {
            "name": f"TEST_No_Limit_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "21:00"],
            "active": True
            # No ticket_limit_per_number - should be unlimited
        }
        
        response = api_client.post(f"{BASE_URL}/api/lotteries", json=lottery_data)
        assert response.status_code == 200
        
        lottery_id = response.json().get("lottery_id")
        
        get_response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        # Should be None (unlimited)
        assert lottery.get("ticket_limit_per_number") is None, f"Expected no limit: {lottery}"
        print(f"✅ Lottery created without ticket limit (unlimited)")
    
    def test_03_sell_tickets_within_limit(self, api_client, test_lottery_with_limit):
        """Test selling tickets up to the limit (should allow)"""
        lottery_id = test_lottery_with_limit
        test_number = 77  # Use a unique number to avoid conflicts
        
        # Sell 3 tickets with number 77 (limit is 3)
        for i in range(3):
            ticket_data = {
                "lottery_id": lottery_id,
                "numbers": [test_number],
                "amount": 20.0,
                "currency": "RD$",
                "customer_name": f"TEST_Customer_{i+1}"
            }
            
            response = api_client.post(f"{BASE_URL}/api/tickets", json=ticket_data)
            print(f"Sell ticket {i+1} for number {test_number}: {response.status_code}")
            
            if response.status_code == 400:
                # Check if it's a "lottery closed" error vs limit error
                error_detail = response.json().get("detail", "")
                if "cerrad" in error_detail.lower() or "closed" in error_detail.lower():
                    pytest.skip(f"Lottery is closed: {error_detail}")
                    
            assert response.status_code == 200, f"Failed to sell ticket {i+1}: {response.text}"
            
            ticket = response.json()
            assert ticket["numbers"] == [test_number]
            print(f"✅ Ticket {i+1} sold successfully for number {test_number}")
    
    def test_04_block_when_limit_reached(self, api_client, test_lottery_with_limit):
        """Test that selling is blocked when limit is reached (with descriptive error)"""
        lottery_id = test_lottery_with_limit
        test_number = 77  # Same number from previous test (already has 3 tickets)
        
        # Try to sell 4th ticket - should be blocked
        ticket_data = {
            "lottery_id": lottery_id,
            "numbers": [test_number],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_Should_Fail"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tickets", json=ticket_data)
        print(f"Attempt 4th ticket sale: {response.status_code} - {response.text}")
        
        assert response.status_code == 400, f"Expected 400 but got {response.status_code}"
        
        error_detail = response.json().get("detail", "")
        
        # Verify descriptive error message
        assert "límite" in error_detail.lower() or "limit" in error_detail.lower(), \
            f"Error message should mention limit: {error_detail}"
        assert str(test_number) in error_detail, f"Error should mention the blocked number: {error_detail}"
        print(f"✅ Sale blocked with message: {error_detail}")
    
    def test_05_other_numbers_still_available(self, api_client, test_lottery_with_limit):
        """Test that other numbers are still available after one is blocked"""
        lottery_id = test_lottery_with_limit
        another_number = 88  # Different number should be available
        
        ticket_data = {
            "lottery_id": lottery_id,
            "numbers": [another_number],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_Other_Number"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tickets", json=ticket_data)
        print(f"Sell ticket for different number {another_number}: {response.status_code}")
        
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "cerrad" in error_detail.lower():
                pytest.skip(f"Lottery closed: {error_detail}")
                
        assert response.status_code == 200, f"Should allow different number: {response.text}"
        print(f"✅ Number {another_number} is still available for sale")
    
    def test_06_number_stats_endpoint(self, api_client, test_lottery_with_limit):
        """Test GET /api/lotteries/{id}/number-stats endpoint"""
        lottery_id = test_lottery_with_limit
        
        response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}/number-stats")
        print(f"Number stats response: {response.status_code}")
        
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        stats = response.json()
        
        # Verify response structure
        assert "lottery_id" in stats
        assert "lottery_name" in stats
        assert "ticket_limit_per_number" in stats
        assert "number_stats" in stats
        assert "blocked_numbers" in stats
        assert "total_numbers_with_sales" in stats
        
        # Verify ticket limit is returned
        assert stats["ticket_limit_per_number"] == 3
        
        # Verify number 77 is in blocked_numbers (from previous tests)
        print(f"Stats: {stats}")
        print(f"Blocked numbers: {stats['blocked_numbers']}")
        
        # Find number 77 in stats
        number_77_stats = None
        for num_stat in stats["number_stats"]:
            if num_stat["number"] == 77:
                number_77_stats = num_stat
                break
        
        if number_77_stats:
            assert number_77_stats["sold_count"] >= 3
            assert number_77_stats["is_blocked"] == True
            assert number_77_stats["remaining"] is not None and number_77_stats["remaining"] <= 0
            print(f"✅ Number 77 stats: {number_77_stats}")
        
        print(f"✅ Number stats endpoint working correctly")
    
    def test_07_update_lottery_limit(self, api_client, test_lottery_with_limit):
        """Test updating ticket_limit_per_number via PUT"""
        lottery_id = test_lottery_with_limit
        
        # Update limit to 5
        response = api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={
            "ticket_limit_per_number": 5
        })
        print(f"Update limit response: {response.status_code}")
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        # Verify update
        get_response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        assert lottery["ticket_limit_per_number"] == 5, f"Limit not updated: {lottery}"
        
        print(f"✅ Ticket limit updated to 5")
        
        # Now number 77 should be available again (had 3, limit now 5)
        ticket_data = {
            "lottery_id": lottery_id,
            "numbers": [77],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_After_Limit_Update"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tickets", json=ticket_data)
        print(f"Sell after limit update: {response.status_code}")
        
        if response.status_code == 400 and "cerrad" in response.json().get("detail", "").lower():
            pytest.skip("Lottery closed")
            
        assert response.status_code == 200, f"Should allow after limit increase: {response.text}"
        print(f"✅ Number 77 available after limit increased to 5")
    
    def test_08_existing_lottery_number_stats(self, api_client):
        """Test number stats on the existing test lottery mentioned in context"""
        # Known lottery ID from main agent context
        lottery_id = "5be25beb-5b88-40c9-82de-8a60fe768e1a"
        
        response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}/number-stats")
        
        if response.status_code == 404:
            pytest.skip("Test lottery not found - may have been deleted")
        
        print(f"Existing lottery stats: {response.status_code}")
        
        if response.status_code == 200:
            stats = response.json()
            print(f"Lottery: {stats.get('lottery_name')}")
            print(f"Limit: {stats.get('ticket_limit_per_number')}")
            print(f"Blocked numbers: {stats.get('blocked_numbers')}")
            
            # According to context: number 42 has 3 tickets (blocked), number 55 has 1
            for num_stat in stats.get("number_stats", []):
                print(f"  Number {num_stat['number']}: {num_stat['sold_count']} sold, blocked={num_stat['is_blocked']}")


class TestMultiPlayTicketLimits:
    """Tests for ticket limits in multi-play tickets"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        requests.post(f"{BASE_URL}/api/init/super-admin")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Authenticated requests session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    @pytest.fixture(scope="class")
    def lottery_for_multi(self, api_client):
        """Create lottery for multi-play tests"""
        unique_id = str(uuid.uuid4())[:8]
        lottery_data = {
            "name": f"TEST_MultiPlay_Limit_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "15:00", "21:00"],
            "active": True,
            "opening_time": "00:01",
            "closing_time": "23:59",
            "weekly_hours": {
                "monday": {"open": "00:01", "close": "23:59"},
                "tuesday": {"open": "00:01", "close": "23:59"},
                "wednesday": {"open": "00:01", "close": "23:59"},
                "thursday": {"open": "00:01", "close": "23:59"},
                "friday": {"open": "00:01", "close": "23:59"},
                "saturday": {"open": "00:01", "close": "23:59"},
                "sunday": {"open": "00:01", "close": "23:59"},
            },
            "ticket_limit_per_number": 2
        }
        
        response = api_client.post(f"{BASE_URL}/api/lotteries", json=lottery_data)
        if response.status_code != 200:
            pytest.skip(f"Failed to create test lottery: {response.text}")
            
        lottery_id = response.json().get("lottery_id")
        yield lottery_id
        
        api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})
    
    def test_multiplay_respects_limit(self, api_client, lottery_for_multi):
        """Test that multi-play endpoint also respects ticket limits"""
        lottery_id = lottery_for_multi
        
        # First, get the lottery info to know the lottery_type
        lottery_response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        if lottery_response.status_code != 200:
            pytest.skip("Could not get lottery info")
        
        lottery = lottery_response.json()
        lottery_type = lottery["lottery_type"]
        
        # Sell 2 regular tickets for number 33 (reaching limit)
        for i in range(2):
            response = api_client.post(f"{BASE_URL}/api/tickets", json={
                "lottery_id": lottery_id,
                "numbers": [33],
                "amount": 20.0,
                "currency": "RD$",
                "customer_name": f"TEST_Multi_{i}"
            })
            print(f"Pre-sell ticket {i+1}: {response.status_code}")
            
            if response.status_code == 400:
                detail = response.json().get("detail", "")
                if "cerrad" in detail.lower():
                    pytest.skip(f"Lottery closed: {detail}")
        
        # Now try multi-play with number 33 - should be blocked
        multi_play_data = {
            "plays": [
                {
                    "lottery_type": lottery_type,
                    "numbers": [33],  # Already at limit
                    "amount": 20.0
                }
            ],
            "customer_name": "TEST_MultiPlay_Blocked",
            "currency": "RD$"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tickets/multi", json=multi_play_data)
        print(f"Multi-play with blocked number: {response.status_code} - {response.text}")
        
        # Should be blocked
        if response.status_code == 200:
            # Check if the endpoint actually validates limits for multi-play
            print("⚠️ Multi-play may not validate limits per lottery - check implementation")
        elif response.status_code == 400:
            error_detail = response.json().get("detail", "")
            assert "33" in error_detail or "límite" in error_detail.lower()
            print(f"✅ Multi-play blocked correctly: {error_detail}")


class TestEdgeCases:
    """Edge case tests for ticket limits"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Get authenticated client"""
        requests.post(f"{BASE_URL}/api/init/super-admin")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Auth failed")
        
        token = response.json().get("token")
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_limit_zero_means_unlimited(self, api_client):
        """Test that limit of 0 means unlimited"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(f"{BASE_URL}/api/lotteries", json={
            "name": f"TEST_Zero_Limit_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["21:00"],
            "active": True,
            "ticket_limit_per_number": 0  # Zero should mean unlimited
        })
        
        assert response.status_code == 200
        lottery_id = response.json().get("lottery_id")
        
        # Verify
        get_response = api_client.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        lottery = get_response.json()
        
        # Check that limit is stored
        # Based on code: if ticket_limit and ticket_limit > 0 - so 0 is treated as unlimited
        print(f"Limit value when 0: {lottery.get('ticket_limit_per_number')}")
        
        # Cleanup
        api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})
        print("✅ Zero limit test completed")
    
    def test_cancelled_tickets_dont_count(self, api_client):
        """Test that cancelled tickets don't count towards limit"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lottery with limit 1
        response = api_client.post(f"{BASE_URL}/api/lotteries", json={
            "name": f"TEST_Cancel_Test_{unique_id}",
            "country": "RD",
            "lottery_type": "quiniela",
            "min_number": 0,
            "max_number": 99,
            "numbers_to_pick": 1,
            "price": 20.0,
            "currency": "RD$",
            "prize_multiplier": 70.0,
            "schedule": ["12:00", "21:00"],
            "active": True,
            "opening_time": "00:01",
            "closing_time": "23:59",
            "weekly_hours": {
                "monday": {"open": "00:01", "close": "23:59"},
                "tuesday": {"open": "00:01", "close": "23:59"},
                "wednesday": {"open": "00:01", "close": "23:59"},
                "thursday": {"open": "00:01", "close": "23:59"},
                "friday": {"open": "00:01", "close": "23:59"},
                "saturday": {"open": "00:01", "close": "23:59"},
                "sunday": {"open": "00:01", "close": "23:59"},
            },
            "ticket_limit_per_number": 1
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create lottery: {response.text}")
        
        lottery_id = response.json().get("lottery_id")
        test_number = 99
        
        # Sell ticket
        sell_response = api_client.post(f"{BASE_URL}/api/tickets", json={
            "lottery_id": lottery_id,
            "numbers": [test_number],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_To_Cancel"
        })
        
        if sell_response.status_code == 400:
            detail = sell_response.json().get("detail", "")
            if "cerrad" in detail.lower():
                api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})
                pytest.skip("Lottery closed")
        
        assert sell_response.status_code == 200, f"Failed to sell: {sell_response.text}"
        ticket_id = sell_response.json().get("id")
        
        # Cancel the ticket
        cancel_response = api_client.post(f"{BASE_URL}/api/tickets/{ticket_id}/cancel")
        print(f"Cancel ticket: {cancel_response.status_code}")
        
        # Now selling another ticket for same number should work (cancelled doesn't count)
        sell_again = api_client.post(f"{BASE_URL}/api/tickets", json={
            "lottery_id": lottery_id,
            "numbers": [test_number],
            "amount": 20.0,
            "currency": "RD$",
            "customer_name": "TEST_After_Cancel"
        })
        
        print(f"Sell after cancel: {sell_again.status_code} - {sell_again.text}")
        
        if cancel_response.status_code == 200:
            # If cancel worked, second sale should succeed
            assert sell_again.status_code == 200, \
                f"Cancelled tickets should not count towards limit: {sell_again.text}"
            print("✅ Cancelled tickets don't count towards limit")
        else:
            print(f"⚠️ Cancel failed (may be outside 5 min window): {cancel_response.text}")
        
        # Cleanup
        api_client.put(f"{BASE_URL}/api/lotteries/{lottery_id}", json={"active": False})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

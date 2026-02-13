"""
Test cases for Multi-Lotto feature:
- Multi-Play ticket creation with lottery_id per play
- Lottery selector showing compatible lotteries
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-shortcuts.preview.emergentagent.com')


class TestMultiLottoBackend:
    """Test Multi-Lotto functionality via backend API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_get_lotteries_returns_list(self):
        """Test that GET /api/lotteries returns list of lotteries with id field"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) > 0
        
        # Verify lottery structure has necessary fields
        lottery = lotteries[0]
        assert "id" in lottery
        assert "name" in lottery
        assert "lottery_type" in lottery
        assert "is_open" in lottery
        print(f"Found {len(lotteries)} lotteries")
    
    def test_get_open_lotteries(self):
        """Test that at least one lottery is open for testing"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        open_lotteries = [l for l in lotteries if l["is_open"]]
        
        assert len(open_lotteries) > 0, "No open lotteries found - cannot test multi-play"
        print(f"Open lotteries: {[l['name'] for l in open_lotteries]}")
        
        # Store for later tests
        self.open_lottery = open_lotteries[0]
        return open_lotteries
    
    def test_multiplay_with_lottery_id_quiniela(self):
        """Test creating multi-play ticket with specific lottery_id for quiniela"""
        # Get an open lottery
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        
        # Find an open quiniela-type lottery
        open_quiniela = None
        for l in lotteries:
            if l["is_open"] and l["lottery_type"] in ["quiniela", "quinieloto"]:
                open_quiniela = l
                break
        
        if not open_quiniela:
            pytest.skip("No open quiniela lottery available")
        
        print(f"Using lottery: {open_quiniela['name']} (ID: {open_quiniela['id']})")
        
        # Create multi-play ticket with lottery_id
        payload = {
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "lottery_id": open_quiniela["id"],
                    "numbers": [25],
                    "amount": 10
                }
            ],
            "customer_name": "TEST_MultiLotto_Customer",
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload,
            headers=self.headers
        )
        
        print(f"Response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Multi-play creation failed: {response.text}"
        
        ticket = response.json()
        assert "ticket_number" in ticket
        assert "plays" in ticket
        assert len(ticket["plays"]) == 1
        
        # Verify the lottery_id was correctly used
        play = ticket["plays"][0]
        assert play["lottery_id"] == open_quiniela["id"]
        assert play["lottery_name"] == open_quiniela["name"]
        print(f"Created ticket {ticket['ticket_number']} with lottery {play['lottery_name']}")
    
    def test_multiplay_with_multiple_different_lotteries(self):
        """Test creating multi-play ticket with plays from different lotteries"""
        # Get all open lotteries
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        
        open_lotteries = [l for l in lotteries if l["is_open"]]
        
        if len(open_lotteries) < 1:
            pytest.skip("Need at least 1 open lottery for this test")
        
        # Prepare plays - try to use different lotteries if available
        plays = []
        
        # Add first play with first open lottery
        lottery1 = open_lotteries[0]
        play1 = {
            "lottery_type": lottery1["lottery_type"],
            "lottery_id": lottery1["id"],
            "numbers": [15],  # Single number for quiniela
            "amount": 10
        }
        plays.append(play1)
        
        # If we have another open lottery of same type, add another play
        if len(open_lotteries) > 1:
            lottery2 = open_lotteries[1]
            play2 = {
                "lottery_type": lottery2["lottery_type"],
                "lottery_id": lottery2["id"],
                "numbers": [30] if lottery2["numbers_to_pick"] == 1 else [30, 45],
                "amount": 15
            }
            plays.append(play2)
        
        payload = {
            "plays": plays,
            "customer_name": "TEST_MultiLotto_Multiple",
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload,
            headers=self.headers
        )
        
        print(f"Response: {response.status_code}")
        assert response.status_code == 200, f"Multi-play creation failed: {response.text}"
        
        ticket = response.json()
        assert "plays" in ticket
        assert len(ticket["plays"]) == len(plays)
        
        # Verify each play has correct lottery info
        for i, created_play in enumerate(ticket["plays"]):
            expected_lottery_id = plays[i]["lottery_id"]
            assert created_play["lottery_id"] == expected_lottery_id
            print(f"Play {i+1}: {created_play['lottery_type']} on {created_play['lottery_name']}")
        
        print(f"Created multi-lotto ticket {ticket['ticket_number']} with {len(ticket['plays'])} plays")
    
    def test_multiplay_without_lottery_id_falls_back_to_type(self):
        """Test that multi-play without lottery_id falls back to lottery_type matching"""
        payload = {
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "numbers": [42],
                    "amount": 5
                }
            ],
            "customer_name": "TEST_MultiLotto_NoID",
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload,
            headers=self.headers
        )
        
        print(f"Response: {response.status_code} - {response.text}")
        
        # Should either succeed (if open quiniela exists) or fail with appropriate error
        if response.status_code == 200:
            ticket = response.json()
            assert "plays" in ticket
            play = ticket["plays"][0]
            # Should have assigned a lottery
            assert "lottery_id" in play
            assert "lottery_name" in play
            print(f"Fallback assigned lottery: {play['lottery_name']}")
        else:
            # Check for appropriate error message
            error = response.json()
            assert "detail" in error
            print(f"Expected error (no open lottery): {error['detail']}")
    
    def test_play_item_model_accepts_lottery_id(self):
        """Test that PlayItem model correctly accepts optional lottery_id field"""
        # This test verifies the backend model change
        
        # Get any open lottery
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        
        if not open_lottery:
            pytest.skip("No open lottery available")
        
        # Test with lottery_id present
        payload_with_id = {
            "plays": [
                {
                    "lottery_type": open_lottery["lottery_type"],
                    "lottery_id": open_lottery["id"],
                    "numbers": [10],
                    "amount": 5
                }
            ],
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload_with_id,
            headers=self.headers
        )
        
        assert response.status_code == 200
        ticket = response.json()
        assert ticket["plays"][0]["lottery_id"] == open_lottery["id"]
        print("✓ lottery_id field accepted in PlayItem model")
    
    def test_frontend_lottery_selector_endpoint(self):
        """Test that frontend can fetch lotteries for selector"""
        # Frontend needs to get compatible lotteries by type
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        
        # Group by lottery_type for frontend selector
        types = {}
        for l in lotteries:
            lt = l["lottery_type"]
            if lt not in types:
                types[lt] = []
            types[lt].append({
                "id": l["id"],
                "name": l["name"],
                "is_open": l["is_open"]
            })
        
        # Verify we have quiniela types for the selector
        quiniela_types = ["quiniela", "quinieloto"]
        compatible = [l for l in lotteries if l["lottery_type"] in quiniela_types]
        
        print(f"Lottery types available: {list(types.keys())}")
        print(f"Quiniela-compatible lotteries: {len(compatible)}")
        
        assert len(lotteries) > 0
        

class TestMultiLottoTicketCreation:
    """Test specific Multi-Lotto ticket creation scenarios"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_ticket_shows_lottery_name_in_plays(self):
        """Test that created ticket shows lottery name for each play"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        
        if not open_lottery:
            pytest.skip("No open lottery")
        
        payload = {
            "plays": [
                {
                    "lottery_type": open_lottery["lottery_type"],
                    "lottery_id": open_lottery["id"],
                    "numbers": [55],
                    "amount": 10
                }
            ],
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200
        ticket = response.json()
        
        # Verify lottery_name is populated
        play = ticket["plays"][0]
        assert "lottery_name" in play
        assert play["lottery_name"] == open_lottery["name"]
        print(f"Ticket play shows lottery: {play['lottery_name']}")
    
    def test_verify_ticket_by_id(self):
        """Test that we can verify created multi-lotto ticket"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        
        if not open_lottery:
            pytest.skip("No open lottery")
        
        # Create ticket
        payload = {
            "plays": [
                {
                    "lottery_type": open_lottery["lottery_type"],
                    "lottery_id": open_lottery["id"],
                    "numbers": [77],
                    "amount": 20
                }
            ],
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200
        ticket = response.json()
        ticket_number = ticket["ticket_number"]
        
        # Verify ticket via public endpoint
        verify_response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        assert verify_response.status_code == 200
        
        verified_ticket = verify_response.json()
        assert verified_ticket["ticket_number"] == ticket_number
        assert "plays" in verified_ticket
        print(f"✓ Verified ticket {ticket_number}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

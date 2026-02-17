"""
Quick Sales API Tests
Tests the ticket creation flow for quiniela, pale, and tripleta
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://number-selection-app.preview.emergentagent.com')

# Test credentials
VENDEDOR_EMAIL = "vendedor@test.com"
VENDEDOR_PASSWORD = "12345678"
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def vendedor_token():
    """Get vendedor authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VENDEDOR_EMAIL,
        "password": VENDEDOR_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def lotteries(vendedor_token):
    """Get available lotteries"""
    response = requests.get(
        f"{BASE_URL}/api/lotteries",
        headers={"Authorization": f"Bearer {vendedor_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0, "No lotteries found"
    return data


class TestLotteriesAPI:
    """Test GET /api/lotteries endpoint"""
    
    def test_lotteries_returns_play_types(self, vendedor_token, lotteries):
        """Verify lotteries include play_types with enabled:true"""
        for lottery in lotteries[:5]:  # Check first 5 lotteries
            assert "play_types" in lottery, f"Lottery {lottery['name']} missing play_types"
            play_types = lottery["play_types"]
            
            # Check quiniela is enabled
            if "quiniela" in play_types:
                assert play_types["quiniela"]["enabled"] == True, \
                    f"Quiniela not enabled for {lottery['name']}"
            
            # Check pale is enabled
            if "pale" in play_types:
                assert play_types["pale"]["enabled"] == True, \
                    f"Pale not enabled for {lottery['name']}"
            
            # Check tripleta is enabled
            if "tripleta" in play_types:
                assert play_types["tripleta"]["enabled"] == True, \
                    f"Tripleta not enabled for {lottery['name']}"
    
    def test_lotteries_have_is_open_status(self, lotteries):
        """Verify lotteries have is_open field"""
        for lottery in lotteries[:5]:
            assert "is_open" in lottery, f"Lottery {lottery['name']} missing is_open field"
            assert isinstance(lottery["is_open"], bool), \
                f"is_open should be boolean for {lottery['name']}"


class TestTicketsMultiAPI:
    """Test POST /api/tickets/multi endpoint"""
    
    def test_create_quiniela_ticket(self, vendedor_token, lotteries):
        """Test creating a quiniela ticket (single number)"""
        # Find an open lottery
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        assert open_lottery is not None, "No open lottery found"
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_type": "quiniela",
                    "lottery_id": open_lottery["id"],
                    "numbers": [25],
                    "amount": 20
                }],
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Failed to create quiniela: {response.text}"
        data = response.json()
        
        # Verify ticket structure
        assert "ticket_number" in data
        assert data["ticket_type"] == "multi_play"
        assert data["plays_count"] == 1
        assert data["total_amount"] == 20
        assert data["status"] == "pending"
        
        # Verify play details
        assert len(data["plays"]) == 1
        play = data["plays"][0]
        assert play["lottery_type"] == "quiniela"
        assert play["numbers"] == [25]
        assert play["amount"] == 20
        
        print(f"SUCCESS: Created quiniela ticket {data['ticket_number']}")
    
    def test_create_pale_ticket(self, vendedor_token, lotteries):
        """Test creating a pale ticket (two numbers)"""
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        assert open_lottery is not None, "No open lottery found"
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_type": "pale",
                    "lottery_id": open_lottery["id"],
                    "numbers": [25, 50],
                    "amount": 20
                }],
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Failed to create pale: {response.text}"
        data = response.json()
        
        assert data["plays_count"] == 1
        play = data["plays"][0]
        assert play["lottery_type"] == "pale"
        assert play["numbers"] == [25, 50]
        
        print(f"SUCCESS: Created pale ticket {data['ticket_number']}")
    
    def test_create_tripleta_ticket(self, vendedor_token, lotteries):
        """Test creating a tripleta ticket (three numbers)"""
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        assert open_lottery is not None, "No open lottery found"
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_type": "tripleta",
                    "lottery_id": open_lottery["id"],
                    "numbers": [25, 50, 80],
                    "amount": 20
                }],
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Failed to create tripleta: {response.text}"
        data = response.json()
        
        assert data["plays_count"] == 1
        play = data["plays"][0]
        assert play["lottery_type"] == "tripleta"
        assert play["numbers"] == [25, 50, 80]
        
        print(f"SUCCESS: Created tripleta ticket {data['ticket_number']}")
    
    def test_create_multi_play_ticket(self, vendedor_token, lotteries):
        """Test creating a ticket with multiple plays (quiniela + pale + tripleta)"""
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        assert open_lottery is not None, "No open lottery found"
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [
                    {"lottery_type": "quiniela", "lottery_id": open_lottery["id"], "numbers": [10], "amount": 20},
                    {"lottery_type": "pale", "lottery_id": open_lottery["id"], "numbers": [10, 20], "amount": 20},
                    {"lottery_type": "tripleta", "lottery_id": open_lottery["id"], "numbers": [10, 20, 30], "amount": 20}
                ],
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Failed to create multi-play: {response.text}"
        data = response.json()
        
        assert data["plays_count"] == 3
        assert data["total_amount"] == 60  # 20 * 3 plays
        assert len(data["plays"]) == 3
        
        # Verify each play type
        play_types = [p["lottery_type"] for p in data["plays"]]
        assert "quiniela" in play_types
        assert "pale" in play_types
        assert "tripleta" in play_types
        
        print(f"SUCCESS: Created multi-play ticket {data['ticket_number']} with 3 plays")
    
    def test_invalid_number_count_fails(self, vendedor_token, lotteries):
        """Test that wrong number count for play type fails"""
        open_lottery = next((l for l in lotteries if l["is_open"]), None)
        
        # Try creating pale with wrong number count (1 instead of 2)
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_type": "pale",
                    "lottery_id": open_lottery["id"],
                    "numbers": [25],  # Only 1 number, pale needs 2
                    "amount": 20
                }],
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 400, "Should fail with wrong number count"
        print("SUCCESS: Correctly rejected pale with wrong number count")


class TestDrawsAPI:
    """Test draws endpoints"""
    
    def test_get_draws(self, admin_token):
        """Test fetching draws list"""
        response = requests.get(
            f"{BASE_URL}/api/draws?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get draws: {response.text}"
        data = response.json()
        
        # If draws exist, verify structure
        if len(data) > 0:
            draw = data[0]
            assert "lottery_name" in draw
            assert "draw_time" in draw
            
            # Check for prize fields (multi-prize format)
            if "first_prize" in draw:
                print(f"Draw {draw['lottery_name']}: 1st={draw['first_prize']}, 2nd={draw.get('second_prize')}, 3rd={draw.get('third_prize')}")
            elif "winning_numbers" in draw:
                print(f"Draw {draw['lottery_name']}: numbers={draw['winning_numbers']}")
        
        print(f"SUCCESS: Retrieved {len(data)} draws")


class TestNotificationsAPI:
    """Test notifications endpoints"""
    
    def test_get_notifications(self, admin_token):
        """Test fetching notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        data = response.json()
        
        # If notifications exist, verify structure
        if len(data) > 0:
            notification = data[0]
            assert "type" in notification
            assert "created_at" in notification
            
            if notification["type"] == "draw_result":
                assert "lottery_name" in notification
                if "winning_numbers" in notification:
                    print(f"Draw result notification: {notification['lottery_name']} - {notification['winning_numbers']}")
        
        print(f"SUCCESS: Retrieved {len(data)} notifications")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

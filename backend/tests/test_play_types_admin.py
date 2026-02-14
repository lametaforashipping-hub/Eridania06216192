"""
Test play types admin features - Iteration 24
Tests:
1. GET /api/lotteries - returns play_types with each lottery
2. PUT /api/lotteries/{id}/play-types/{type} - update multipliers and enabled status
3. Ticket creation with lottery_type field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://sales-shortcuts-app.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_CREDS = {"email": "admin@loteria.com", "password": "admin123"}
SELLER_CREDS = {"email": "vendedor@test.com", "password": "12345678"}


@pytest.fixture(scope="module")
def super_admin_token():
    """Get super admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def seller_token():
    """Get seller auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SELLER_CREDS)
    assert response.status_code == 200, f"Seller login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def lottery_with_play_types(super_admin_token):
    """Get a lottery that has play_types configured"""
    response = requests.get(f"{BASE_URL}/api/lotteries")
    assert response.status_code == 200
    lotteries = response.json()
    
    # Find a lottery with play_types
    for lottery in lotteries:
        if lottery.get("play_types"):
            return lottery
    
    pytest.skip("No lottery with play_types found")


class TestPlayTypesLotteryEndpoint:
    """Test that lotteries endpoint returns play_types"""
    
    def test_lotteries_have_play_types(self):
        """Verify lotteries include play_types in response"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        assert response.status_code == 200
        
        lotteries = response.json()
        assert len(lotteries) > 0, "No lotteries found"
        
        # Check first lottery has play_types
        lottery = lotteries[0]
        assert "play_types" in lottery, "Lottery missing play_types field"
        
        play_types = lottery["play_types"]
        assert "quiniela" in play_types, "Missing quiniela play type"
        assert "pale" in play_types, "Missing pale play type"
        
    def test_play_type_structure(self):
        """Verify play_types have correct structure"""
        response = requests.get(f"{BASE_URL}/api/lotteries")
        lotteries = response.json()
        lottery = lotteries[0]
        
        quiniela = lottery["play_types"]["quiniela"]
        
        # Verify structure
        assert "name" in quiniela
        assert "numbers_count" in quiniela
        assert "multipliers" in quiniela
        assert "enabled" in quiniela
        
        # Verify multipliers structure
        multipliers = quiniela["multipliers"]
        assert "first" in multipliers
        assert "second" in multipliers
        assert "third" in multipliers
        
        # Verify values are numbers
        assert isinstance(multipliers["first"], (int, float))
        assert isinstance(multipliers["second"], (int, float))
        assert isinstance(multipliers["third"], (int, float))


class TestPlayTypesAdminEndpoint:
    """Test PUT /api/lotteries/{id}/play-types/{type} endpoint"""
    
    def test_update_play_type_multipliers(self, super_admin_token, lottery_with_play_types):
        """Test updating multipliers for a play type"""
        lottery_id = lottery_with_play_types["id"]
        
        # Get original values
        original = lottery_with_play_types["play_types"]["quiniela"]["multipliers"]
        
        # Update with new values
        new_multipliers = {
            "first": 65,
            "second": 18,
            "third": 8
        }
        
        response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/quiniela",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "multipliers": new_multipliers,
                "enabled": True
            }
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "play_type" in data
        assert data["play_type"] == "quiniela"
        assert "config" in data
        assert data["config"]["multipliers"]["first"] == 65
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        assert verify_response.status_code == 200
        updated_lottery = verify_response.json()
        updated_multipliers = updated_lottery["play_types"]["quiniela"]["multipliers"]
        
        assert updated_multipliers["first"] == 65
        assert updated_multipliers["second"] == 18
        assert updated_multipliers["third"] == 8
        
        # Restore original values
        requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/quiniela",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "multipliers": original,
                "enabled": True
            }
        )
    
    def test_update_play_type_enabled_status(self, super_admin_token, lottery_with_play_types):
        """Test toggling enabled status for a play type"""
        lottery_id = lottery_with_play_types["id"]
        
        # Get original enabled status
        original_enabled = lottery_with_play_types["play_types"]["tripleta"]["enabled"]
        
        # Disable tripleta
        response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/tripleta",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "enabled": False
            }
        )
        
        assert response.status_code == 200
        
        # Verify it was disabled
        verify_response = requests.get(f"{BASE_URL}/api/lotteries/{lottery_id}")
        updated_lottery = verify_response.json()
        assert updated_lottery["play_types"]["tripleta"]["enabled"] == False
        
        # Restore original status
        requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/tripleta",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "enabled": original_enabled
            }
        )
    
    def test_update_invalid_play_type(self, super_admin_token, lottery_with_play_types):
        """Test updating a non-existent play type returns 400"""
        lottery_id = lottery_with_play_types["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/invalid_type",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"multipliers": {"first": 10, "second": 5, "third": 2}}
        )
        
        assert response.status_code == 400
        assert "no existe" in response.json()["detail"].lower()
    
    def test_seller_cannot_update_play_types(self, seller_token, lottery_with_play_types):
        """Test that non-super_admin cannot update play types"""
        lottery_id = lottery_with_play_types["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/lotteries/{lottery_id}/play-types/quiniela",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"multipliers": {"first": 10, "second": 5, "third": 2}}
        )
        
        # Should be forbidden for non-super_admin
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestTicketCreationWithLotteryType:
    """Test ticket creation with lottery_type field (bug fix verification)"""
    
    def test_create_ticket_with_quiniela(self, seller_token, lottery_with_play_types):
        """Test creating a ticket with lottery_type=quiniela"""
        lottery_id = lottery_with_play_types["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {seller_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_id": lottery_id,
                    "lottery_type": "quiniela",  # This is the bug fix - using lottery_type
                    "numbers": [25],
                    "amount": 20
                }],
                "customer_name": "TEST_play_types_test",
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Ticket creation failed: {response.text}"
        ticket = response.json()
        
        assert "ticket_number" in ticket
        assert ticket["ticket_number"].startswith("TKT-")
        assert len(ticket["plays"]) == 1
        assert ticket["plays"][0]["lottery_type"] == "quiniela"
        assert ticket["plays"][0]["numbers"] == [25]
    
    def test_create_ticket_with_pale(self, seller_token, lottery_with_play_types):
        """Test creating a ticket with lottery_type=pale (2 numbers)"""
        lottery_id = lottery_with_play_types["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {seller_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [{
                    "lottery_id": lottery_id,
                    "lottery_type": "pale",
                    "numbers": [12, 34],
                    "amount": 50
                }],
                "customer_name": "TEST_pale_test",
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Pale ticket creation failed: {response.text}"
        ticket = response.json()
        
        assert "ticket_number" in ticket
        assert len(ticket["plays"]) == 1
        assert ticket["plays"][0]["lottery_type"] == "pale"
        assert len(ticket["plays"][0]["numbers"]) == 2
    
    def test_create_multi_play_ticket(self, seller_token, lottery_with_play_types):
        """Test creating a multi-play ticket with different lottery_types"""
        lottery_id = lottery_with_play_types["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={
                "Authorization": f"Bearer {seller_token}",
                "Content-Type": "application/json"
            },
            json={
                "plays": [
                    {
                        "lottery_id": lottery_id,
                        "lottery_type": "quiniela",
                        "numbers": [7],
                        "amount": 10
                    },
                    {
                        "lottery_id": lottery_id,
                        "lottery_type": "pale",
                        "numbers": [7, 21],
                        "amount": 25
                    }
                ],
                "customer_name": "TEST_multi_play",
                "currency": "RD$"
            }
        )
        
        assert response.status_code == 200, f"Multi-play ticket creation failed: {response.text}"
        ticket = response.json()
        
        assert "ticket_number" in ticket
        assert len(ticket["plays"]) == 2
        assert ticket["total_amount"] == 35.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

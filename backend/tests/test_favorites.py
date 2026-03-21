"""
Test module for Favorites functionality (Jugadas Favoritas)
Tests CRUD operations: Create, Read, Use, Delete favorites
Also tests ticket payment for won tickets (Pago de tickets ganadores)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://expo-seller-app.preview.emergentagent.com').rstrip('/')

class TestFavorites:
    """Test favorites CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user_id = data["user"]["id"]
        yield
        # Cleanup: Delete test favorites
        try:
            favorites = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers).json()
            for fav in favorites:
                if fav["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/favorites/{fav['id']}", headers=self.headers)
        except:
            pass
    
    def test_login_success(self):
        """Test login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@loteria.com"
    
    def test_get_favorites_returns_list(self):
        """Test GET /api/favorites returns a list"""
        response = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_favorite_with_single_play(self):
        """Test POST /api/favorites creates favorite with single play"""
        payload = {
            "name": "TEST_Single_Play_Favorite",
            "plays": [
                {"lottery_type": "quiniela", "numbers": [77], "amount": 20}
            ],
            "currency": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Single_Play_Favorite"
        assert len(data["plays"]) == 1
        assert data["plays"][0]["numbers"] == [77]
        assert data["plays"][0]["lottery_type"] == "quiniela"
        assert data["currency"] == "RD"
        assert data["use_count"] == 0
    
    def test_create_favorite_with_multiple_plays(self):
        """Test POST /api/favorites creates favorite with multiple plays"""
        payload = {
            "name": "TEST_Multi_Play_Favorite",
            "plays": [
                {"lottery_type": "quiniela", "numbers": [25], "amount": 20},
                {"lottery_type": "pale", "numbers": [15, 30], "amount": 50},
                {"lottery_type": "tripleta", "numbers": [10, 20, 30], "amount": 100}
            ],
            "currency": "RD"
        }
        response = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Multi_Play_Favorite"
        assert len(data["plays"]) == 3
        assert data["plays"][0]["lottery_type"] == "quiniela"
        assert data["plays"][1]["lottery_type"] == "pale"
        assert data["plays"][1]["numbers"] == [15, 30]
        assert data["plays"][2]["lottery_type"] == "tripleta"
        assert data["plays"][2]["numbers"] == [10, 20, 30]
    
    def test_create_favorite_duplicate_name_fails(self):
        """Test POST /api/favorites fails with duplicate name"""
        payload = {
            "name": "TEST_Duplicate_Favorite",
            "plays": [{"lottery_type": "quiniela", "numbers": [99], "amount": 20}],
            "currency": "RD"
        }
        # Create first time
        response1 = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert response1.status_code == 200
        
        # Try to create with same name
        response2 = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert response2.status_code == 400
        assert "Ya existe un favorito con ese nombre" in response2.json()["detail"]
    
    def test_use_favorite_increments_count(self):
        """Test POST /api/favorites/{id}/use increments use_count"""
        # Create a favorite first
        payload = {
            "name": "TEST_Use_Counter_Favorite",
            "plays": [{"lottery_type": "quiniela", "numbers": [55], "amount": 20}],
            "currency": "RD"
        }
        create_response = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        favorite_id = create_response.json()["id"]
        
        # Use the favorite
        use_response = requests.post(f"{BASE_URL}/api/favorites/{favorite_id}/use", headers=self.headers)
        assert use_response.status_code == 200
        assert use_response.json()["message"] == "Uso registrado"
        
        # Verify use_count increased
        get_response = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers)
        favorites = get_response.json()
        found = next((f for f in favorites if f["id"] == favorite_id), None)
        assert found is not None
        assert found["use_count"] == 1
        
        # Use again
        requests.post(f"{BASE_URL}/api/favorites/{favorite_id}/use", headers=self.headers)
        get_response2 = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers)
        favorites2 = get_response2.json()
        found2 = next((f for f in favorites2 if f["id"] == favorite_id), None)
        assert found2["use_count"] == 2
    
    def test_delete_favorite_success(self):
        """Test DELETE /api/favorites/{id} removes the favorite"""
        # Create a favorite first
        payload = {
            "name": "TEST_Delete_Me_Favorite",
            "plays": [{"lottery_type": "quiniela", "numbers": [11], "amount": 20}],
            "currency": "RD"
        }
        create_response = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        favorite_id = create_response.json()["id"]
        
        # Delete the favorite
        delete_response = requests.delete(f"{BASE_URL}/api/favorites/{favorite_id}", headers=self.headers)
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Favorito eliminado"
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers)
        favorites = get_response.json()
        found = next((f for f in favorites if f["id"] == favorite_id), None)
        assert found is None
    
    def test_delete_nonexistent_favorite_returns_404(self):
        """Test DELETE /api/favorites/{id} with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/favorites/nonexistent-id-12345", headers=self.headers)
        assert response.status_code == 404
        assert "Favorito no encontrado" in response.json()["detail"]
    
    def test_favorites_sorted_by_use_count(self):
        """Test GET /api/favorites returns favorites sorted by use_count DESC"""
        # Create multiple favorites and use them different times
        for i, count in enumerate([3, 1, 5, 2]):
            payload = {
                "name": f"TEST_Sort_Favorite_{i}",
                "plays": [{"lottery_type": "quiniela", "numbers": [i + 10], "amount": 20}],
                "currency": "RD"
            }
            create_resp = requests.post(f"{BASE_URL}/api/favorites", json=payload, headers=self.headers)
            fav_id = create_resp.json()["id"]
            for _ in range(count):
                requests.post(f"{BASE_URL}/api/favorites/{fav_id}/use", headers=self.headers)
        
        # Get favorites and check order
        get_response = requests.get(f"{BASE_URL}/api/favorites", headers=self.headers)
        favorites = [f for f in get_response.json() if f["name"].startswith("TEST_Sort_")]
        
        # Should be sorted by use_count descending
        use_counts = [f["use_count"] for f in favorites]
        assert use_counts == sorted(use_counts, reverse=True), f"Favorites not sorted correctly: {use_counts}"


class TestTicketPayment:
    """Test ticket payment for winning tickets"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pay_pending_ticket_fails(self):
        """Test POST /api/tickets/{id}/pay fails for pending tickets"""
        # Get a pending ticket
        response = requests.get(f"{BASE_URL}/api/tickets?status=pending", headers=self.headers)
        tickets = response.json()
        
        if tickets:
            ticket_id = tickets[0]["id"]
            pay_response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/pay", headers=self.headers)
            assert pay_response.status_code == 400
            assert "no es ganador o ya fue pagado" in pay_response.json()["detail"]
    
    def test_pay_lost_ticket_fails(self):
        """Test POST /api/tickets/{id}/pay fails for lost tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=lost", headers=self.headers)
        tickets = response.json()
        
        if tickets:
            ticket_id = tickets[0]["id"]
            pay_response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/pay", headers=self.headers)
            assert pay_response.status_code == 400
            assert "no es ganador o ya fue pagado" in pay_response.json()["detail"]
    
    def test_pay_won_ticket_success(self):
        """Test POST /api/tickets/{id}/pay succeeds for won tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=won", headers=self.headers)
        tickets = response.json()
        
        if tickets:
            ticket = tickets[0]
            ticket_id = ticket["id"]
            
            # Pay the ticket
            pay_response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/pay", headers=self.headers)
            assert pay_response.status_code == 200
            
            data = pay_response.json()
            assert data["message"] == "Premio pagado"
            assert "ticket_number" in data
            assert "amount_paid" in data
            assert data["amount_paid"] > 0
            assert "currency" in data
            
            # Verify ticket status changed to paid
            verify_response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers=self.headers)
            assert verify_response.status_code == 200
            verify_data = verify_response.json()
            assert verify_data["status"] == "paid"
            assert verify_data.get("paid_at") is not None
    
    def test_pay_already_paid_ticket_fails(self):
        """Test POST /api/tickets/{id}/pay fails for already paid tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=paid", headers=self.headers)
        tickets = response.json()
        
        if tickets:
            ticket_id = tickets[0]["id"]
            pay_response = requests.post(f"{BASE_URL}/api/tickets/{ticket_id}/pay", headers=self.headers)
            assert pay_response.status_code == 400
            assert "no es ganador o ya fue pagado" in pay_response.json()["detail"]
    
    def test_pay_nonexistent_ticket_fails(self):
        """Test POST /api/tickets/{id}/pay fails for nonexistent ticket"""
        pay_response = requests.post(f"{BASE_URL}/api/tickets/nonexistent-ticket-id/pay", headers=self.headers)
        assert pay_response.status_code == 404
        assert "Boleto no encontrado" in pay_response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

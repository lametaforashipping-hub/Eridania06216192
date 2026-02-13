"""
Test Suite for Super Admin Impersonation Feature
Tests the ability of Super Admin to create tickets on behalf of a seller (vendedor)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lottery-refactor.preview.emergentagent.com').rstrip('/')

class TestImpersonation:
    """Impersonation feature tests - Super Admin creates tickets as a vendedor"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get Super Admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Super Admin login failed - skipping impersonation tests")
    
    @pytest.fixture
    def super_admin_client(self, super_admin_token):
        """Session with Super Admin auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {super_admin_token}"
        })
        return session
    
    @pytest.fixture
    def vendedor_user(self, super_admin_client):
        """Get or create a vendedor user for impersonation testing"""
        # First try to find an existing vendedor
        response = super_admin_client.get(f"{BASE_URL}/api/users")
        if response.status_code == 200:
            users = response.json()
            for user in users:
                if user.get("role") == "vendedor" and user.get("email") == "vendedor@test.com":
                    return user
                # Also look for any active vendedor
                if user.get("role") == "vendedor" and user.get("active", True):
                    return user
        
        # Create a new vendedor if none found
        response = super_admin_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": "vendedor_impersonate_test@test.com",
            "password": "test123",
            "name": "Test Vendedor Impersonate",
            "role": "vendedor",
            "credit_limit": 50000.0,
            "commission_rate": 10.0,
            "country": "RD"
        })
        
        if response.status_code == 200:
            user_id = response.json().get("user_id")
            # Fetch the created user
            user_response = super_admin_client.get(f"{BASE_URL}/api/users/{user_id}")
            if user_response.status_code == 200:
                return user_response.json()
        
        pytest.skip("Could not find or create vendedor for testing")
    
    @pytest.fixture
    def open_lottery(self, super_admin_client):
        """Get an open lottery for testing"""
        response = super_admin_client.get(f"{BASE_URL}/api/lotteries")
        if response.status_code == 200:
            lotteries = response.json()
            for lottery in lotteries:
                if lottery.get("is_open", False):
                    return lottery
        pytest.skip("No open lottery found for testing")

    def test_1_super_admin_login(self):
        """Test Super Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Super Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "super_admin"
        print("PASS: Super Admin login successful")
    
    def test_2_get_seller_profile(self, super_admin_client, vendedor_user):
        """Test Super Admin can get seller profile (required for impersonation flow)"""
        seller_id = vendedor_user.get("id")
        response = super_admin_client.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}")
        
        assert response.status_code == 200, f"Failed to get seller profile: {response.text}"
        data = response.json()
        assert "seller" in data
        assert data["seller"]["id"] == seller_id
        print(f"PASS: Got seller profile for {data['seller']['name']}")
    
    def test_3_multi_play_endpoint_accepts_act_as_user_id(self, super_admin_client, vendedor_user, open_lottery):
        """Test that POST /api/tickets/multi accepts act_as_user_id parameter"""
        seller_id = vendedor_user.get("id")
        seller_name = vendedor_user.get("name")
        
        # Get seller's current balance
        initial_response = super_admin_client.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}")
        initial_balance = initial_response.json()["seller"]["balance"] if initial_response.status_code == 200 else 0
        
        # Create multi-play ticket with act_as_user_id
        response = super_admin_client.post(f"{BASE_URL}/api/tickets/multi", json={
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "numbers": [42],
                    "amount": 10
                }
            ],
            "customer_name": "Test Impersonation Customer",
            "currency": "RD$",
            "act_as_user_id": seller_id
        })
        
        assert response.status_code == 200, f"Failed to create impersonated ticket: {response.text}"
        ticket = response.json()
        
        # Verify ticket was created with seller's ID
        assert ticket.get("seller_id") == seller_id, f"Ticket seller_id should be {seller_id}, got {ticket.get('seller_id')}"
        assert ticket.get("seller_name") == seller_name, f"Ticket seller_name should be {seller_name}"
        assert "ticket_number" in ticket
        assert ticket.get("impersonated_by") is not None, "impersonated_by field should be set"
        
        print(f"PASS: Created ticket {ticket['ticket_number']} as seller {seller_name}")
        print(f"  - seller_id: {ticket.get('seller_id')}")
        print(f"  - impersonated_by: {ticket.get('impersonated_by')}")
    
    def test_4_impersonated_ticket_updates_seller_stats(self, super_admin_client, vendedor_user, open_lottery):
        """Test that impersonated ticket correctly updates seller's stats and balance"""
        seller_id = vendedor_user.get("id")
        
        # Get seller's current stats before creating ticket
        before_response = super_admin_client.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}")
        assert before_response.status_code == 200
        before_data = before_response.json()["seller"]
        before_balance = before_data.get("balance", 0)
        before_sales = before_data.get("total_sales", 0)
        before_commission = before_data.get("total_commission", 0)
        
        # Create an impersonated ticket
        ticket_amount = 25  # RD$25
        commission_rate = before_data.get("commission_rate", 10.0)
        expected_commission = ticket_amount * (commission_rate / 100)
        
        # Use random number to avoid ticket limits
        import random
        test_number = random.randint(0, 99)
        
        response = super_admin_client.post(f"{BASE_URL}/api/tickets/multi", json={
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "numbers": [test_number],
                    "amount": ticket_amount
                }
            ],
            "currency": "RD$",
            "act_as_user_id": seller_id
        })
        
        assert response.status_code == 200, f"Failed to create impersonated ticket: {response.text}"
        
        # Get seller's stats after creating ticket
        after_response = super_admin_client.get(f"{BASE_URL}/api/admin/seller-profile/{seller_id}")
        assert after_response.status_code == 200
        after_data = after_response.json()["seller"]
        
        # Verify stats were updated
        assert after_data["total_sales"] == before_sales + ticket_amount, \
            f"Total sales should increase by {ticket_amount}"
        assert after_data["total_commission"] >= before_commission + expected_commission - 0.01, \
            f"Commission should increase by ~{expected_commission}"
        assert after_data["balance"] >= before_balance + expected_commission - 0.01, \
            f"Balance should increase by commission"
        
        print(f"PASS: Seller stats correctly updated:")
        print(f"  - Sales: {before_sales} -> {after_data['total_sales']}")
        print(f"  - Commission: {before_commission} -> {after_data['total_commission']}")
        print(f"  - Balance: {before_balance} -> {after_data['balance']}")
    
    def test_5_non_super_admin_cannot_impersonate(self):
        """Test that non-super-admin users cannot use act_as_user_id"""
        # First, get a vendedor token
        # Try to find/create a vendedor
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        
        if admin_response.status_code != 200:
            pytest.skip("Cannot get admin token to create vendedor")
        
        admin_token = admin_response.json()["token"]
        
        # Find an existing vendedor to login as
        users_response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        vendedor_email = None
        another_seller_id = None
        
        if users_response.status_code == 200:
            users = users_response.json()
            for user in users:
                if user.get("role") == "vendedor":
                    if vendedor_email is None:
                        vendedor_email = user.get("email")
                    else:
                        another_seller_id = user.get("id")
                        break
        
        if not vendedor_email:
            pytest.skip("No vendedor user found for testing")
        
        # Login as vendedor
        vendedor_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": vendedor_email,
            "password": "test123"  # Default test password
        })
        
        if vendedor_response.status_code != 200:
            # Try with different password
            vendedor_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": vendedor_email,
                "password": "password123"
            })
        
        if vendedor_response.status_code != 200:
            print("SKIP: Could not login as vendedor (unknown password)")
            pytest.skip("Could not login as vendedor")
        
        vendedor_token = vendedor_response.json()["token"]
        
        # Try to create a ticket with impersonation (should fail)
        target_id = another_seller_id or "some-fake-id"
        
        impersonate_response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            headers={"Authorization": f"Bearer {vendedor_token}", "Content-Type": "application/json"},
            json={
                "plays": [{"lottery_type": "quiniela", "numbers": [55], "amount": 10}],
                "currency": "RD$",
                "act_as_user_id": target_id
            }
        )
        
        # Should fail with 403 (Forbidden)
        assert impersonate_response.status_code == 403, \
            f"Non-super-admin should not be able to impersonate. Got status {impersonate_response.status_code}: {impersonate_response.text}"
        
        print("PASS: Non-super-admin correctly blocked from impersonation")
    
    def test_6_impersonation_with_invalid_user_id(self, super_admin_client):
        """Test that impersonation with invalid user ID returns 404"""
        response = super_admin_client.post(f"{BASE_URL}/api/tickets/multi", json={
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "numbers": [99],
                    "amount": 10
                }
            ],
            "currency": "RD$",
            "act_as_user_id": "invalid-user-id-that-does-not-exist"
        })
        
        assert response.status_code == 404, \
            f"Expected 404 for invalid user ID, got {response.status_code}: {response.text}"
        
        print("PASS: Invalid user ID correctly returns 404")
    
    def test_7_impersonated_ticket_appears_in_seller_tickets(self, super_admin_client, vendedor_user, open_lottery):
        """Test that impersonated tickets appear in the seller's ticket list"""
        seller_id = vendedor_user.get("id")
        
        # Create an impersonated ticket with a unique customer name
        unique_customer = f"Impersonate_Test_{os.urandom(4).hex()}"
        
        response = super_admin_client.post(f"{BASE_URL}/api/tickets/multi", json={
            "plays": [
                {
                    "lottery_type": "quiniela",
                    "numbers": [33],
                    "amount": 15
                }
            ],
            "customer_name": unique_customer,
            "currency": "RD$",
            "act_as_user_id": seller_id
        })
        
        assert response.status_code == 200, f"Failed to create ticket: {response.text}"
        created_ticket = response.json()
        ticket_id = created_ticket["id"]
        
        # Get tickets for this seller
        tickets_response = super_admin_client.get(f"{BASE_URL}/api/tickets?seller_id={seller_id}")
        assert tickets_response.status_code == 200
        
        tickets = tickets_response.json()
        ticket_found = any(t.get("id") == ticket_id for t in tickets)
        
        assert ticket_found, f"Created ticket {ticket_id} should appear in seller's ticket list"
        
        print(f"PASS: Impersonated ticket {created_ticket['ticket_number']} found in seller's tickets")


class TestImpersonationUI:
    """Tests for UI elements related to impersonation (data-testid verification)"""
    
    @pytest.fixture
    def super_admin_client(self):
        """Get Super Admin authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            session = requests.Session()
            session.headers.update({
                "Content-Type": "application/json",
                "Authorization": f"Bearer {response.json()['token']}"
            })
            return session
        pytest.skip("Super Admin login failed")
    
    def test_seller_profile_endpoint_for_impersonate_button(self, super_admin_client):
        """Verify the seller profile endpoint works (needed for impersonate button)"""
        # Get list of users to find a seller
        users_response = super_admin_client.get(f"{BASE_URL}/api/users")
        assert users_response.status_code == 200
        
        users = users_response.json()
        seller = next((u for u in users if u.get("role") == "vendedor"), None)
        
        if not seller:
            pytest.skip("No vendedor found")
        
        # Test the seller profile endpoint
        profile_response = super_admin_client.get(f"{BASE_URL}/api/admin/seller-profile/{seller['id']}")
        assert profile_response.status_code == 200
        
        profile = profile_response.json()
        assert "seller" in profile
        assert "today_stats" in profile
        assert "recent_tickets" in profile
        
        print(f"PASS: Seller profile endpoint returns correct structure for {seller['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test unified receipt image endpoint
Tests:
1. GET /api/tickets/receipt-image/{ticket_number} - Returns valid PNG image
2. Content-Type is image/png
3. Returns 404 for non-existent ticket
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vite-migration-test.preview.emergentagent.com').rstrip('/')


class TestReceiptImageEndpoint:
    """Test the unified receipt image endpoint"""
    
    @pytest.fixture
    def seller_token(self):
        """Get seller authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def create_test_ticket(self, seller_token):
        """Create a test ticket and return its ticket_number"""
        # First get available lotteries
        lotteries_response = requests.get(f"{BASE_URL}/api/lotteries")
        if lotteries_response.status_code != 200:
            pytest.skip("Could not fetch lotteries")
        
        lotteries = lotteries_response.json()
        open_lottery = next((l for l in lotteries if l.get('is_open')), None)
        if not open_lottery:
            pytest.skip("No open lottery available")
        
        # Create a multi-play ticket
        ticket_data = {
            "plays": [{
                "lottery_type": "quiniela",
                "lottery_id": open_lottery.get('id'),
                "numbers": [42],
                "amount": 10
            }],
            "customer_name": "Test Receipt",
            "currency": "RD$"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=ticket_data,
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        
        if response.status_code in [200, 201]:
            ticket = response.json()
            return ticket.get("ticket_number")
        pytest.skip(f"Could not create test ticket: {response.status_code} - {response.text}")
    
    def test_receipt_image_returns_png(self, create_test_ticket):
        """Test that receipt-image endpoint returns valid PNG"""
        ticket_number = create_test_ticket
        
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Content-Type assertion
        content_type = response.headers.get('Content-Type', '')
        assert 'image/png' in content_type, f"Expected image/png, got {content_type}"
        
        # Check PNG magic bytes
        png_magic = b'\x89PNG\r\n\x1a\n'
        assert response.content[:8] == png_magic, "Response is not a valid PNG file"
        
        # Check reasonable file size (should be > 1KB for a receipt)
        assert len(response.content) > 1000, f"PNG too small: {len(response.content)} bytes"
        
        print(f"✅ Receipt image for {ticket_number}: {len(response.content)} bytes, Content-Type: {content_type}")
    
    def test_receipt_image_with_existing_ticket(self):
        """Test receipt-image with known existing ticket DEMO695A10002"""
        ticket_number = "DEMO695A10002"
        
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Content-Type assertion
        content_type = response.headers.get('Content-Type', '')
        assert 'image/png' in content_type, f"Expected image/png, got {content_type}"
        
        # Check PNG magic bytes
        png_magic = b'\x89PNG\r\n\x1a\n'
        assert response.content[:8] == png_magic, "Response is not a valid PNG file"
        
        print(f"✅ Receipt image for {ticket_number}: {len(response.content)} bytes")
    
    def test_receipt_image_not_found(self):
        """Test that non-existent ticket returns 404"""
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/INVALID-TICKET-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent ticket returns 404")
    
    def test_receipt_image_content_disposition(self, create_test_ticket):
        """Test that Content-Disposition header is set correctly"""
        ticket_number = create_test_ticket
        
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        assert response.status_code == 200
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'inline' in content_disposition or 'attachment' in content_disposition
        assert ticket_number in content_disposition
        
        print(f"✅ Content-Disposition: {content_disposition}")
    
    def test_receipt_image_cache_control(self, create_test_ticket):
        """Test that Cache-Control header is set to no-cache"""
        ticket_number = create_test_ticket
        
        response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        assert response.status_code == 200
        
        cache_control = response.headers.get('Cache-Control', '')
        assert 'no-cache' in cache_control, f"Expected no-cache, got {cache_control}"
        
        print(f"✅ Cache-Control: {cache_control}")


class TestReceiptImageIntegration:
    """Integration tests for receipt image with ticket creation"""
    
    @pytest.fixture
    def seller_token(self):
        """Get seller authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_create_ticket_and_get_receipt(self, seller_token):
        """Test full flow: create ticket -> get receipt image"""
        # Get lotteries
        lotteries_response = requests.get(f"{BASE_URL}/api/lotteries")
        assert lotteries_response.status_code == 200
        
        lotteries = lotteries_response.json()
        open_lottery = next((l for l in lotteries if l.get('is_open')), None)
        if not open_lottery:
            pytest.skip("No open lottery")
        
        # Create ticket
        ticket_data = {
            "plays": [
                {"lottery_type": "quiniela", "lottery_id": open_lottery.get('id'), "numbers": [25], "amount": 20},
                {"lottery_type": "pale", "lottery_id": open_lottery.get('id'), "numbers": [25, 50], "amount": 30}
            ],
            "customer_name": "Integration Test",
            "currency": "RD$"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/tickets/multi",
            json=ticket_data,
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        
        assert create_response.status_code in [200, 201], f"Ticket creation failed: {create_response.text}"
        
        ticket = create_response.json()
        ticket_number = ticket.get("ticket_number")
        assert ticket_number, "No ticket_number in response"
        
        # Get receipt image
        receipt_response = requests.get(f"{BASE_URL}/api/tickets/receipt-image/{ticket_number}")
        
        assert receipt_response.status_code == 200
        assert 'image/png' in receipt_response.headers.get('Content-Type', '')
        
        # Verify PNG
        png_magic = b'\x89PNG\r\n\x1a\n'
        assert receipt_response.content[:8] == png_magic
        
        print(f"✅ Full flow test passed: Created ticket {ticket_number}, receipt image: {len(receipt_response.content)} bytes")
        
        # Verify ticket data
        assert ticket.get("total_amount") == 50  # 20 + 30
        assert len(ticket.get("plays", [])) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

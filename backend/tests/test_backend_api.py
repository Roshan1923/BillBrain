import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL').rstrip('/')

class TestAuthFlow:
    """Test authentication endpoints"""
    
    def test_register_new_user(self, api_client):
        """Test user registration creates user and returns token"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        print(f"Register response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == email.lower()
        assert data["user"]["name"] == "Test User"
        assert "user_id" in data["user"]
        
        # Verify user can authenticate with token
        api_client.headers["Authorization"] = f"Bearer {data['token']}"
        me_response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["email"] == email.lower()
        print("✓ User registration and token verification successful")
    
    def test_login_with_credentials(self, api_client):
        """Test login with email and password"""
        # First register a user
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        register_payload = {
            "email": email,
            "password": "LoginTest123!",
            "name": "Login Test"
        }
        api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        
        # Now login
        login_payload = {
            "email": email,
            "password": "LoginTest123!"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        print(f"Login response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == email.lower()
        print("✓ Login successful")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login fails with invalid password"""
        payload = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        print(f"Invalid login response status: {response.status_code}")
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")
    
    def test_auth_me_requires_token(self, api_client):
        """Test /auth/me requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        print(f"Auth/me without token status: {response.status_code}")
        assert response.status_code == 401
        print("✓ Auth/me correctly requires token")


class TestCategoriesFlow:
    """Test category endpoints"""
    
    @pytest.fixture
    def authenticated_client(self, api_client):
        """Create authenticated client with test user"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        token = response.json()["token"]
        api_client.headers["Authorization"] = f"Bearer {token}"
        return api_client
    
    def test_get_default_categories(self, authenticated_client):
        """Test that 28 default categories are created (14 per section)"""
        response = authenticated_client.get(f"{BASE_URL}/api/categories")
        print(f"Get categories response status: {response.status_code}")
        
        assert response.status_code == 200
        categories = response.json()
        
        assert isinstance(categories, list), "Categories should be a list"
        assert len(categories) == 28, f"Expected 28 categories, got {len(categories)}"
        
        personal_cats = [c for c in categories if c["section"] == "personal"]
        business_cats = [c for c in categories if c["section"] == "business"]
        
        assert len(personal_cats) == 14, f"Expected 14 personal categories, got {len(personal_cats)}"
        assert len(business_cats) == 14, f"Expected 14 business categories, got {len(business_cats)}"
        
        # Check all have required fields
        for cat in categories:
            assert "category_id" in cat
            assert "name" in cat
            assert "section" in cat
            assert "is_default" in cat
            assert "_id" not in cat, "MongoDB _id should not be present"
        
        print(f"✓ Default categories verified: {len(personal_cats)} personal, {len(business_cats)} business")
    
    def test_create_custom_category(self, authenticated_client):
        """Test creating a custom category"""
        payload = {
            "name": "Custom Test Category",
            "section": "personal"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/categories", json=payload)
        print(f"Create category response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Test Category"
        assert data["section"] == "personal"
        assert data["is_default"] == False
        assert "category_id" in data
        
        # Verify it appears in GET
        get_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        categories = get_response.json()
        assert any(c["category_id"] == data["category_id"] for c in categories)
        print("✓ Custom category created and persisted")
    
    def test_update_category_name(self, authenticated_client):
        """Test updating category name"""
        # Create category first
        create_payload = {"name": "Original Name", "section": "business"}
        create_response = authenticated_client.post(f"{BASE_URL}/api/categories", json=create_payload)
        category_id = create_response.json()["category_id"]
        
        # Update it
        update_payload = {"name": "Updated Name"}
        response = authenticated_client.put(f"{BASE_URL}/api/categories/{category_id}", json=update_payload)
        print(f"Update category response status: {response.status_code}")
        
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        categories = get_response.json()
        updated_cat = next((c for c in categories if c["category_id"] == category_id), None)
        assert updated_cat is not None
        assert updated_cat["name"] == "Updated Name"
        print("✓ Category update verified")
    
    def test_delete_category(self, authenticated_client):
        """Test deleting a category"""
        # Create category
        create_payload = {"name": "To Delete", "section": "personal"}
        create_response = authenticated_client.post(f"{BASE_URL}/api/categories", json=create_payload)
        category_id = create_response.json()["category_id"]
        
        # Delete it
        response = authenticated_client.delete(f"{BASE_URL}/api/categories/{category_id}")
        print(f"Delete category response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == True
        
        # Verify it's gone
        get_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        categories = get_response.json()
        assert not any(c["category_id"] == category_id for c in categories)
        print("✓ Category deleted successfully")


class TestReceiptsFlow:
    """Test receipt endpoints"""
    
    @pytest.fixture
    def authenticated_client(self, api_client):
        """Create authenticated client with test user and get a category"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        token = response.json()["token"]
        api_client.headers["Authorization"] = f"Bearer {token}"
        return api_client
    
    def test_create_receipt(self, authenticated_client):
        """Test creating a receipt"""
        # Get a category first
        cats_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        categories = cats_response.json()
        category_id = categories[0]["category_id"]
        
        payload = {
            "merchant_name": "Test Store",
            "date": "2026-01-15",
            "total": 99.99,
            "tax": 12.99,
            "items": [{"name": "Item 1", "price": 87.00}],
            "payment_method": "Visa",
            "section": "personal",
            "category_id": category_id,
            "notes": "Test receipt",
            "image_base64": ""
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/receipts", json=payload)
        print(f"Create receipt response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["merchant_name"] == "Test Store"
        assert data["total"] == 99.99
        assert data["section"] == "personal"
        assert "receipt_id" in data
        assert "_id" not in data
        
        # Verify persistence
        receipt_id = data["receipt_id"]
        get_response = authenticated_client.get(f"{BASE_URL}/api/receipts/{receipt_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["merchant_name"] == "Test Store"
        print("✓ Receipt created and persisted")
    
    def test_get_receipts_with_filters(self, authenticated_client):
        """Test receipt list with section filter"""
        # Create receipts
        cats_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        category_id = cats_response.json()[0]["category_id"]
        
        # Personal receipt
        personal_payload = {
            "merchant_name": "Personal Store",
            "date": "2026-01-15",
            "total": 50.00,
            "tax": 5.00,
            "items": [],
            "payment_method": "Cash",
            "section": "personal",
            "category_id": category_id,
            "notes": "",
            "image_base64": ""
        }
        authenticated_client.post(f"{BASE_URL}/api/receipts", json=personal_payload)
        
        # Business receipt
        business_payload = personal_payload.copy()
        business_payload["merchant_name"] = "Business Store"
        business_payload["section"] = "business"
        authenticated_client.post(f"{BASE_URL}/api/receipts", json=business_payload)
        
        # Test section filter
        response = authenticated_client.get(f"{BASE_URL}/api/receipts?section=personal")
        print(f"Get receipts with filter status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "receipts" in data
        assert "total" in data
        receipts = data["receipts"]
        personal_receipts = [r for r in receipts if r["section"] == "personal"]
        assert len(personal_receipts) > 0
        print("✓ Receipt filters working")
    
    def test_delete_receipt(self, authenticated_client):
        """Test deleting a receipt"""
        # Create receipt
        cats_response = authenticated_client.get(f"{BASE_URL}/api/categories")
        category_id = cats_response.json()[0]["category_id"]
        
        payload = {
            "merchant_name": "To Delete",
            "date": "2026-01-15",
            "total": 10.00,
            "tax": 1.00,
            "items": [],
            "payment_method": "Cash",
            "section": "personal",
            "category_id": category_id,
            "notes": "",
            "image_base64": ""
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/receipts", json=payload)
        receipt_id = create_response.json()["receipt_id"]
        
        # Delete it
        response = authenticated_client.delete(f"{BASE_URL}/api/receipts/{receipt_id}")
        print(f"Delete receipt response status: {response.status_code}")
        
        assert response.status_code == 200
        
        # Verify it's gone
        get_response = authenticated_client.get(f"{BASE_URL}/api/receipts/{receipt_id}")
        assert get_response.status_code == 404
        print("✓ Receipt deleted successfully")


class TestDashboardAndReports:
    """Test dashboard and report endpoints"""
    
    @pytest.fixture
    def authenticated_client_with_data(self, api_client):
        """Create user with sample receipts"""
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        token = response.json()["token"]
        api_client.headers["Authorization"] = f"Bearer {token}"
        
        # Create sample receipts
        cats_response = api_client.get(f"{BASE_URL}/api/categories")
        category_id = cats_response.json()[0]["category_id"]
        
        for i in range(3):
            receipt_payload = {
                "merchant_name": f"Store {i}",
                "date": "2026-01-15",
                "total": 100.00 + i * 10,
                "tax": 13.00,
                "items": [],
                "payment_method": "Visa",
                "section": "personal" if i % 2 == 0 else "business",
                "category_id": category_id,
                "notes": "",
                "image_base64": ""
            }
            api_client.post(f"{BASE_URL}/api/receipts", json=receipt_payload)
        
        return api_client
    
    def test_dashboard_summary(self, authenticated_client_with_data):
        """Test dashboard summary returns all required data"""
        response = authenticated_client_with_data.get(f"{BASE_URL}/api/dashboard/summary")
        print(f"Dashboard summary status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "monthly" in data
        assert "yearly" in data
        assert "sections" in data
        assert "categories" in data
        assert "recent_receipts" in data
        
        # Check monthly data
        assert "total" in data["monthly"]
        assert "tax" in data["monthly"]
        assert "count" in data["monthly"]
        
        # Check recent receipts
        assert isinstance(data["recent_receipts"], list)
        print(f"✓ Dashboard summary returned with {data['monthly']['count']} monthly receipts")
    
    def test_tax_summary_report(self, authenticated_client_with_data):
        """Test tax summary report"""
        response = authenticated_client_with_data.get(f"{BASE_URL}/api/reports/tax-summary")
        print(f"Tax summary status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "summary" in data
        assert "totals" in data
        assert "personal" in data["summary"]
        assert "business" in data["summary"]
        print("✓ Tax summary report generated")
    
    def test_csv_export(self, authenticated_client_with_data):
        """Test CSV export"""
        response = authenticated_client_with_data.get(f"{BASE_URL}/api/reports/export-csv")
        print(f"CSV export status: {response.status_code}")
        
        assert response.status_code == 200
        assert 'text/csv' in response.headers.get('Content-Type', '')
        
        csv_content = response.text
        assert "Date" in csv_content
        assert "Merchant" in csv_content
        assert "Total (CAD)" in csv_content
        print("✓ CSV export successful")

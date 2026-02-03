import sys
import os
import pytest
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock Env Vars BEFORE importing app/settings
os.environ["SUPABASE_URL"] = "https://mock.supabase.co"
os.environ["SUPABASE_KEY"] = "mock-key-123"

from fastapi.testclient import TestClient
from app.main import app
from storage.repositories import repository

client = TestClient(app)

def test_api_health():
    print("\n🧪 Testing Health Endpoint...")
    response = client.get("/health")
    print(f"Status: {response.status_code}")
    print(f"Body: {response.json()}")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    print("✅ Health Check Passed")

def test_ingestion_endpoint():
    print("\n🧪 Testing Ingestion Endpoint...")
    
    # MOCK the repository to avoid real DB calls
    repository.save_artifact = MagicMock(return_value=True)
    
    payload = {
        "content": "Misir is the future of orientation.",
        "source_type": "web_page",
        "source_url": "https://misir.app",
        "metadata": {"author": "The Marshal"}
    }
    
    response = client.post("/api/v1/ingestion/test", json=payload)
    
    print(f"Status: {response.status_code}")
    print(f"Body: {response.json()}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert "id" in data
    assert "hash" in data
    
    # Verify repository was called
    repository.save_artifact.assert_called_once()
    print("✅ Ingestion Endpoint Passed (Mocked DB)")

if __name__ == "__main__":
    # fast & dirty runner
    try:
        test_api_health()
        test_ingestion_endpoint()
        print("\n🎉 All API Tests Passed!")
    except AssertionError as e:
        print(f"\n❌ Test Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

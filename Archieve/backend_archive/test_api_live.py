import sys
import os
import pytest
from dotenv import load_dotenv

# 1. Load Real Env
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from storage.repositories import repository

client = TestClient(app)

def test_live_ingestion():
    print("\n🚀 Starting LIVE Ingestion Test...")
    
    # 2. Get Valid IDs (User + Space)
    if not repository.client:
        print("❌ DB Connection Failed")
        return

    res = repository.client.table("spaces").select("id, user_id, name").limit(1).execute()
    if not res.data:
        print("❌ No spaces found to test with.")
        return
        
    space = res.data[0]
    space_id = space['id']
    user_id = space['user_id']
    print(f"✅ Using Space: '{space['name']}' ({space_id})")
    print(f"✅ Using User: {user_id}")
    
    # 3. Prepare Payload
    payload = {
        "content": "Brimstone Live Test: The Orientation Engine is Online.",
        "source_type": "text_snippet",
        "source_url": "http://internal.test/live",
        "metadata": {"test_run": "live_v1"},
        "user_id": user_id,
        "space_id": space_id
    }
    
    # 4. Hit API
    print("📡 Sending POST /ingestion/test...")
    response = client.post("/api/v1/ingestion/test", json=payload)
    
    print(f"Status: {response.status_code}")
    print(f"Body: {response.json()}")
    
    assert response.status_code == 200
    data = response.json()
    artifact_id = data["id"]
    
    # 5. Verify Persistence (Artifact)
    print("🔍 Verifying Persistence in 'artifacts'...")
    art_res = repository.client.table("artifacts").select("*").eq("id", artifact_id).execute()
    assert len(art_res.data) == 1
    print("✅ Artifact found in DB.")
    
    # 6. Verify Persistence (Signal/Vector)
    print("🔍 Verifying Persistence in 'signals'...")
    sig_res = repository.client.table("signals").select("*").eq("artifact_id", artifact_id).execute()
    # Note: Depending on async pipeline, signal might be slightly delayed? 
    # But our current implementation is synchronous.
    assert len(sig_res.data) >= 1
    print(f"✅ Signal found in DB. Vector size: {len(sig_res.data[0]['vector'])}")
    
    print("\n🎉 LIVE END-TO-END TEST PASSED!")

if __name__ == "__main__":
    try:
        test_live_ingestion()
    except AssertionError as e:
        print(f"\n❌ Assertion Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

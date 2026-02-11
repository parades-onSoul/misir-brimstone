"""
API Endpoint Testing Script

Tests all critical endpoints to verify the complete data pipeline.
Run this after starting the backend server with: uvicorn main:app --reload
"""

import requests
import json
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_USER_ID = "test-user-123"  # Replace with actual user ID from Supabase

def test_endpoint(method: str, url: str, description: str, expected_status: int = 200, params: Dict = None) -> bool:
    """Test a single endpoint and print results."""
    print(f"\n📍 Testing: {description}")
    print(f"   {method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=params, timeout=10)
        else:
            print(f"   ❌ Unsupported method: {method}")
            return False
        
        if response.status_code == expected_status:
            print(f"   ✅ Status: {response.status_code}")
            
            # Try to parse and show sample response
            try:
                data = response.json()
                if isinstance(data, dict):
                    # Show first few keys
                    keys = list(data.keys())[:5]
                    print(f"   📦 Response keys: {keys}")
                elif isinstance(data, list):
                    print(f"   📦 Response: List with {len(data)} items")
                else:
                    print(f"   📦 Response type: {type(data).__name__}")
            except:
                print(f"   📦 Response length: {len(response.text)} bytes")
            
            return True
        else:
            print(f"   ❌ Status: {response.status_code} (expected {expected_status})")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection failed - is the server running?")
        return False
    except requests.exceptions.Timeout:
        print(f"   ⏱️  Timeout - endpoint took too long")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    """Run all endpoint tests."""
    print("=" * 80)
    print("MISIR API ENDPOINT TESTING")
    print("=" * 80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print("\nℹ️  Make sure the backend is running: cd backend && uvicorn main:app --reload")
    print()
    
    results = []
    
    # Test health endpoint
    results.append(test_endpoint(
        "GET",
        f"{BASE_URL.replace('/api/v1', '')}/health",
        "Health Check",
        200
    ))
    
    # Test spaces list
    results.append(test_endpoint(
        "GET",
        f"{BASE_URL}/spaces",
        "List Spaces",
        200,
        {"user_id": TEST_USER_ID}
    ))
    
    # Test global analytics
    results.append(test_endpoint(
        "GET",
        f"{BASE_URL}/analytics/global",
        "Global Analytics (Job 24)",
        200,
        {"user_id": TEST_USER_ID}
    ))
    
    # Test artifacts list
    results.append(test_endpoint(
        "GET",
        f"{BASE_URL}/artifacts",
        "List All Artifacts (Job 42 dependency)",
        200,
        {"user_id": TEST_USER_ID, "limit": 10}
    ))
    
    # For the following tests, we need a real space ID
    # We'll skip if no spaces exist
    print("\n" + "=" * 80)
    print("SPACE-SPECIFIC ENDPOINTS (requires existing space)")
    print("=" * 80)
    print("\nℹ️  The following tests need a valid space_id.")
    print("   Skipping if no spaces found...")
    
    # Get first space if available
    try:
        spaces_response = requests.get(
            f"{BASE_URL}/spaces",
            params={"user_id": TEST_USER_ID},
            timeout=5
        )
        if spaces_response.status_code == 200:
            spaces_data = spaces_response.json()
            spaces = spaces_data.get('spaces', [])
            
            if spaces and len(spaces) > 0:
                space_id = spaces[0]['id']
                print(f"\n✅ Found space: {spaces[0].get('name', 'Unnamed')} (ID: {space_id})")
                
                # Test space artifacts (Job 42)
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/artifacts",
                    "Space Artifacts Paginated (Job 42)",
                    200,
                    {"user_id": TEST_USER_ID, "page": 1, "page_size": 50}
                ))
                
                # Test space alerts (Job 43)
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/alerts",
                    "Space Alerts (Job 43)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                # Test topology (Job 44)
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/topology",
                    "Space Topology t-SNE (Job 44)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                # Test analytics endpoints (Job 45)
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/analytics/drift",
                    "Drift Events (Job 45a)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/analytics/velocity",
                    "Velocity Time-Series (Job 45b)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/analytics/confidence",
                    "Confidence Time-Series (Job 45c)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/analytics/margin_distribution",
                    "Margin Distribution (Job 45d)",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
                # Test subspaces
                results.append(test_endpoint(
                    "GET",
                    f"{BASE_URL}/spaces/{space_id}/subspaces",
                    "List Subspaces",
                    200,
                    {"user_id": TEST_USER_ID}
                ))
                
            else:
                print("\n⚠️  No spaces found. Create a space first to test space-specific endpoints.")
                print("   You can create a space via the frontend or API:")
                print(f"   POST {BASE_URL}/spaces?user_id={TEST_USER_ID}")
                print('   Body: {"name": "Test Space", "description": "Testing"}')
        
    except Exception as e:
        print(f"\n❌ Could not fetch spaces: {e}")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(results)
    total = len(results)
    
    print(f"\n✅ Passed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 All tests passed! The data pipeline is working correctly.")
    elif passed > 0:
        print(f"\n⚠️  Some tests failed. Check the output above for details.")
    else:
        print("\n❌ All tests failed. Is the backend server running?")
        print("   Start it with: cd backend && uvicorn main:app --reload")
    
    print()

if __name__ == "__main__":
    main()

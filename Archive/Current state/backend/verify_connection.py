import sys
import os
from dotenv import load_dotenv

# Load env vars explicitly
env_path = os.path.join(os.path.dirname(__file__), '.env')
print(f"DEBUG: Looking for .env at: {env_path}")

if os.path.exists(env_path):
    print("DEBUG: .env file FOUND.")
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        print(f"DEBUG: File has {len(lines)} lines.")
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' in line:
                key = line.split('=')[0].strip()
                print(f"DEBUG: Line {i+1} found key: '{key}'")
            else:
                print(f"DEBUG: Line {i+1} is malformed: '{line}'")
else:
    print("DEBUG: .env file NOT FOUND.")

load_dotenv(dotenv_path=env_path, override=True)

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Debug loaded vars
url = os.getenv("SUPABASE_URL")
if url:
    print(f"DEBUG: SUPABASE_URL in env: Yes (Length: {len(url)})")
else:
    print("DEBUG: SUPABASE_URL in env: NO")

from storage.repositories import repository

def verify_connection():
    print("🔌 Connecting to Supabase...")
    
    if not repository.client:
        print("❌ Client failed to initialize. Check .env file.")
        return

    try:
        # Fetch 1 space to check connection
        response = repository.client.table("spaces").select("id, name, user_id").limit(5).execute()
        
        spaces = response.data
        if not spaces:
            print("⚠️ Connected, but no Spaces found. You need at least one Space to test ingestion.")
        else:
            print(f"✅ Connection Successful! Found {len(spaces)} spaces.")
            for s in spaces:
                print(f"   - Space: {s['name']} (ID: {s['id']})")
                
            # Allow user to see IDs to pick one for testing
            print("\nUse one of these Space IDs for your API tests.")
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    verify_connection()

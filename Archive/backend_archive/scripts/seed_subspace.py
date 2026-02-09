
import os
import asyncio
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env from backend/.env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

async def check_db():
    print("--- 🔍 DIAGNOSTIC: CHECKING SPACES & MARKERS ---")
    
    # 1. Fetch all spaces
    spaces = supabase.table('spaces').select('*').execute()
    print(f"\nSpaces Found: {len(spaces.data)}")
    for s in spaces.data:
        print(f"  [{s['name']}] ID: {s['id']}")
        
        # 2. Fetch subspaces for each space
        subspaces = supabase.table('subspaces').select('*').eq('space_id', s['id']).execute()
        for sub in subspaces.data:
            print(f"    └── Subspace: [{sub['name']}] ID: {sub['id']}")
            
            # 3. Fetch markers for each subspace
            markers = supabase.table('subspace_markers').select('*').eq('subspace_id', sub['id']).execute()
            if markers.data:
                print(f"        └── Markers ({len(markers.data)}):")
                for m in markers.data:
                    # Print label and check if embedding exists/is valid
                    has_embed = "✅" if m.get('embedding') else "❌"
                    print(f"            - {m['label']} (Weight: {m['weight']}) [Embed: {has_embed}]")
            else:
                print("        └── ⚠️ NO MARKERS FOUND")
                
if __name__ == "__main__":
    asyncio.run(check_db())


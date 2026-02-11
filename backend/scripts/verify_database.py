"""
Database Verification Script

Runs the 5 critical verification queries from MISIR_COMPLETE_DATA_PIPELINE.md
to check which database tables are populated and working.
"""

import asyncio
from supabase import create_client, Client
from core.config import get_settings

async def verify_database():
    """Run all verification queries."""
    settings = get_settings()
    client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)
    
    print("=" * 80)
    print("MISIR DATABASE VERIFICATION")
    print("=" * 80)
    print()
    
    # Verification 1: Insights Table
    print("1. INSIGHTS TABLE (Job 43 effort estimate)")
    print("-" * 80)
    try:
        response = client.rpc('sql', {
            'query': """
                SELECT COUNT(*) as count, severity, headline
                FROM misir.insight
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY severity, headline
            """
        }).execute()
        
        if response.data and len(response.data) > 0:
            print("✅ Insights are being auto-generated")
            for row in response.data:
                print(f"   - {row.get('severity', 'N/A')}: {row.get('headline', 'N/A')} ({row.get('count', 0)} instances)")
            print("   → Job 43 effort: 1 hour (just query)")
        else:
            print("⚠️  No recent insights found")
            print("   → Job 43 effort: 4 hours (build on-demand generation)")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Verification 2: Centroid History
    print("2. CENTROID HISTORY TABLE (Job 45c & Job 20 effort)")
    print("-" * 80)
    try:
        response = client.from_('subspace_centroid_history').select('*', count='exact').execute()
        count = response.count or 0
        
        if count > 0:
            print(f"✅ Centroid history is being logged ({count} records)")
            print("   → Job 45c effort: 1 hour (just query)")
            print("   → Job 20 backend: DONE")
        else:
            print("⚠️  No centroid history records")
            print("   → Job 45c effort: 3 hours (add logging trigger)")
            print("   → Job 20 backend: Needs work")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Verification 3: Engagement Levels
    print("3. ENGAGEMENT LEVEL VALUES (for formatters.ts)")
    print("-" * 80)
    try:
        response = client.from_('artifact').select('engagement_level').execute()
        
        if response.data:
            levels = set(a.get('engagement_level') for a in response.data if a.get('engagement_level'))
            if levels:
                print(f"✅ Found engagement levels: {', '.join(sorted(levels))}")
                expected = {'latent', 'discovered', 'engaged', 'saturated'}
                if levels == expected:
                    print("   → Matches expected values ✓")
                else:
                    print(f"   ⚠️  Expected: {expected}")
                    print(f"   → Update formatters.ts to match actual values")
            else:
                print("⚠️  No engagement_level values found in artifacts")
        else:
            print("⚠️  No artifacts in database yet")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Verification 4: Drift Events
    print("4. DRIFT EVENTS (Job 45a effort)")
    print("-" * 80)
    try:
        response = client.rpc('sql', {
            'query': """
                SELECT COUNT(*) as count
                FROM misir.subspace_drift
                WHERE occurred_at > NOW() - INTERVAL '30 days'
            """
        }).execute()
        
        count = response.data[0].get('count', 0) if response.data else 0
        
        if count > 0:
            print(f"✅ Drift detection is working ({count} events in last 30 days)")
            print("   → Job 45a effort: 1 hour (just query)")
        else:
            print("⚠️  No drift events in last 30 days")
            print("   → Drift detection may not be running")
            print("   → Need to investigate backend")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Verification 5: Velocity Measurements
    print("5. VELOCITY MEASUREMENTS (Job 45b effort)")
    print("-" * 80)
    try:
        response = client.rpc('sql', {
            'query': """
                SELECT COUNT(*) as count
                FROM misir.subspace_velocity
                WHERE measured_at > NOW() - INTERVAL '30 days'
            """
        }).execute()
        
        count = response.data[0].get('count', 0) if response.data else 0
        
        if count > 0:
            print(f"✅ Velocity tracking is working ({count} measurements in last 30 days)")
            print("   → Job 45b effort: 1 hour (just query)")
        else:
            print("⚠️  No velocity measurements in last 30 days")
            print("   → Velocity tracking may not be running")
            print("   → Need to investigate backend")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    print("=" * 80)
    print("VERIFICATION COMPLETE")
    print("=" * 80)
    print()
    
    # Summary
    print("NEXT STEPS:")
    print("1. Review the results above")
    print("2. If any ⚠️  warnings, investigate those systems")
    print("3. Test endpoints manually:")
    print("   - GET /api/v1/spaces?user_id=<uuid>")
    print("   - GET /api/v1/analytics/global?user_id=<uuid>")
    print("   - GET /api/v1/spaces/{id}/alerts?user_id=<uuid>")
    print("   - GET /api/v1/spaces/{id}/topology?user_id=<uuid>")
    print("4. Test frontend in browser: http://localhost:3000")
    print()

if __name__ == "__main__":
    asyncio.run(verify_database())

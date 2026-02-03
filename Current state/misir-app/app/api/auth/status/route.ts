import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { requireAuth } from '@/lib/auth/server';

/**
 * GET /api/auth/status
 * 
 * Returns the current user's authentication and onboarding status.
 * Used to determine whether to redirect to onboarding or dashboard.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    
    // Fetch user record to check onboarded_at
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, onboarded_at, created_at')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('[Auth Status] Error fetching user:', error);
      throw error;
    }
    
    return NextResponse.json({
      userId: userData.id,
      email: userData.email,
      onboardedAt: userData.onboarded_at,
      createdAt: userData.created_at,
    });
    
  } catch (error) {
    console.error('[Auth Status] Error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to get auth status' },
      { status: 500 }
    );
  }
}

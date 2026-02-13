/**
 * Server-side auth utilities for API routes
 */

import { getUser } from '@/lib/db/supabase-server';

/**
 * Get authenticated user from request cookies (server-side)
 */
export async function getAuthUser() {
  return await getUser();
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getAuthUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

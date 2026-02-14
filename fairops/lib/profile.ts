import { supabaseAdmin } from './supabase';

export type ProfileRole = 'organizer' | 'vendor';

export interface Profile {
  id: string;
  auth0_sub: string;
  role: ProfileRole;
  display_name: string | null;
  org_name: string | null;
  business_name: string | null;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch profile by Auth0 user id (sub). Returns null if not found.
 */
export async function getProfileByAuth0Sub(
  auth0Sub: string
): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('auth0_sub', auth0Sub)
    .maybeSingle();

  if (error) {
    console.error('[profile] getProfileByAuth0Sub error:', error);
    return null;
  }
  return data as Profile | null;
}

/**
 * Delete profile by Auth0 user id (sub). Returns true if delete succeeded (or no row existed).
 */
export async function deleteProfileByAuth0Sub(
  auth0Sub: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('auth0_sub', auth0Sub);

  if (error) {
    console.error('[profile] deleteProfileByAuth0Sub error:', error);
    return false;
  }
  return true;
}

// SQL injection via the Supabase JS client is architecturally prevented:
// all values passed to .eq(), .insert(), .update(), .filter() etc. are
// JSON-encoded HTTP parameters through PostgREST — never interpolated into SQL.
// Data-level security is enforced by Supabase Row Level Security (RLS) policies
// on every table. The frontend layer performs input validation for data integrity.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Module-level flag — set by LoginPage when handling a recovery token.
// Tells useAuth to ignore the SIGNED_IN event that setSession fires,
// so the app doesn't redirect to the dashboard mid-password-reset.
export let isHandlingPasswordReset = false;
export function setHandlingPasswordReset(val) {
  isHandlingPasswordReset = val;
}

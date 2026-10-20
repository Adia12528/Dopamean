import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseAuthEnabled = Boolean(url && publishableKey);

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getEmailConfirmationRedirectUrl(): string {
  return new URL('/auth/confirm', window.location.origin).toString();
}

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!supabaseAuthEnabled || !url || !publishableKey) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    );
  }
  return clientPromise;
}

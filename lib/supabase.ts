
import { createClient } from '@supabase/supabase-js'
import { supabaseAuthStorage } from './authStorage';
import { env } from './env';

const supabaseUrl = env.supabaseUrl
const supabaseAnonKey = env.supabaseAnonKey

if (!supabaseUrl || !supabaseAnonKey) {
    // Graceful fallback or warning if env vars are missing during dev
    console.warn('Supabase URL or Key missing. Authentication features will be disabled.')
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            storage: supabaseAuthStorage,
        },
    }
)

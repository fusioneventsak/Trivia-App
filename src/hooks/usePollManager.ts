import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to check if Supabase connection is healthy
export const checkSupabaseConnection = async () => {
  if (!navigator.onLine) {
    return {
      isConnected: false, 
      message: 'Your device appears to be offline. Please check your internet connection.' 
    };
  }

  try {
    // Use a simple ping-like query that should be fast
    const { error } = await supabase.from('_bolt_migrations').select('count').limit(1);
    
    if (error) {
      return { 
        isConnected: false, 
        message: `Connection error: ${error.message}` 
      };
    }
    
    return { 
      isConnected: true, 
      message: null 
    };
  } catch (error) {
    console.error('Connection test error:', error);
    return {
      isConnected: false,
      message: 'Failed to connect to database. Please try again later.'
    };
  }
};
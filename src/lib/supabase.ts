import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to get the current session
export const getCurrentSession = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

// Function to refresh the current token
export const refreshToken = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

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
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate Supabase URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error('Invalid Supabase URL format. URL must start with https:// and contain .supabase.co');
}

// Create Supabase client with robust configuration
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'fusion-events-auth-token',
    storage: localStorage
  },
  global: {
    headers: {
      'X-Client-Info': 'fusion-events-web'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test connection function
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('system_settings').select('count').limit(1).single();
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
};

// Helper function to get current session - with error handling
export const getCurrentSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error('Exception in getCurrentSession:', error);
    return null;
  }
};

// Helper function to get current user - with error handling
export const getCurrentUser = async () => {
  try {
    const session = await getCurrentSession();
    return session?.user || null;
  } catch (error) {
    console.error('Exception in getCurrentUser:', error);
    return null;
  }
};

// Helper to refresh the token manually if needed
export const refreshToken = async () => {
  try {
    // First check if we have a session
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session, don't try to refresh
    if (!session) {
      return false;
    }
    
    // Try to refresh the session
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('Error in refreshToken:', error);
    return false;
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
    const { error } = await supabase.from('system_settings').select('count').limit(1).single();
    
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
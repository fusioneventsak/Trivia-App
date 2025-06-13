import { supabase } from './supabase';

/**
 * Ensures the current user has a record in the users table
 */
export const syncUserRecord = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No user to sync');
      return null;
    }
    
    // Check for existing user record
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('id, last_login, role, email')
      .eq('id', user.id)
      .maybeSingle();
    
    if (queryError) {
      console.error('Error checking for existing user:', queryError);
      return user;
    }
    
    const now = new Date().toISOString();
    
    if (!existingUser && user.email) {
      console.log('Creating user record for:', user.email);
      
      // Create new user record
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          created_at: now,
          last_login: now,
          // Set role to admin if this is the admin email
          role: user.email === 'info@fusion-events.ca' ? 'admin' : 'user'
        });
        
      if (insertError && insertError.code !== '23505') {
        console.error('Error inserting user:', insertError);
      }
    } else if (existingUser) {
      // Update last_login if it's been more than 5 minutes
      const lastLogin = new Date(existingUser.last_login || now);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (lastLogin < fiveMinutesAgo) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_login: now })
          .eq('id', user.id);
          
        if (updateError) {
          console.error('Error updating last_login:', updateError);
        }
      }
      
      // Return user with role and email
      return {
        ...user,
        role: existingUser.role,
        email: existingUser.email
      };
    }
    
    return user;
  } catch (error) {
    console.error('Error syncing user record:', error);
    return null;
  }
};

/**
 * Check if a user has admin privileges
 */
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    // First check if we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('No valid session found');
      return false;
    }
    
    // Admin users are identified by email
    if (session.user.email === 'info@fusion-events.ca') {
      console.log('User is admin by email match');
      return true;
    }
    
    // Check if user has admin role in database
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
      
    if (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
    
    const isAdmin = userData?.role === 'admin';
    console.log('Admin role check result:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('Error in checkIsAdmin:', error);
    return false;
  }
};

/**
 * Check if a user has admin access (alias for checkIsAdmin)
 */
export const hasAdminAccess = checkIsAdmin;

/**
 * Handle logging in a user
 */
export const loginUser = async (email: string, password: string) => {
  try {
    // First try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Login error:', error);
      throw new Error('Invalid email or password');
    }
    
    // Ensure user record exists and update last login
    if (data.user) {
      const user = await syncUserRecord();
      return { user, error: null };
    }
    
    throw new Error('Failed to sync user record');
  } catch (error: any) {
    console.error('Login error:', error);
    return { 
      user: null, 
      error: error.message || 'An error occurred during login'
    };
  }
};

/**
 * Handle logging out a user
 */
export const logoutUser = async () => {
  try {
    // Clear local storage
    localStorage.clear();
    
    // Sign out through Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    return { error: null };
  } catch (error: any) {
    console.error('Logout error:', error);
    return { error: error.message };
  }
};

/**
 * Force a token refresh
 */
export const forceTokenRefresh = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
    return !!data.session;
  } catch (error) {
    console.error('Error in forceTokenRefresh:', error);
    return false;
  }
};
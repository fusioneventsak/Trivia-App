import { supabase } from './supabase';

/**
 * Check if the current user is an admin
 * @returns {Promise<boolean>} True if user is admin
 */
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) return false;
    
    // Check if email matches admin email
    return session.user.email === 'info@fusion-events.ca';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
import { supabase } from './supabase';

interface CustomerData {
  id: string;
  name: string;
  ownerId?: string;
  settings?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Service for managing customer data and access
 */
export const CustomerService = {
  /**
   * Create a new customer
   */
  async createCustomer(data: CustomerData): Promise<{ id: string } | null> {
    try {
      // Validate customer ID format
      if (!isValidCustomerId(data.id)) {
        throw new Error('Invalid customer ID format. Must be 2-4 lowercase alphanumeric characters.');
      }
      
      // Get the current user
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData.session?.user?.id;
      
      if (!userId) {
        throw new Error('User must be authenticated to create a customer');
      }
      
      // Call the database function to create the customer
      const { data: result, error } = await supabase.rpc('create_customer', {
        p_customer_id: data.id,
        p_name: data.name,
        p_owner_id: data.ownerId || userId
      });
      
      if (error) throw error;
      
      return { id: result };
    } catch (error: any) {
      console.error('Error creating customer:', error);
      return null;
    }
  },
  
  /**
   * Get a customer by ID
   */
  async getCustomerById(customerId: string): Promise<CustomerData | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', customerId)
        .single();
        
      if (error) throw error;
      
      return {
        id: data.customer_id,
        name: data.name,
        ownerId: data.owner_id,
        settings: data.settings,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error getting customer:', error);
      return null;
    }
  },
  
  /**
   * List all customers the current user has access to
   */
  async getAccessibleCustomers(): Promise<CustomerData[]> {
    try {
      // First check if the user is an admin (admins can see all customers)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return [];
      
      let query = supabase
        .from('customers')
        .select('*')
        .eq('is_active', true);
        
      // For non-admin users, only show customers they have access to
      const isAdmin = await isUserAdmin();
      if (!isAdmin) {
        query = query.filter('customer_id', 'in', (subquery) => {
          return subquery
            .from('customer_access')
            .select('customer_id')
            .eq('user_id', user.id);
        });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(customer => ({
        id: customer.customer_id,
        name: customer.name,
        ownerId: customer.owner_id,
        settings: customer.settings,
        isActive: customer.is_active
      }));
    } catch (error) {
      console.error('Error listing customers:', error);
      return [];
    }
  },
  
  /**
   * Grant a user access to a customer
   */
  async grantCustomerAccess(customerId: string, userId: string, accessLevel: string = 'user'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('customer_access')
        .insert({
          customer_id: customerId,
          user_id: userId,
          access_level: accessLevel
        });
        
      return !error;
    } catch (error) {
      console.error('Error granting access:', error);
      return false;
    }
  },
  
  /**
   * Revoke a user's access to a customer
   */
  async revokeCustomerAccess(customerId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('customer_access')
        .delete()
        .eq('customer_id', customerId)
        .eq('user_id', userId);
        
      return !error;
    } catch (error) {
      console.error('Error revoking access:', error);
      return false;
    }
  },
  
  /**
   * Get rooms for a customer
   */
  async getCustomerRooms(customerId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('customer_rooms')
        .select(`
          room_id,
          rooms (
            id, name, subdomain, logo_url, is_active, 
            theme, settings, created_at, updated_at
          )
        `)
        .eq('customer_id', customerId);
        
      if (error) throw error;
      
      return data.map(item => item.rooms);
    } catch (error) {
      console.error('Error getting customer rooms:', error);
      return [];
    }
  }
};

/**
 * Check if a user has admin privileges
 */
async function isUserAdmin(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    
    // Check if user email is admin email
    if (data.user.email === 'info@fusion-events.ca') return true;
    
    // Check if user has admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
      
    return userData?.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Validate customer ID format (2-4 lowercase alphanumeric characters)
 */
function isValidCustomerId(id: string): boolean {
  return /^[a-z0-9]{2,4}$/.test(id);
}
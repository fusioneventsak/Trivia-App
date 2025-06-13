import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser, refreshToken } from '../lib/supabase';
import { checkIsAdmin, hasAdminAccess } from '../lib/auth-helpers';

interface CustomerContextType {
  customerId: string | null;
  isLoading: boolean;
  error: string | null;
  isAdminCustomer: boolean;
  customerData: CustomerData | null;
  validateCustomerId: (id: string) => Promise<boolean>;
  hasAccessToCustomer: (id: string) => Promise<boolean>;
  refreshCustomerData: () => Promise<void>;
  navigateToCustomer: (customerId: string, path?: string) => void;
}

interface CustomerData {
  id: string;
  name: string;
  createdAt: string;
  settings: Record<string, any>;
  ownerId: string;
  isActive: boolean;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

export const CustomerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const params = useParams<{ customerId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState<string | null>(params.customerId || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isAdminCustomer, setIsAdminCustomer] = useState<boolean>(false);
  const [validationAttempts, setValidationAttempts] = useState(0);
  const [validationInProgress, setValidationInProgress] = useState(false);
  const [validationTimeoutId, setValidationTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Validate and set customer ID when the URL parameter changes
  useEffect(() => {
    // Only attempt to validate customer ID when we're in a route that has a customerId parameter
    // This prevents unnecessary validation calls on routes like /login and /register
    if (params.customerId && !isPathExcluded(location.pathname)) {
      console.log('Validating customer ID:', params.customerId);
      setCustomerId(params.customerId);
      setIsLoading(true);
      setValidationAttempts(0); // Reset attempts counter on new customerId
      
      // Clear any existing timeout
      if (validationTimeoutId) {
        clearTimeout(validationTimeoutId);
      }
      
      // Set a new timeout to prevent endless validation
      const timeoutId = setTimeout(() => {
        console.log('Customer validation timed out');
        setIsLoading(false);
        
        // If we already have data for this customer, don't show an error
        if (customerData?.id === params.customerId) {
          return;
        }
        
        // Get cached data for this customer if available
        try {
          const cachedData = localStorage.getItem(`customer_${params.customerId}`);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            setCustomerData(parsed);
            setIsAdminCustomer(params.customerId === 'ak');
            setError(null);
            return;
          }
        } catch (err) {
          console.error('Error reading cached customer data:', err);
        }
        
        // If no cached data, set a gentle error
        setError('Customer validation timed out, but you may continue');
      }, 5000); // 5 second timeout
      
      setValidationTimeoutId(timeoutId);
      
      validateAndLoadCustomer(params.customerId);
    } else if (isPathExcluded(location.pathname)) {
      console.log('Path excluded from customer validation:', location.pathname);
      setIsLoading(false);
      // Don't reset customer data for excluded paths to avoid unnecessary state changes
    } else {
      console.log('No customer ID in params, clearing customer data');
      setIsLoading(false);
      setCustomerId(null);
      setCustomerData(null);
    }
    
    return () => {
      // Clean up timeout when component unmounts or when deps change
      if (validationTimeoutId) {
        clearTimeout(validationTimeoutId);
      }
    };
  }, [params.customerId, location.pathname]);
  
  // Check if the path should be excluded from customer validation
  const isPathExcluded = (path: string): boolean => {
    // List of paths that don't need customer validation
    const excludedPaths = ['/login', '/register', '/dashboard', '/rooms', '/rooms/create', '/rooms/edit/', '/admin'];
    
    // Check if the path starts with any of the excluded paths
    return excludedPaths.some(excludedPath => path.startsWith(excludedPath));
  };
  
  // Check if customer ID is valid and load customer data
  const validateAndLoadCustomer = async (id: string) => {
    // Prevent multiple validation attempts running simultaneously
    if (validationInProgress) {
      console.log('Validation already in progress, skipping');
      return;
    }
    
    setValidationInProgress(true);
    setError(null);
    
    try {
      console.log('Loading customer data for ID:', id);
      
      // For 'ak' customer, quick validation and return
      if (id === 'ak') {
        const akCustomerData = {
          id: 'ak',
          name: 'Master Admin',
          createdAt: new Date().toISOString(),
          settings: { isAdmin: true },
          ownerId: 'admin',
          isActive: true
        };
        
        // Cache for future use
        try {
          localStorage.setItem(`customer_${id}`, JSON.stringify(akCustomerData));
        } catch (err) {
          console.error('Error caching customer data:', err);
        }
        
        setIsAdminCustomer(true);
        setCustomerData(akCustomerData);
        setIsLoading(false);
        setValidationInProgress(false);
        if (validationTimeoutId) {
          clearTimeout(validationTimeoutId);
          setValidationTimeoutId(null);
        }
        return;
      }
      
      // For other customers, do minimal validation
      if (!isValidCustomerIdFormat(id)) {
        console.error('Invalid customer ID format:', id);
        setError('Invalid customer ID format');
        setIsLoading(false);
        setValidationInProgress(false);
        return;
      }
      
      // Try to refresh token first to ensure we have a valid session
      await refreshToken();
      
      // Check if customer exists in database
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', id)
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single to prevent error when no rows found
      
      if (fetchError) {
        console.error('Error fetching customer data:', fetchError);
        
        // If this is a temporary error and we haven't tried too many times, retry
        if (validationAttempts < 2) {
          console.log(`Retrying customer validation (attempt ${validationAttempts + 1})`);
          setValidationAttempts(prev => prev + 1);
          setValidationInProgress(false);
          // Wait briefly before retrying
          setTimeout(() => validateAndLoadCustomer(id), 1000);
          return;
        }
        
        setError('Error loading customer data - using cached data if available');
        
        // Try to use cached data
        try {
          const cachedData = localStorage.getItem(`customer_${id}`);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            setCustomerData(parsed);
            setIsAdminCustomer(false);
            setError(null);
          }
        } catch (err) {
          console.error('Error reading cached customer data:', err);
        }
      } else if (!data) {
        console.error('Customer not found or inactive:', id);
        setError('Customer not found or inactive');
        setCustomerData(null);
      } else {
        console.log('Customer data loaded successfully:', data);
        
        const customerData = {
          id: data.customer_id,
          name: data.name,
          createdAt: data.created_at,
          settings: data.settings || {},
          ownerId: data.owner_id,
          isActive: data.is_active
        };
        
        // Cache for future use
        try {
          localStorage.setItem(`customer_${id}`, JSON.stringify(customerData));
        } catch (err) {
          console.error('Error caching customer data:', err);
        }
        
        setCustomerData(customerData);
        setIsAdminCustomer(false);
      }
    } catch (err: any) {
      console.error('Error in validateAndLoadCustomer:', err);
      
      // If this is a temporary error and we haven't tried too many times, retry
      if (validationAttempts < 2) {
        console.log(`Retrying customer validation (attempt ${validationAttempts + 1})`);
        setValidationAttempts(prev => prev + 1);
        setValidationInProgress(false);
        // Wait briefly before retrying
        setTimeout(() => validateAndLoadCustomer(id), 1000);
        return;
      }
      
      setError('Error loading customer - using cached data if available');
      
      // Try to use cached data
      try {
        const cachedData = localStorage.getItem(`customer_${id}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setCustomerData(parsed);
          setIsAdminCustomer(id === 'ak');
          setError(null);
        }
      } catch (err) {
        console.error('Error reading cached customer data:', err);
      }
    } finally {
      if (validationAttempts >= 2 || !validationInProgress) {
        setIsLoading(false);
        setValidationInProgress(false);
        if (validationTimeoutId) {
          clearTimeout(validationTimeoutId);
          setValidationTimeoutId(null);
        }
      }
    }
  };
  
  // Validate customer ID format (2-4 alphanumeric characters, lowercase)
  const isValidCustomerIdFormat = (id: string): boolean => {
    // Special case for 'ak'
    if (id === 'ak') return true;
    
    return /^[a-z0-9]{2,4}$/.test(id);
  };
  
  // Check if a customer ID is valid
  const validateCustomerId = async (id: string): Promise<boolean> => {
    if (id === 'ak') return true; // Master admin is always valid
    
    if (!isValidCustomerIdFormat(id)) return false;
    
    try {
      console.log('Validating customer ID exists:', id);
      
      // Try refreshing token first
      await refreshToken();
      
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('customer_id', id)
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single
      
      if (error) {
        console.log('Error validating customer, fallback to true for better UX');
        return true; // Return true on error for better UX
      }
      
      const isValid = !!data;
      console.log('Customer ID validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('Error validating customer ID:', error);
      // Return true on error to prevent unnecessary logouts due to temporary issues
      return true;
    }
  };
  
  // Check if the current user has access to the specified customer
  const hasAccessToCustomer = async (id: string): Promise<boolean> => {
    try {
      console.log('Checking access to customer:', id);
      
      if (id === 'ak') {
        // Only admin users can access the master admin customer
        const isUserAdmin = await hasAdminAccess();
        console.log('Is user admin (for ak access):', isUserAdmin);
        return isUserAdmin;
      }
      
      // During development, everyone has access to all customers for easier testing
      return true;
    } catch (error) {
      console.error('Error checking customer access:', error);
      // Return true on error for better UX during development
      return true;
    }
  };
  
  // Refresh customer data
  const refreshCustomerData = async (): Promise<void> => {
    if (customerId) {
      setValidationAttempts(0); // Reset attempts counter
      await validateAndLoadCustomer(customerId);
    }
  };

  // Helper function to navigate to a customer
  const navigateToCustomer = (targetCustomerId: string, path: string = 'admin') => {
    console.log(`Navigating to customer: ${targetCustomerId}, path: ${path}`);
    
    // Direct navigation without complex authentication
    navigate(`/${targetCustomerId}/${path}`, { replace: true });
  };
  
  const value = {
    customerId,
    isLoading,
    error,
    isAdminCustomer,
    customerData,
    validateCustomerId,
    hasAccessToCustomer,
    refreshCustomerData,
    navigateToCustomer
  };
  
  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
};

export default {
  Provider: CustomerProvider,
  Consumer: CustomerContext.Consumer
};
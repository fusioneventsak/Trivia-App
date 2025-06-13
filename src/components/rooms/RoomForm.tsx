import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useRoomStore, Room, RoomTheme, RoomSettings } from '../../store/roomStore';
import { CircleDashed, AlertCircle, Save, Loader2, Image, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { syncUserRecord } from '../../lib/auth-helpers';
import { useCustomer } from '../../context/CustomerContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeEditor from '../ThemeEditor';
import Breadcrumb from '../ui/Breadcrumb';

type FormMode = 'create' | 'edit';

export default function RoomForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const mode: FormMode = id ? 'edit' : 'create';
  const { createRoom, updateRoom, fetchRoom, isLoading, error } = useRoomStore();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const { customerId } = useCustomer();
  const { theme } = useTheme();
  
  // Add a ref to track if room has been loaded to prevent infinite loop
  const roomLoadedRef = useRef(false);
  
  const defaultTheme: RoomTheme = {
    primary_color: theme.primary_color,
    secondary_color: theme.secondary_color,
    background_color: theme.background_color,
    text_color: theme.text_color
  };
  
  const defaultSettings: RoomSettings = {
    allow_guest_players: true,
    require_approval: false,
    show_leaderboard: true,
    max_players: 500
  };
  
  const [formData, setFormData] = useState<Partial<Room>>({
    name: '',
    subdomain: '',
    domain: '',
    logo_url: '',
    theme: defaultTheme,
    settings: defaultSettings,
    is_active: true,
    customer_id: customerId || 'ak' // Set default customer ID from context or use 'ak'
  });
  
  const [customError, setCustomError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessibleCustomers, setAccessibleCustomers] = useState<Array<{id: string, name: string}>>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch current user on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          // Ensure user record exists
          await syncUserRecord();
          
          setCurrentUser(data.session.user.id);
          setCurrentUserEmail(data.session.user.email);
          
          // Fetch customers the user has access to
          const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('customer_id, name')
            .order('name');
          
          if (!customerError && customerData) {
            // Add the default admin customer
            const customers = [...customerData];
            if (!customers.find(c => c.customer_id === 'ak')) {
              customers.unshift({ customer_id: 'ak', name: 'Master Admin' });
            }
            setAccessibleCustomers(customers.map(c => ({ id: c.customer_id, name: c.name })));
            
            // If we only have the 'ak' customer, set a debug message
            if (customers.length === 0) {
              console.warn('No customers found for this user');
            }
          } else {
            console.error('Error fetching customers:', customerError);
            // Add default 'ak' customer as fallback
            setAccessibleCustomers([{ id: 'ak', name: 'Master Admin' }]);
          }
        }
      } catch (error) {
        console.error('Error in fetchUser:', error);
        // Fallback to ensure at least 'ak' is available
        setAccessibleCustomers([{ id: 'ak', name: 'Master Admin' }]);
      }
    };
    
    fetchUser();
  }, []);
  
  // Modified useEffect to prevent infinite loop
  useEffect(() => {
    if (mode === 'edit' && id && !roomLoadedRef.current) {
      const loadRoom = async () => {
        try {
          // Set the ref to true to prevent multiple loads
          roomLoadedRef.current = true;
          
          const room = await fetchRoom(id);
          if (room) {
            // Make sure we're working with a complete copy of the room data
            const completedRoom = {
              ...room,
              // Ensure these objects exist (with defaults if needed)
              theme: room.theme || { ...defaultTheme },
              settings: room.settings || { ...defaultSettings },
              // Make sure customer_id is included
              customer_id: room.customer_id || customerId || 'ak'
            };
            
            setFormData(completedRoom);
            
            // Set logo preview if exists
            if (room.logo_url) {
              setLogoPreview(room.logo_url);
            }
          }
        } catch (error) {
          console.error("Error loading room:", error);
          setCustomError("Failed to load room data");
        }
      };
      
      loadRoom();
    } else if (mode === 'create') {
      // For new rooms, set the customer ID from the context
      setFormData(prev => ({
        ...prev,
        customer_id: customerId || 'ak'
      }));
    }
  }, [mode, id, customerId]); // Remove fetchRoom and other dependencies that might change
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    }));
  };
  
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings!,
        [name]: type === 'checkbox'
          ? checked
          : type === 'number'
            ? parseInt(value)
            : value
      }
    }));
  };
  
  const handleThemeChange = (newTheme: any) => {
    console.log('Theme changed in RoomForm:', newTheme);
    
    // Ensure we're making a proper copy to avoid reference issues
    setFormData(prev => ({
      ...prev,
      theme: { ...newTheme }
    }));
  };
  
  const generateSubdomain = () => {
    if (!formData.name) return;
    
    const subdomain = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
      
    setFormData(prev => ({ ...prev, subdomain }));
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setCustomError('Please upload an image file');
        return;
      }
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setCustomError('Image size should be less than 2MB');
        return;
      }
      
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setCustomError('');
    }
  };
  
  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.logo_url || null;
    
    try {
      setIsUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('public')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      setCustomError('Failed to upload logo. Using URL if provided.');
      return formData.logo_url || null;
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCustomError('');
    
    try {
      if (!formData.name || !formData.subdomain) {
        throw new Error('Name and subdomain are required');
      }
      
      // Upload logo if provided
      let logoUrl = formData.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }
      
      // Create a clean copy of the form data
      const roomData = {
        ...formData,
        logo_url: logoUrl,
        customer_id: formData.customer_id || 'ak',
        // Ensure theme is a proper object
        theme: { ...formData.theme }
      };
      
      console.log("Saving room with theme:", roomData.theme);
      
      let result;
      
      if (mode === 'create') {
        result = await createRoom(roomData);
      } else if (mode === 'edit' && id) {
        result = await updateRoom(id, roomData);
      }
      
      if (result) {
        navigate('/ak/admin');
      } else {
        throw new Error('Failed to save room');
      }
    } catch (err: any) {
      console.error("Error saving room:", err);
      setCustomError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine where to navigate on cancel
  const handleCancel = () => {
    navigate('/ak/admin');
  };
  
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard', icon: <CircleDashed className="w-4 h-4" /> },
            { label: 'Rooms', href: '/admin/rooms' },
            { label: mode === 'create' ? 'Create Room' : 'Edit Room' }
          ]}
          className="mb-4"
        />
      
        <h1 className="mb-6 text-2xl font-bold text-gray-800">
          {mode === 'create' ? 'Create New Room' : 'Edit Room'}
        </h1>
        
        {(error || customError) && (
          <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error || customError}</span>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Room Details</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-700">
                  Room Name*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => {
                    if (!formData.subdomain) {
                      generateSubdomain();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="subdomain" className="block mb-1 text-sm font-medium text-gray-700">
                  Subdomain*
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="subdomain"
                    name="subdomain"
                    value={formData.subdomain}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-md focus:ring-purple-500 focus:border-purple-500"
                    pattern="[a-z0-9-]+"
                    title="Subdomain can only contain lowercase letters, numbers, and hyphens"
                    required
                  />
                  <span className="inline-flex items-center px-3 text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md">
                    .yourdomain.com
                  </span>
                </div>
              </div>
              
              <div>
                <label htmlFor="customer_id" className="block mb-1 text-sm font-medium text-gray-700">
                  Customer*
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  value={formData.customer_id || (customerId || 'ak')}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  {accessibleCustomers.length === 0 ? (
                    <option value="ak">Master Admin</option>
                  ) : (
                    accessibleCustomers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.id})
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {accessibleCustomers.length === 0 
                    ? "Only 'Master Admin' customer available" 
                    : "Select which customer this room belongs to"}
                </p>
              </div>
              
              <div>
                <label htmlFor="logo_url" className="block mb-1 text-sm font-medium text-gray-700">
                  Logo
                </label>
                <div className="space-y-2">
                  {logoPreview && (
                    <div className="w-full h-24 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        className="max-h-full max-w-full object-contain"
                        onError={() => setLogoPreview(null)}
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="file"
                        id="logo_file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-500 flex items-center">
                        <Upload className="w-4 h-4 mr-2" />
                        <span className="text-sm">Upload Logo</span>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <input
                        type="text"
                        id="logo_url"
                        name="logo_url"
                        value={formData.logo_url || ''}
                        onChange={handleChange}
                        placeholder="Or enter URL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    Upload a logo or provide a URL. This will be displayed on the results page.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center md:col-span-2">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="block ml-2 text-sm font-medium text-gray-700">
                  Room is active and visible to users
                </label>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Room Settings</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allow_guest_players"
                  name="allow_guest_players"
                  checked={formData.settings?.allow_guest_players}
                  onChange={handleSettingsChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="allow_guest_players" className="block ml-2 text-sm font-medium text-gray-700">
                  Allow guest players (no account required)
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="require_approval"
                  name="require_approval"
                  checked={formData.settings?.require_approval}
                  onChange={handleSettingsChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="require_approval" className="block ml-2 text-sm font-medium text-gray-700">
                  Require approval for new players
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show_leaderboard"
                  name="show_leaderboard"
                  checked={formData.settings?.show_leaderboard}
                  onChange={handleSettingsChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="show_leaderboard" className="block ml-2 text-sm font-medium text-gray-700">
                  Show leaderboard to players
                </label>
              </div>
              
              <div>
                <label htmlFor="max_players" className="block mb-1 text-sm font-medium text-gray-700">
                  Maximum Players
                </label>
                <input
                  type="number"
                  id="max_players"
                  name="max_players"
                  value={formData.settings?.max_players || 500}
                  onChange={handleSettingsChange}
                  min="1"
                  max="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Theme Settings</h2>
            <ThemeEditor 
              onSave={handleThemeChange}
              initialTheme={formData.theme}
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || isLoading || isUploading}
              className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {(isSubmitting || isLoading || isUploading) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {mode === 'create' ? 'Create Room' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
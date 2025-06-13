import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Palette, Save, RefreshCw, AlertCircle, Check, Upload, Image, 
  Globe, Layout, Users, MessageSquare, Trophy, Smartphone
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ThemeEditor from '../ThemeEditor';

interface RoomBranding {
  logo_url: string;
  theme: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    container_bg_color?: string;
    input_bg_color?: string;
    input_text_color?: string;
    button_text_color?: string;
    success_color?: string;
    error_color?: string;
    warning_color?: string;
    info_color?: string;
  };
  settings: {
    join_page_message?: string;
    results_page_message?: string;
    show_leaderboard?: boolean;
    allow_guest_players?: boolean;
    require_approval?: boolean;
    max_players?: number;
  };
}

export default function RoomBrandingSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [branding, setBranding] = useState<RoomBranding>({
    logo_url: '',
    theme: {
      primary_color: theme.primary_color,
      secondary_color: theme.secondary_color,
      background_color: theme.background_color,
      text_color: theme.text_color,
      container_bg_color: theme.container_bg_color,
      input_bg_color: theme.input_bg_color,
      input_text_color: theme.input_text_color,
      button_text_color: theme.button_text_color,
      success_color: theme.success_color,
      error_color: theme.error_color,
      warning_color: theme.warning_color,
      info_color: theme.info_color
    },
    settings: {
      join_page_message: '',
      results_page_message: '',
      show_leaderboard: true,
      allow_guest_players: true,
      require_approval: false,
      max_players: 500
    }
  });
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('branding');
  
  // Load room data
  useEffect(() => {
    if (!id) return;
    
    const fetchRoom = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        setRoom(data);
        
        // Initialize form with room data
        setBranding({
          logo_url: data.logo_url || '',
          theme: data.theme || {
            primary_color: theme.primary_color,
            secondary_color: theme.secondary_color,
            background_color: theme.background_color,
            text_color: theme.text_color,
            container_bg_color: theme.container_bg_color,
            input_bg_color: theme.input_bg_color,
            input_text_color: theme.input_text_color,
            button_text_color: theme.button_text_color,
            success_color: theme.success_color,
            error_color: theme.error_color,
            warning_color: theme.warning_color,
            info_color: theme.info_color
          },
          settings: data.settings || {
            join_page_message: '',
            results_page_message: '',
            show_leaderboard: true,
            allow_guest_players: true,
            require_approval: false,
            max_players: 500
          }
        });
        
        // Set logo preview if exists
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
        
      } catch (err: any) {
        console.error('Error fetching room:', err);
        setError(err.message || 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoom();
  }, [id, theme]);
  
  const handleThemeChange = (newTheme: any) => {
    console.log('Theme changed in RoomBrandingSettings:', newTheme);
    
    // Make a complete copy of the theme to avoid reference issues
    setBranding(prev => ({
      ...prev,
      theme: { ...newTheme }
    }));
  };
  
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setBranding(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [name]: type === 'checkbox' 
          ? (e.target as HTMLInputElement).checked 
          : type === 'number'
            ? parseInt(value)
            : value
      }
    }));
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size should be less than 2MB');
        return;
      }
      
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };
  
  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return branding.logo_url || null;
    
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
      setError('Failed to upload logo. Using URL if provided.');
      return branding.logo_url || null;
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSave = async () => {
    if (!id) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Upload logo if provided
      let logoUrl = branding.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo() || logoUrl;
      }
      
      console.log("Saving room with theme:", branding.theme);
      
      // Update room
      const { error } = await supabase
        .from('rooms')
        .update({
          logo_url: logoUrl,
          theme: branding.theme,
          settings: {
            ...room.settings,
            ...branding.settings
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // Apply theme to all templates
      await supabase.rpc('apply_room_theme_to_templates', { p_room_id: id });
      
      // Update global theme to match room theme
      setTheme(branding.theme);
      
      setSuccess('Room branding and settings saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err: any) {
      console.error('Error saving room branding:', err);
      setError(err.message || 'Failed to save room branding');
    } finally {
      setSaving(false);
    }
  };
  
  const renderMessagesTab = () => {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Join Page</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="join_page_message" className="block mb-1 text-sm font-medium text-gray-700">
                Welcome Message
              </label>
              <textarea
                id="join_page_message"
                name="join_page_message"
                value={branding.settings.join_page_message || ''}
                onChange={handleSettingsChange}
                rows={3}
                placeholder="Welcome to our interactive session! Enter your name and the room code to join."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                This message will be displayed on the join page where users enter their name and room code.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Results Page</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="results_page_message" className="block mb-1 text-sm font-medium text-gray-700">
                Results Page Message
              </label>
              <textarea
                id="results_page_message"
                name="results_page_message"
                value={branding.settings.results_page_message || ''}
                onChange={handleSettingsChange}
                rows={3}
                placeholder="Thanks for participating! Your answers are being recorded."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                This message will be displayed on the results page when no question is active.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderSettingsTab = () => {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Player Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allow_guest_players"
                name="allow_guest_players"
                checked={branding.settings.allow_guest_players}
                onChange={handleSettingsChange}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="allow_guest_players" className="ml-2 block text-sm text-gray-700">
                Allow guest players (no account required)
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="require_approval"
                name="require_approval"
                checked={branding.settings.require_approval}
                onChange={handleSettingsChange}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="require_approval" className="ml-2 block text-sm text-gray-700">
                Require approval for new players
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="show_leaderboard"
                name="show_leaderboard"
                checked={branding.settings.show_leaderboard}
                onChange={handleSettingsChange}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="show_leaderboard" className="ml-2 block text-sm text-gray-700">
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
                value={branding.settings.max_players || 500}
                onChange={handleSettingsChange}
                min="1"
                max="10000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum number of players allowed in this room
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderPreviewTab = () => {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Preview</h3>
          
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-100 border-b border-gray-200 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-1.5"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1.5"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full mr-1.5"></div>
                <div className="flex-1 text-center text-xs text-gray-500">Join Page</div>
              </div>
              
              <div 
                className="p-4 flex flex-col items-center justify-center"
                style={{ 
                  background: `linear-gradient(to bottom right, ${branding.theme.primary_color}, ${branding.theme.secondary_color})`,
                  color: branding.theme.text_color,
                  minHeight: '200px'
                }}
              >
                {logoPreview && (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="h-16 w-auto object-contain mb-4"
                  />
                )}
                <h2 className="text-xl font-bold mb-2">Join Room</h2>
                {branding.settings.join_page_message && (
                  <p className="text-sm mb-4 text-center max-w-xs opacity-90">
                    {branding.settings.join_page_message}
                  </p>
                )}
                <div className="w-full max-w-xs bg-white/20 rounded-lg p-3 mb-2"></div>
                <div className="w-full max-w-xs bg-white/20 rounded-lg p-3 mb-4"></div>
                <div 
                  className="w-full max-w-xs rounded-lg p-3 text-center font-medium"
                  style={{ backgroundColor: branding.theme.primary_color }}
                >
                  Join Room
                </div>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-100 border-b border-gray-200 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-1.5"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1.5"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full mr-1.5"></div>
                <div className="flex-1 text-center text-xs text-gray-500">Results Page</div>
              </div>
              
              <div 
                className="p-4"
                style={{ 
                  background: `linear-gradient(to bottom right, ${branding.theme.primary_color}, ${branding.theme.secondary_color})`,
                  color: branding.theme.text_color,
                  minHeight: '200px'
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    {logoPreview && (
                      <img 
                        src={logoPreview} 
                        alt="Logo" 
                        className="h-8 w-auto object-contain mr-3"
                      />
                    )}
                    <h2 className="text-lg font-bold">{room?.name || 'Room Name'}</h2>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm">
                    Room {room?.room_code || 'CODE'}
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                  {branding.settings.results_page_message ? (
                    <p className="text-center">
                      {branding.settings.results_page_message}
                    </p>
                  ) : (
                    <p className="text-center">
                      Waiting for the next activity...
                    </p>
                  )}
                </div>
                
                {branding.settings.show_leaderboard && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-5 h-5 text-yellow-300" />
                      <h3 className="font-semibold">Leaderboard</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white/20 p-2 rounded-lg"></div>
                      <div className="bg-white/20 p-2 rounded-lg"></div>
                      <div className="bg-white/20 p-2 rounded-lg"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Room Branding & Settings</h1>
          
          <button
            onClick={handleSave}
            disabled={saving || isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving || isUploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{success}</span>
          </div>
        )}
        
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('branding')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'branding'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Palette className="w-4 h-4 mr-2" />
                Branding
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('messages')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'messages'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Messages
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'settings'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Player Settings
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'preview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Preview
              </div>
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Logo</h3>
              
              <div className="space-y-4">
                {logoPreview && (
                  <div className="w-full h-32 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
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
                      value={branding.logo_url}
                      onChange={(e) => setBranding(prev => ({ ...prev, logo_url: e.target.value }))}
                      placeholder="Or enter URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                <p className="text-sm text-gray-500">
                  Your logo will be displayed on the join page, results page, and leaderboard.
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Theme Colors</h3>
              <ThemeEditor 
                onSave={handleThemeChange}
                initialTheme={branding.theme}
              />
            </div>
          </div>
        )}
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'preview' && renderPreviewTab()}
      </div>
    </div>
  );
}
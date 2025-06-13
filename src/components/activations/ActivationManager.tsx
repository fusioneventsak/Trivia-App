import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  PlusCircle, Trash, Edit, Copy, Play, 
  RefreshCw, AlertCircle, Check, Filter, 
  Search, ArrowLeft, LayoutDashboard, Settings,
  BarChart, PieChart, FlipVertical as LayoutVertical,
  Image
} from 'lucide-react';
import ActivationPreview from './ActivationPreview';
import MediaUploader from './MediaUploader';
import Breadcrumb from '../ui/Breadcrumb';
import OptionMediaUploader from '../ui/OptionMediaUploader';

interface Activation {
  id?: string;
  type: 'multiple_choice' | 'text_answer' | 'poll' | 'social_wall' | 'leaderboard';
  question: string;
  options?: any[];
  correct_answer?: string;
  exact_answer?: string;
  media_type: 'none' | 'image' | 'youtube' | 'gif';
  media_url?: string;
  is_template: boolean;
  room_id: string;
  parent_id?: string;
  poll_display_type?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  poll_result_format?: 'percentage' | 'votes' | 'both';
  option_colors?: any;
  title?: string;
  description?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  is_public?: boolean;
  time_limit?: number;
  show_answers?: boolean;
  theme?: any;
  logo_url?: string;
  max_players?: number;
}

export default function ActivationManager() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Activation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [room, setRoom] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [uploadingOptionIndex, setUploadingOptionIndex] = useState<number | null>(null);
  
  // Fetch activations when component mounts
  useEffect(() => {
    if (roomId) {
      fetchActivations();
      fetchRoom();
    }
  }, [roomId]);
  
  const fetchRoom = async () => {
    if (!roomId) return;
    
    try {
      setRoomLoading(true);
      setRoomError(null);
      
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (error) throw error;
      setRoom(data);
    } catch (err: any) {
      console.error('Error fetching room:', err);
      // Check for specific error types
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setRoomError('Network error: Unable to connect to the database. Please check your internet connection and try again.');
      } else if (err.code === 'PGRST116') {
        setRoomError(`Room not found. The room with ID "${roomId}" does not exist.`);
      } else {
        setRoomError(err.message || 'Failed to load room data');
      }
    } finally {
      setRoomLoading(false);
    }
  };
  
  const fetchActivations = async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('activations')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_template', true)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setActivations(data || []);
    } catch (err: any) {
      console.error('Error fetching activations:', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to the database. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to load activations');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const activateTemplate = async (template: Activation) => {
    if (!roomId || !template.id) return;
    
    try {
      setActivatingId(template.id);
      setError(null);
      
      // First deactivate current activation if exists
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();

      if (sessionData?.current_activation) {
        await supabase
          .from('game_sessions')
          .update({ current_activation: null })
          .eq('id', sessionData.id);
      }
      
      // Prepare activation data
      const activationData: any = {
        type: template.type,
        question: template.question || template.title,
        media_type: template.media_type,
        media_url: template.media_url,
        parent_id: template.id,
        is_template: false,
        room_id: roomId,
        poll_state: 'pending',
        poll_display_type: template.poll_display_type,
        poll_result_format: template.poll_result_format,
        option_colors: template.option_colors,
        title: template.title || template.question,
        description: template.description || '',
        theme: template.theme,
        logo_url: template.logo_url,
        max_players: template.max_players,
        time_limit: template.time_limit,
        show_answers: template.show_answers
      };
      
      // Add type-specific fields
      if (template.type === 'multiple_choice') {
        activationData.options = template.options;
        activationData.correct_answer = template.correct_answer;
        
        // If timer is enabled, set timer_started_at
        if (template.time_limit && template.time_limit > 0) {
          activationData.timer_started_at = new Date().toISOString();
        }
      } else if (template.type === 'text_answer') {
        activationData.exact_answer = template.exact_answer;
        activationData.options = [];
        
        // If timer is enabled, set timer_started_at
        if (template.time_limit && template.time_limit > 0) {
          activationData.timer_started_at = new Date().toISOString();
        }
      } else if (template.type === 'poll') {
        activationData.options = template.options;
        activationData.poll_state = 'pending';
      }
      
      // Create the activation
      const { data, error } = await supabase
        .from('activations')
        .insert([activationData])
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Check if there's an existing game session
        const { data: session } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('room_id', roomId)
          .maybeSingle();

        if (session) {
          // Update existing session
          await supabase
            .from('game_sessions')
            .update({ 
              current_activation: data.id,
              is_live: true 
            })
            .eq('id', session.id);
        } else {
          // Use upsert to handle race conditions
          await supabase
            .from('game_sessions')
            .upsert([{
              room_id: roomId,
              current_activation: data.id,
              is_live: true
            }], {
              onConflict: 'room_id'
            });
        }

        // Show success message
        setSuccess(`"${template.title || template.question}" activated successfully!`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      console.error('Error activating template:', error);
      setError('Failed to activate template: ' + (error.message || 'Unknown error'));
    } finally {
      setActivatingId(null);
    }
  };
  
  const handleCreateTemplate = () => {
    setCurrentTemplate({
      type: 'multiple_choice',
      question: '',
      options: [],
      media_type: 'none',
      is_template: true,
      room_id: roomId || '',
      poll_display_type: 'bar',
      poll_result_format: 'both',
      time_limit: 0,
      show_answers: true
    });
    setIsEditing(false);
    setShowCreateModal(true);
  };
  
  const handleEditTemplate = (template: Activation) => {
    setCurrentTemplate(template);
    setIsEditing(true);
    setShowCreateModal(true);
  };
  
  const handleDuplicateTemplate = (template: Activation) => {
    const { id, ...rest } = template;
    setCurrentTemplate({
      ...rest,
      question: `Copy of ${template.question}`,
      title: template.title ? `Copy of ${template.title}` : undefined
    });
    setIsEditing(false);
    setShowCreateModal(true);
  };
  
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // First, find any activations that reference this template as parent_id
      const { data: childActivations, error: childError } = await supabase
        .from('activations')
        .select('id')
        .eq('parent_id', id);
      
      if (childError) throw childError;
      
      // If there are child activations, update them to remove the parent_id reference
      if (childActivations && childActivations.length > 0) {
        const { error: updateError } = await supabase
          .from('activations')
          .update({ parent_id: null })
          .eq('parent_id', id);
        
        if (updateError) throw updateError;
      }
      
      // Now we can safely delete the template
      const { error } = await supabase
        .from('activations')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setActivations(activations.filter(a => a.id !== id));
      
      // Show success message
      setSuccess('Template deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setError(err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveTemplate = async () => {
    if (!currentTemplate) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate required fields
      if (!currentTemplate.question?.trim()) {
        setError('Question is required');
        return;
      }
      
      if (currentTemplate.type === 'multiple_choice' && (!currentTemplate.options || currentTemplate.options.length < 2)) {
        setError('Multiple choice questions require at least 2 options');
        return;
      }
      
      if (currentTemplate.type === 'multiple_choice' && !currentTemplate.correct_answer) {
        setError('Multiple choice questions require a correct answer');
        return;
      }
      
      if (currentTemplate.type === 'text_answer' && !currentTemplate.exact_answer) {
        setError('Text answer questions require an exact answer');
        return;
      }
      
      // Set default title if not provided
      if (!currentTemplate.title) {
        currentTemplate.title = currentTemplate.question.substring(0, 50);
      }
      
      // Prepare data for saving
      const templateData = {
        ...currentTemplate,
        is_template: true,
        room_id: roomId
      };
      
      let result;
      
      if (isEditing && currentTemplate.id) {
        // Update existing template
        const { data, error } = await supabase
          .from('activations')
          .update(templateData)
          .eq('id', currentTemplate.id)
          .select();
          
        if (error) throw error;
        result = data?.[0];
        
        // Update local state
        setActivations(activations.map(a => a.id === currentTemplate.id ? result : a));
        
        setSuccess('Template updated successfully');
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('activations')
          .insert([templateData])
          .select();
          
        if (error) throw error;
        result = data?.[0];
        
        // Update local state
        setActivations([result, ...activations]);
        
        setSuccess('Template created successfully');
      }
      
      // Close modal and reset state
      setShowCreateModal(false);
      setCurrentTemplate(null);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!currentTemplate) return;
    
    const { name, value, type } = e.target;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        [name]: type === 'checkbox' 
          ? (e.target as HTMLInputElement).checked 
          : type === 'number'
            ? parseInt(value)
            : value
      };
    });
  };
  
  const handleAddOption = () => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        options: [...(prev.options || []), { text: '', media_type: 'none', media_url: '' }]
      };
    });
  };
  
  const handleOptionChange = (index: number, field: string, value: any) => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      const options = [...(prev.options || [])];
      options[index] = { ...options[index], [field]: value };
      
      // If this is the correct answer option, update correct_answer
      if (field === 'text' && prev.correct_answer === options[index].text) {
        return { ...prev, options, correct_answer: value };
      }
      
      return { ...prev, options };
    });
  };
  
  const handleSetCorrectAnswer = (answer: string) => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      return { ...prev, correct_answer: answer };
    });
  };
  
  const handleSetPollDisplayType = (displayType: 'bar' | 'vertical' | 'pie' | 'horizontal') => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      return { ...prev, poll_display_type: displayType };
    });
  };
  
  const handleRemoveOption = (index: number) => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      const options = [...(prev.options || [])];
      
      // Check if we're removing the correct answer
      let correct_answer = prev.correct_answer;
      if (prev.correct_answer === options[index].text) {
        correct_answer = '';
      }
      
      options.splice(index, 1);
      return { ...prev, options, correct_answer };
    });
  };
  
  const handleAddTag = (tag: string) => {
    if (!currentTemplate || !tag.trim()) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      const tags = [...(prev.tags || [])];
      if (!tags.includes(tag.trim())) {
        tags.push(tag.trim());
      }
      
      return { ...prev, tags };
    });
  };
  
  const handleRemoveTag = (tag: string) => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      const tags = (prev.tags || []).filter(t => t !== tag);
      return { ...prev, tags };
    });
  };
  
  const handleMediaUpload = async (file: File) => {
    if (!currentTemplate) return;
    
    try {
      setIsUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `activations/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
      
      // Update template with media URL
      setCurrentTemplate(prev => {
        if (!prev) return null;
        return { ...prev, media_url: urlData.publicUrl, media_type: file.type.includes('image') ? 'image' : 'gif' };
      });
      
    } catch (error) {
      console.error('Error uploading media:', error);
      setError('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle media upload for individual options
  const handleOptionMediaUpload = async (file: File, optionIndex: number) => {
    if (!currentTemplate) return;
    
    try {
      setUploadingOptionIndex(optionIndex);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_option${optionIndex}.${fileExt}`;
      const filePath = `options/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
      
      // Update option with media URL
      setCurrentTemplate(prev => {
        if (!prev) return null;
        
        const options = [...(prev.options || [])];
        options[optionIndex] = { 
          ...options[optionIndex], 
          media_url: urlData.publicUrl, 
          media_type: file.type.includes('image') ? 'image' : 'gif' 
        };
        
        return { ...prev, options };
      });
      
    } catch (error) {
      console.error('Error uploading option media:', error);
      setError('Failed to upload media for option');
    } finally {
      setUploadingOptionIndex(null);
    }
  };
  
  // Remove media from an option
  const handleRemoveOptionMedia = (optionIndex: number) => {
    if (!currentTemplate) return;
    
    setCurrentTemplate(prev => {
      if (!prev) return null;
      
      const options = [...(prev.options || [])];
      options[optionIndex] = { 
        ...options[optionIndex], 
        media_url: '', 
        media_type: 'none' 
      };
      
      return { ...prev, options };
    });
  };
  
  // Filter activations based on search and type filter
  const filteredActivations = activations.filter(activation => {
    const matchesSearch = 
      activation.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (activation.title && activation.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (activation.description && activation.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || activation.type === selectedType;
    
    return matchesSearch && matchesType;
  });
  
  const handleNavigateToRoom = () => {
    if (roomId) {
      navigate(`/admin/room/${roomId}`);
    }
  };
  
  const handleNavigateToRoomSettings = () => {
    if (roomId) {
      navigate(`/admin/branding/${roomId}`);
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        {/* Breadcrumb navigation */}
        <Breadcrumb 
          items={[
            { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
            { label: 'Rooms', href: '/admin/rooms' },
            { label: room?.name || 'Room', href: `/admin/room/${roomId}` },
            { label: 'Activations' }
          ]}
          className="mb-2"
        />
        
        {roomError && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <div>
              <p className="font-semibold">Connection Error</p>
              <p>{roomError}</p>
              <button 
                onClick={() => fetchRoom()} 
                className="mt-2 px-3 py-1 text-sm bg-red-200 text-red-800 rounded-md hover:bg-red-300"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" /> Retry Connection
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              {roomLoading ? 'Loading Room...' : room?.name ? `${room.name} - Activations` : 'Activations'}
            </h1>
            {roomLoading && (
              <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin ml-2"></div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleNavigateToRoom}
              className="flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <LayoutDashboard className="w-4 h-4" />
              Room Dashboard
            </button>
            
            <button
              onClick={handleNavigateToRoomSettings}
              className="flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Settings className="w-4 h-4" />
              Room Settings
            </button>
            
            <button
              onClick={() => {
                fetchActivations();
                fetchRoom();
              }}
              disabled={loading || roomLoading}
              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${loading || roomLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleCreateTemplate}
              className="flex items-center gap-1 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
              disabled={roomLoading || !!roomError}
            >
              <PlusCircle className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{success}</span>
          </div>
        )}
        
        {/* Search and Filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search templates..."
              className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">All Types</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="text_answer">Text Answer</option>
              <option value="poll">Poll</option>
              <option value="leaderboard">Leaderboard</option>
            </select>
          </div>
        </div>
        
        {/* Templates Grid */}
        {loading && activations.length === 0 ? (
          <div className="flex justify-center items-center p-12">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        ) : activations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="flex justify-center mb-4">
              <PlusCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No templates yet</h2>
            <p className="text-gray-500 mb-6">
              Create your first template to start building interactive content for this room.
            </p>
            <button
              onClick={handleCreateTemplate}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              disabled={!!roomError}
            >
              Create Your First Template
            </button>
          </div>
        ) : filteredActivations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">
              No templates match your search criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActivations.map(template => (
              <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">
                      {template.title || template.question}
                    </h3>
                    
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {template.type === 'multiple_choice' ? 'Multiple Choice' : 
                         template.type === 'text_answer' ? 'Text Answer' : 
                         template.type === 'poll' ? 'Poll' : 
                         template.type === 'leaderboard' ? 'Leaderboard' : 'Social Wall'}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {template.description || template.question}
                  </p>
                  
                  {/* Add poll display type badge if it's a poll */}
                  {template.type === 'poll' && template.poll_display_type && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800">
                        {template.poll_display_type === 'bar' ? 'Horizontal Bars' : 
                         template.poll_display_type === 'vertical' ? 'Vertical Bars' : 
                         template.poll_display_type === 'pie' ? 'Pie Chart' : 
                         'Horizontal Bars'}
                      </span>
                    </div>
                  )}
                  
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          +{template.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex mt-4 pt-3 border-t border-gray-100 justify-between">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition"
                        title="Edit template"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                      
                      <button
                        onClick={() => activateTemplate(template)}
                        disabled={activatingId === template.id}
                        className="flex items-center gap-1 px-2 py-1 text-green-600 hover:text-white hover:bg-green-600 bg-green-50 rounded-md transition disabled:opacity-50"
                        title="Activate this template"
                      >
                        {activatingId === template.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span className="text-sm">Activate</span>
                      </button>
                    </div>
                    
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleDuplicateTemplate(template)}
                        className="p-1.5 text-gray-600 hover:text-green-600 rounded-md hover:bg-green-50"
                        title="Duplicate template"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id!)}
                        className="p-1.5 text-gray-600 hover:text-red-600 rounded-md hover:bg-red-50"
                        title="Delete template"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Create/Edit Template Modal */}
      {showCreateModal && currentTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? 'Edit Template' : 'Create New Template'}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={currentTemplate.title || ''}
                      onChange={handleInputChange}
                      placeholder="Enter a title for this template"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type*
                    </label>
                    <select
                      name="type"
                      value={currentTemplate.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="text_answer">Text Answer</option>
                      <option value="poll">Poll</option>
                      <option value="leaderboard">Leaderboard</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question*
                  </label>
                  <textarea
                    name="question"
                    value={currentTemplate.question}
                    onChange={handleInputChange}
                    placeholder="Enter your question"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={currentTemplate.description || ''}
                    onChange={handleInputChange}
                    placeholder="Enter a description (optional)"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                {/* Poll Display Format (for Poll type only) */}
                {currentTemplate.type === 'poll' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Poll Display Format
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleSetPollDisplayType('bar')}
                        className={`border rounded-lg p-3 flex flex-col items-center transition ${
                          currentTemplate.poll_display_type === 'bar' || !currentTemplate.poll_display_type
                            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        <BarChart className="w-6 h-6 mb-2 text-purple-600" />
                        <span className="text-sm font-medium">Horizontal Bars</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPollDisplayType('vertical')}
                        className={`border rounded-lg p-3 flex flex-col items-center transition ${
                          currentTemplate.poll_display_type === 'vertical'
                            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        <LayoutVertical className="w-6 h-6 mb-2 text-purple-600" />
                        <span className="text-sm font-medium">Vertical Bars</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPollDisplayType('pie')}
                        className={`border rounded-lg p-3 flex flex-col items-center transition ${
                          currentTemplate.poll_display_type === 'pie'
                            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        <PieChart className="w-6 h-6 mb-2 text-purple-600" />
                        <span className="text-sm font-medium">Pie Chart</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Media */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Media
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <select
                        name="media_type"
                        value={currentTemplate.media_type || 'none'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="none">No Media</option>
                        <option value="image">Image</option>
                        <option value="youtube">YouTube Video</option>
                        <option value="gif">GIF</option>
                      </select>
                    </div>
                    
                    {currentTemplate.media_type !== 'none' && (
                      <div>
                        <input
                          type="text"
                          name="media_url"
                          value={currentTemplate.media_url || ''}
                          onChange={handleInputChange}
                          placeholder="Enter URL"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  {currentTemplate.media_type === 'image' && (
                    <div className="mt-2">
                      <MediaUploader 
                        onUpload={handleMediaUpload}
                        uploading={isUploading}
                      />
                    </div>
                  )}
                </div>
                
                {/* Options for Multiple Choice or Poll */}
                {(currentTemplate.type === 'multiple_choice' || currentTemplate.type === 'poll') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Options*
                      </label>
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
                      >
                        <PlusCircle className="w-4 h-4 mr-1" />
                        Add Option
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {(currentTemplate.options || []).map((option, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 relative">
                          <div className="flex items-start gap-3">
                            {/* Option Image Upload */}
                            <div className="w-24">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Image
                              </label>
                              <OptionMediaUploader
                                onUpload={(file) => handleOptionMediaUpload(file, index)}
                                uploading={uploadingOptionIndex === index}
                                mediaUrl={option.media_url}
                              />
                              {option.media_url && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOptionMedia(index)}
                                  className="text-xs text-red-600 hover:text-red-800 mt-1"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            
                            {/* Option Text */}
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Option Text*
                              </label>
                              <input
                                type="text"
                                value={option.text}
                                onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                                placeholder={`Option ${index + 1} text`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              />
                              
                              {/* For Multiple Choice - Correct Answer Selection */}
                              {currentTemplate.type === 'multiple_choice' && (
                                <div className="mt-2">
                                  <label className="inline-flex items-center cursor-pointer">
                                    <input
                                      type="radio"
                                      name="correct_answer"
                                      checked={currentTemplate.correct_answer === option.text}
                                      onChange={() => handleSetCorrectAnswer(option.text)}
                                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Correct Answer</span>
                                  </label>
                                </div>
                              )}
                            </div>
                            
                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(index)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 absolute top-2 right-2"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {(currentTemplate.options || []).length === 0 && (
                        <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                          Add at least two options for this question.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Exact Answer for Text Answer */}
                {currentTemplate.type === 'text_answer' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exact Answer*
                    </label>
                    <input
                      type="text"
                      name="exact_answer"
                      value={currentTemplate.exact_answer || ''}
                      onChange={handleInputChange}
                      placeholder="Enter the exact answer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Player answers will be compared exactly to this text (case insensitive)
                    </p>
                  </div>
                )}
                
                {/* Timer Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Limit (seconds)
                    </label>
                    <input
                      type="number"
                      name="time_limit"
                      value={currentTemplate.time_limit || 0}
                      onChange={handleInputChange}
                      min="0"
                      max="300"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Set to 0 for no time limit. Maximum 300 seconds (5 minutes).
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Show Answers
                    </label>
                    <div className="flex items-center h-10">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="show_answers"
                          checked={currentTemplate.show_answers !== false}
                          onChange={(e) => setCurrentTemplate({...currentTemplate, show_answers: e.target.checked})}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {currentTemplate.type === 'poll' 
                            ? 'Show results after timer expires' 
                            : 'Show correct answers after timer expires'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(currentTemplate.tags || []).map(tag => (
                      <span 
                        key={tag} 
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {tag}
                        <button 
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-600"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a tag and press Enter"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add a tag and press Enter"]') as HTMLInputElement;
                        if (input && input.value) {
                          handleAddTag(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Preview */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-200 border-b border-gray-300">
                  <h3 className="font-medium text-gray-700">Preview</h3>
                </div>
                <div className="h-[600px] overflow-y-auto">
                  <ActivationPreview activation={currentTemplate} />
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSubmitting}
                className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {isEditing ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
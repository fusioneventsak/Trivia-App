import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Filter, Edit, Copy, Trash, PlusCircle, RefreshCw, Check, X, Share, Eye, EyeOff, Save, Tag, Clock, BarChart, PieChart, FlipVertical as LayoutVertical } from 'lucide-react';

interface QuestionTemplate {
  id: string;
  title: string;
  description: string;
  type: 'multiple_choice' | 'text_answer' | 'poll';
  question: string;
  options: any[];
  correct_answer?: string;
  exact_answer?: string;
  media_type: 'none' | 'image' | 'youtube' | 'gif';
  media_url?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  time_limit?: number;
  show_answers?: boolean;
  poll_display_type?: 'bar' | 'pie' | 'horizontal' | 'vertical';
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800'
};

export default function QuestionBank() {
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Template being edited/created
  const [currentTemplate, setCurrentTemplate] = useState<Partial<QuestionTemplate>>({
    title: '',
    description: '',
    type: 'multiple_choice',
    question: '',
    options: [],
    correct_answer: '',
    exact_answer: '',
    media_type: 'none',
    media_url: '',
    category: '',
    difficulty: 'medium',
    tags: [],
    is_public: false,
    time_limit: 0,
    show_answers: true,
    poll_display_type: 'bar'
  });
  
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('question_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      setTemplates(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data
        .map(t => t.category)
        .filter(Boolean))];
      
      setCategories(uniqueCategories);
      
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message || 'Failed to load question templates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateTemplate = () => {
    setCurrentTemplate({
      title: '',
      description: '',
      type: 'multiple_choice',
      question: '',
      options: [],
      correct_answer: '',
      exact_answer: '',
      media_type: 'none',
      media_url: '',
      category: '',
      difficulty: 'medium',
      tags: [],
      is_public: false,
      time_limit: 0,
      show_answers: true,
      poll_display_type: 'bar'
    });
    setShowCreateModal(true);
  };
  
  const handleEditTemplate = (template: QuestionTemplate) => {
    setCurrentTemplate(template);
    setShowCreateModal(true);
  };
  
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
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
      const { error: deleteError } = await supabase
        .from('question_templates')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      // Update local state
      setTemplates(templates.filter(t => t.id !== id));
      
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setError(err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDuplicateTemplate = (template: QuestionTemplate) => {
    const duplicate = {
      ...template,
      id: undefined,
      title: `Copy of ${template.title}`,
      is_public: false
    };
    
    setCurrentTemplate(duplicate);
    setShowCreateModal(true);
  };
  
  const handleSaveTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!currentTemplate.title?.trim() || !currentTemplate.question?.trim()) {
        throw new Error('Title and question are required');
      }
      
      if (currentTemplate.type === 'multiple_choice' && (!currentTemplate.options || currentTemplate.options.length < 2)) {
        throw new Error('Multiple choice questions require at least 2 options');
      }
      
      if (currentTemplate.type === 'multiple_choice' && !currentTemplate.correct_answer) {
        throw new Error('Multiple choice questions require a correct answer');
      }
      
      if (currentTemplate.type === 'text_answer' && !currentTemplate.exact_answer) {
        throw new Error('Text answer questions require an exact answer');
      }
      
      // Prepare data for saving
      const templateData = {
        ...currentTemplate,
        updated_at: new Date().toISOString()
      };
      
      let result;
      
      if (currentTemplate.id) {
        // Update existing template
        const { data, error } = await supabase
          .from('question_templates')
          .update(templateData)
          .eq('id', currentTemplate.id)
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        // Update local state
        setTemplates(templates.map(t => t.id === currentTemplate.id ? result : t));
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('question_templates')
          .insert([templateData])
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        // Update local state
        if (result) {
          setTemplates([result, ...templates]);
        }
      }
      
      setShowCreateModal(false);
      
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setCurrentTemplate(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : type === 'number'
          ? parseInt(value)
          : value
    }));
  };
  
  const handleAddOption = () => {
    setCurrentTemplate(prev => ({
      ...prev,
      options: [...(prev.options || []), { text: '', media_type: 'none', media_url: '' }]
    }));
  };
  
  const handleOptionChange = (index: number, field: string, value: string) => {
    setCurrentTemplate(prev => {
      const options = [...(prev.options || [])];
      options[index] = { ...options[index], [field]: value };
      return { ...prev, options };
    });
  };
  
  const handleRemoveOption = (index: number) => {
    setCurrentTemplate(prev => {
      const options = [...(prev.options || [])];
      options.splice(index, 1);
      
      // If correct answer was this option, reset it
      let correct_answer = prev.correct_answer;
      if (prev.options && prev.correct_answer === prev.options[index].text) {
        correct_answer = '';
      }
      
      return { ...prev, options, correct_answer };
    });
  };
  
  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    
    setCurrentTemplate(prev => ({
      ...prev,
      tags: [...(prev.tags || []), tag.trim()]
    }));
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(tag => tag !== tagToRemove)
    }));
  };

  // Handle setting display type for polls
  const handleSetPollDisplayType = (displayType: 'bar' | 'vertical' | 'pie') => {
    setCurrentTemplate(prev => ({
      ...prev,
      poll_display_type: displayType
    }));
  };
  
  // Filter templates based on search and filters
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesType = selectedType === 'all' || template.type === selectedType;
    const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesType && matchesDifficulty && matchesCategory;
  });
  
  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Question Bank</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              title="Refresh templates"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateTemplate}
              className="flex items-center gap-1 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              <PlusCircle className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <X className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by title, question, or tags..."
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
            </select>
          </div>
          
          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        
        {/* Templates List */}
        {loading && templates.length === 0 ? (
          <div className="flex justify-center items-center p-12">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="flex justify-center mb-4">
              <Plus className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No question templates yet</h2>
            <p className="text-gray-500 mb-6">
              Create your first question template to start building a reusable question bank.
            </p>
            <button
              onClick={handleCreateTemplate}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Create Your First Template
            </button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">
              No templates match your search criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">{template.title}</h3>
                    
                    <div className="flex items-center">
                      {template.is_public ? (
                        <div className="flex items-center text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          <Eye className="w-3 h-3 mr-1" />
                          Public
                        </div>
                      ) : (
                        <div className="flex items-center text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Private
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {template.type === 'multiple_choice' ? 'Multiple Choice' : 
                       template.type === 'text_answer' ? 'Text Answer' : 'Poll'}
                    </span>
                    
                    {template.difficulty && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        difficultyColors[template.difficulty as keyof typeof difficultyColors]
                      }`}>
                        {template.difficulty}
                      </span>
                    )}
                    
                    {template.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {template.category}
                      </span>
                    )}
                    
                    {template.poll_display_type && template.type === 'poll' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {template.poll_display_type === 'bar' ? 'Bar Chart' : 
                         template.poll_display_type === 'pie' ? 'Pie Chart' : 
                         template.poll_display_type === 'vertical' ? 'Vertical Bars' : 
                         'Horizontal Bars'}
                      </span>
                    )}
                    
                    {template.time_limit && template.time_limit > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3 mr-1" />
                        {template.time_limit}s
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.question}</p>
                  
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
                  
                  <div className="flex mt-4 pt-3 border-t border-gray-100 justify-end space-x-2">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-1.5 text-gray-600 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
                      title="Edit template"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="p-1.5 text-gray-600 hover:text-green-600 rounded-md hover:bg-green-50"
                      title="Duplicate template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1.5 text-gray-600 hover:text-red-600 rounded-md hover:bg-red-50"
                      title="Delete template"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {currentTemplate.id ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title*
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={currentTemplate.title || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type*
                  </label>
                  <select
                    name="type"
                    value={currentTemplate.type || 'multiple_choice'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="text_answer">Text Answer</option>
                    <option value="poll">Poll</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question*
                </label>
                <textarea
                  name="question"
                  value={currentTemplate.question || ''}
                  onChange={handleInputChange}
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
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={currentTemplate.category || ''}
                    onChange={handleInputChange}
                    list="categories"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                  <datalist id="categories">
                    {categories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    name="difficulty"
                    value={currentTemplate.difficulty || 'medium'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visibility
                  </label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_public"
                        checked={currentTemplate.is_public}
                        onChange={(e) => setCurrentTemplate({...currentTemplate, is_public: e.target.checked})}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Make public to all users</span>
                    </label>
                  </div>
                </div>
              </div>
              
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
                        <X className="w-3 h-3" />
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
                      if (input) {
                        handleAddTag(input.value);
                        input.value = '';
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
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
                  Media
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
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(currentTemplate.options || []).map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        
                        {currentTemplate.type === 'multiple_choice' && (
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="correct_answer"
                              checked={currentTemplate.correct_answer === option.text}
                              onChange={() => setCurrentTemplate({...currentTemplate, correct_answer: option.text})}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Correct</span>
                          </div>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Player answers will be compared exactly to this text (case insensitive)
                  </p>
                </div>
              )}
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
                disabled={loading}
                className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
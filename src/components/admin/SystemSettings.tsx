import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Check, Save, RefreshCw, RotateCcw } from 'lucide-react';
import { checkIsAdmin } from '../../lib/check-admin';

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string;
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const isAdminUser = await checkIsAdmin();
      setIsAdmin(isAdminUser);
      
      if (!isAdminUser) {
        setError('You do not have permission to access this page');
        setLoading(false);
      } else {
        fetchSettings();
      }
    };
    
    checkAdminStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');
      
      if (fetchError) throw fetchError;
      
      setSettings(data || []);
      
      // Initialize form values
      const initialValues: Record<string, any> = {};
      data?.forEach(setting => {
        initialValues[setting.key] = setting.value;
      });
      
      setFormValues(initialValues);
      
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleToggle = (key: string) => {
    setFormValues(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNumberChange = (key: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setFormValues(prev => ({
        ...prev,
        [key]: numValue
      }));
    }
  };

  const handleJSONChange = (key: string, fieldKey: string, value: any) => {
    setFormValues(prev => {
      const currentObj = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...currentObj,
          [fieldKey]: value
        }
      };
    });
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Update each setting
      for (const setting of settings) {
        const newValue = formValues[setting.key];
        
        if (JSON.stringify(newValue) !== JSON.stringify(setting.value)) {
          const { error: updateError } = await supabase
            .from('system_settings')
            .update({ value: newValue })
            .eq('id', setting.id);
          
          if (updateError) throw updateError;
        }
      }
      
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh settings
      fetchSettings();
      
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSetting = (key: string) => {
    const setting = settings.find(s => s.key === key);
    if (setting) {
      setFormValues(prev => ({
        ...prev,
        [key]: setting.value
      }));
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const key = setting.key;
    const value = formValues[key];
    
    // Boolean setting
    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center h-10">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={value}
                onChange={() => handleToggle(key)}
                className="sr-only"
              />
              <div className={`block w-14 h-8 rounded-full transition ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${value ? 'translate-x-6' : ''}`}></div>
            </div>
            <span className="ml-3 text-sm text-gray-700">{value ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      );
    }
    
    // Number setting
    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleNumberChange(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
        />
      );
    }
    
    // String setting
    if (typeof value === 'string') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
        />
      );
    }
    
    // JSON object setting (assumes simple key-value pairs)
    if (typeof value === 'object' && value !== null) {
      return (
        <div className="space-y-3">
          {Object.entries(value).map(([fieldKey, fieldValue]) => (
            <div key={fieldKey} className="flex items-center">
              <div className="w-1/3 text-sm text-gray-700">{fieldKey}:</div>
              <div className="w-2/3">
                {typeof fieldValue === 'boolean' ? (
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={fieldValue as boolean}
                        onChange={() => handleJSONChange(key, fieldKey, !fieldValue)}
                        className="sr-only"
                      />
                      <div className={`block w-10 h-6 rounded-full transition ${fieldValue ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${fieldValue ? 'translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                ) : typeof fieldValue === 'number' ? (
                  <input
                    type="number"
                    value={fieldValue as number}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleJSONChange(key, fieldKey, val);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValue as string}
                    onChange={(e) => handleJSONChange(key, fieldKey, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for other types
    return (
      <div className="text-sm text-gray-500">
        Complex setting type - not editable in UI
      </div>
    );
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-red-100 text-red-700 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>Access denied. You need administrator permissions to view this page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              title="Refresh settings"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 rounded-lg bg-red-100 text-red-700 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="p-4 rounded-lg bg-green-100 text-green-700 flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{success}</span>
          </div>
        )}
        
        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : settings.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No system settings found.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {settings.map(setting => (
                <div key={setting.id} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{formatSettingName(setting.key)}</h3>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => resetSetting(setting.key)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                      title="Reset to saved value"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4">
                    {renderSettingInput(setting)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSettingName(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
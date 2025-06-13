import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, isLightColor } from '../lib/theme-utils';
import { Save, RotateCcw, Check, ChevronDown, Plus, Minus, Palette, Layers, Trash, Edit, X } from 'lucide-react';

interface ThemeEditorProps {
  onClose?: () => void;
  onSave?: (theme: ThemeColors) => void;
  compact?: boolean;
  initialTheme?: ThemeColors;
}

interface ColorPalette {
  id: string;
  name: string;
  theme: ThemeColors;
}

const ThemeEditor: React.FC<ThemeEditorProps> = ({ 
  onClose, 
  onSave,
  compact = false,
  initialTheme
}) => {
  const { theme: globalTheme, setTheme, resetTheme } = useTheme();
  const [localTheme, setLocalTheme] = useState<ThemeColors>(initialTheme ? {...initialTheme} : {...globalTheme});
  const [saved, setSaved] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPalettes, setCustomPalettes] = useState<ColorPalette[]>([]);
  const [showSavePaletteModal, setShowSavePaletteModal] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Load custom palettes from localStorage
  useEffect(() => {
    try {
      const savedPalettes = localStorage.getItem('custom-color-palettes');
      if (savedPalettes) {
        setCustomPalettes(JSON.parse(savedPalettes));
      }
    } catch (error) {
      console.error('Error loading custom palettes:', error);
    }
  }, []);

  // Apply initial theme if provided
  useEffect(() => {
    if (initialTheme) {
      console.log("ThemeEditor: Setting initial theme", initialTheme);
      // Make sure we're creating a new object to avoid reference issues
      setLocalTheme({...initialTheme});
    }
  }, [initialTheme]);

  // Handle clicking outside to close any open color picker
  useEffect(() => {
    if (!activeColorPicker) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setActiveColorPicker(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeColorPicker]);

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setLocalTheme(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    try {
      // Creating a clean copy to ensure we don't pass references
      const themeToSave = {...localTheme};
      console.log("ThemeEditor: Saving theme", themeToSave);
      
      // Update global theme if no onSave prop is provided
      if (!onSave) {
        setTheme(themeToSave);
      } else {
        onSave(themeToSave);
      }
      
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      console.error("Error saving theme:", error);
      setDebugInfo(String(error));
    }
  };

  const handleReset = () => {
    if (initialTheme) {
      setLocalTheme({ ...initialTheme });
    } else {
      resetTheme();
      setLocalTheme({ ...globalTheme });
    }
  };

  const savePalette = () => {
    if (!newPaletteName.trim()) return;
    
    const newPalette: ColorPalette = {
      id: editingPaletteId || `palette-${Date.now()}`,
      name: newPaletteName,
      theme: { ...localTheme }
    };
    
    let updatedPalettes: ColorPalette[];
    
    if (editingPaletteId) {
      // Update existing palette
      updatedPalettes = customPalettes.map(p => 
        p.id === editingPaletteId ? newPalette : p
      );
    } else {
      // Add new palette
      updatedPalettes = [...customPalettes, newPalette];
    }
    
    setCustomPalettes(updatedPalettes);
    
    // Save to localStorage
    try {
      localStorage.setItem('custom-color-palettes', JSON.stringify(updatedPalettes));
    } catch (error) {
      console.error('Error saving custom palettes:', error);
    }
    
    // Reset form
    setNewPaletteName('');
    setEditingPaletteId(null);
    setShowSavePaletteModal(false);
  };

  const deletePalette = (id: string) => {
    const updatedPalettes = customPalettes.filter(p => p.id !== id);
    setCustomPalettes(updatedPalettes);
    
    // Save to localStorage
    try {
      localStorage.setItem('custom-color-palettes', JSON.stringify(updatedPalettes));
    } catch (error) {
      console.error('Error saving custom palettes:', error);
    }
  };

  const editPalette = (palette: ColorPalette) => {
    setNewPaletteName(palette.name);
    setEditingPaletteId(palette.id);
    setShowSavePaletteModal(true);
  };

  // Predefined color palettes
  const colorPalettes = [
    {
      name: "Default",
      primary_color: "#6366F1",
      secondary_color: "#8B5CF6",
      background_color: "#F3F4F6",
      text_color: "#1F2937",
      success_color: "#10B981",
      error_color: "#EF4444",
      warning_color: "#F59E0B",
      info_color: "#3B82F6"
    },
    {
      name: "Ocean",
      primary_color: "#0EA5E9",
      secondary_color: "#06B6D4",
      background_color: "#F0F9FF",
      text_color: "#0F172A",
      success_color: "#059669",
      error_color: "#DC2626",
      warning_color: "#D97706",
      info_color: "#2563EB"
    },
    {
      name: "Forest",
      primary_color: "#16A34A",
      secondary_color: "#65A30D",
      background_color: "#F0FDF4",
      text_color: "#14532D",
      success_color: "#15803D",
      error_color: "#B91C1C",
      warning_color: "#CA8A04",
      info_color: "#1D4ED8"
    },
    {
      name: "Sunset",
      primary_color: "#F97316",
      secondary_color: "#EA580C",
      background_color: "#FFF7ED",
      text_color: "#7C2D12",
      success_color: "#16A34A",
      error_color: "#DC2626",
      warning_color: "#FBBF24",
      info_color: "#3B82F6"
    },
    {
      name: "Dark Mode",
      primary_color: "#8B5CF6",
      secondary_color: "#6366F1",
      background_color: "#1E293B",
      text_color: "#F8FAFC",
      success_color: "#22C55E",
      error_color: "#EF4444",
      warning_color: "#F59E0B",
      info_color: "#3B82F6"
    }
  ];

  const applyPalette = (palette: any) => {
    // Create a new theme object by making a copy of all properties
    const newTheme = { ...localTheme };
    
    // Update with palette colors
    newTheme.primary_color = palette.primary_color;
    newTheme.secondary_color = palette.secondary_color;
    newTheme.background_color = palette.background_color;
    newTheme.text_color = palette.text_color;
    
    if (palette.success_color) newTheme.success_color = palette.success_color;
    if (palette.error_color) newTheme.error_color = palette.error_color;
    if (palette.warning_color) newTheme.warning_color = palette.warning_color;
    if (palette.info_color) newTheme.info_color = palette.info_color;
    
    // Update local state
    setLocalTheme(newTheme);
    
    // Show saved indicator
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Theme Settings</h3>
      
      {/* Color Palettes */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-gray-700">Color Palettes</h4>
          <button
            type="button"
            onClick={() => setShowSavePaletteModal(true)}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Save Current
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {colorPalettes.map((palette, index) => (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyPalette(palette);
              }}
              className="p-2 border border-gray-200 rounded-md hover:border-purple-500 transition-colors"
            >
              <div className="flex justify-between mb-1">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: palette.primary_color }}
                ></div>
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: palette.secondary_color }}
                ></div>
              </div>
              <div className="text-xs text-center font-medium">{palette.name}</div>
            </button>
          ))}
        </div>
        
        {/* Custom Palettes */}
        {customPalettes.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Custom Palettes</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {customPalettes.map((palette) => (
                <div
                  key={palette.id}
                  className="p-2 border border-gray-200 rounded-md hover:border-purple-500 transition-colors relative group"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      applyPalette(palette.theme);
                    }}
                    className="w-full h-full"
                  >
                    <div className="flex justify-between mb-1">
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: palette.theme.primary_color }}
                      ></div>
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: palette.theme.secondary_color }}
                      ></div>
                    </div>
                    <div className="text-xs text-center font-medium">{palette.name}</div>
                  </button>
                  
                  {/* Edit/Delete Controls */}
                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        editPalette(palette);
                      }}
                      className="p-1 text-gray-500 hover:text-purple-600"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deletePalette(palette.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className={`grid ${compact ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-2 gap-4'}`}>
        <ColorPicker
          label="Primary Color"
          value={localTheme.primary_color}
          onChange={(value) => handleColorChange('primary_color', value)}
          description="Used for buttons, accents, and primary UI elements"
          active={activeColorPicker === 'primary_color'}
          onToggle={() => setActiveColorPicker(activeColorPicker === 'primary_color' ? null : 'primary_color')}
          colorPickerRef={colorPickerRef}
        />
        
        <ColorPicker
          label="Secondary Color"
          value={localTheme.secondary_color}
          onChange={(value) => handleColorChange('secondary_color', value)}
          description="Used for highlights, secondary elements, and gradients"
          active={activeColorPicker === 'secondary_color'}
          onToggle={() => setActiveColorPicker(activeColorPicker === 'secondary_color' ? null : 'secondary_color')}
          colorPickerRef={colorPickerRef}
        />
        
        <ColorPicker
          label="Background Color"
          value={localTheme.background_color}
          onChange={(value) => handleColorChange('background_color', value)}
          description="Used for page backgrounds"
          active={activeColorPicker === 'background_color'}
          onToggle={() => setActiveColorPicker(activeColorPicker === 'background_color' ? null : 'background_color')}
          colorPickerRef={colorPickerRef}
        />
        
        <ColorPicker
          label="Text Color"
          value={localTheme.text_color}
          onChange={(value) => handleColorChange('text_color', value)}
          description="Used for main text content"
          active={activeColorPicker === 'text_color'}
          onToggle={() => setActiveColorPicker(activeColorPicker === 'text_color' ? null : 'text_color')}
          colorPickerRef={colorPickerRef}
        />
      </div>
      
      {/* Advanced Colors Section */}
      <div className="mt-6">
        <button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAdvanced(!showAdvanced);
          }}
          className="flex items-center text-sm font-medium text-purple-600 hover:text-purple-800 mb-4"
        >
          {showAdvanced ? <Minus className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAdvanced ? 'Hide Advanced Colors' : 'Show Advanced Colors'}
        </button>
        
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Container Background"
              value={localTheme.container_bg_color || 'rgba(255, 255, 255, 0.1)'}
              onChange={(value) => handleColorChange('container_bg_color', value)}
              description="Used for card and container backgrounds"
              allowAlpha
              active={activeColorPicker === 'container_bg_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'container_bg_color' ? null : 'container_bg_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Input Background"
              value={localTheme.input_bg_color || 'rgba(255, 255, 255, 0.2)'}
              onChange={(value) => handleColorChange('input_bg_color', value)}
              description="Used for input fields"
              allowAlpha
              active={activeColorPicker === 'input_bg_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'input_bg_color' ? null : 'input_bg_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Input Text Color"
              value={localTheme.input_text_color || '#FFFFFF'}
              onChange={(value) => handleColorChange('input_text_color', value)}
              description="Used for text in input fields"
              active={activeColorPicker === 'input_text_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'input_text_color' ? null : 'input_text_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Button Text Color"
              value={localTheme.button_text_color || '#FFFFFF'}
              onChange={(value) => handleColorChange('button_text_color', value)}
              description="Used for text on buttons"
              active={activeColorPicker === 'button_text_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'button_text_color' ? null : 'button_text_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Success Color"
              value={localTheme.success_color || '#10B981'}
              onChange={(value) => handleColorChange('success_color', value)}
              description="Used for success messages and indicators"
              active={activeColorPicker === 'success_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'success_color' ? null : 'success_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Error Color"
              value={localTheme.error_color || '#EF4444'}
              onChange={(value) => handleColorChange('error_color', value)}
              description="Used for error messages and indicators"
              active={activeColorPicker === 'error_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'error_color' ? null : 'error_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Warning Color"
              value={localTheme.warning_color || '#F59E0B'}
              onChange={(value) => handleColorChange('warning_color', value)}
              description="Used for warning messages and indicators"
              active={activeColorPicker === 'warning_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'warning_color' ? null : 'warning_color')}
              colorPickerRef={colorPickerRef}
            />
            
            <ColorPicker
              label="Info Color"
              value={localTheme.info_color || '#3B82F6'}
              onChange={(value) => handleColorChange('info_color', value)}
              description="Used for informational messages and indicators"
              active={activeColorPicker === 'info_color'}
              onToggle={() => setActiveColorPicker(activeColorPicker === 'info_color' ? null : 'info_color')}
              colorPickerRef={colorPickerRef}
            />
          </div>
        )}
      </div>
      
      {/* Theme Preview */}
      <div className="p-4 mt-6 rounded-lg" style={{ backgroundColor: localTheme.background_color }}>
        <h3 className="mb-3 font-semibold" style={{ color: localTheme.text_color }}>Theme Preview</h3>
        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-2 rounded-md"
            style={{ 
              backgroundColor: localTheme.primary_color,
              color: localTheme.button_text_color || '#FFFFFF'
            }}
            type="button"
          >
            Primary Button
          </button>
          <button
            className="px-4 py-2 rounded-md"
            style={{ 
              backgroundColor: localTheme.secondary_color,
              color: localTheme.button_text_color || '#FFFFFF'
            }}
            type="button"
          >
            Secondary Button
          </button>
          <div 
            className="px-4 py-2 rounded-md"
            style={{ 
              backgroundColor: localTheme.container_bg_color || 'rgba(255, 255, 255, 0.1)',
              color: localTheme.text_color
            }}
          >
            Container
          </div>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-3">
          <div 
            className="px-3 py-1 rounded-full text-sm"
            style={{ 
              backgroundColor: localTheme.success_color || '#10B981',
              color: '#FFFFFF'
            }}
          >
            Success
          </div>
          <div 
            className="px-3 py-1 rounded-full text-sm"
            style={{ 
              backgroundColor: localTheme.error_color || '#EF4444',
              color: '#FFFFFF'
            }}
          >
            Error
          </div>
          <div 
            className="px-3 py-1 rounded-full text-sm"
            style={{ 
              backgroundColor: localTheme.warning_color || '#F59E0B',
              color: '#FFFFFF'
            }}
          >
            Warning
          </div>
          <div 
            className="px-3 py-1 rounded-full text-sm"
            style={{ 
              backgroundColor: localTheme.info_color || '#3B82F6',
              color: '#FFFFFF'
            }}
          >
            Info
          </div>
        </div>
        
        <div className="mt-3">
          <div 
            className="px-4 py-2 rounded-md"
            style={{ 
              backgroundColor: localTheme.input_bg_color || 'rgba(255, 255, 255, 0.2)',
              color: localTheme.input_text_color || '#FFFFFF'
            }}
          >
            Input field
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </button>
        
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-white rounded-md flex items-center"
          style={{ backgroundColor: localTheme.primary_color }}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Apply Theme
            </>
          )}
        </button>
      </div>
      
      {/* Save Palette Modal */}
      {showSavePaletteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingPaletteId ? 'Edit Color Palette' : 'Save Color Palette'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowSavePaletteModal(false);
                  setNewPaletteName('');
                  setEditingPaletteId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label htmlFor="palette-name" className="block text-sm font-medium text-gray-700 mb-1">
                Palette Name
              </label>
              <input
                type="text"
                id="palette-name"
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                placeholder="My Custom Palette"
              />
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <div className="flex gap-1">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: localTheme.primary_color }}
                  ></div>
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: localTheme.secondary_color }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">Current Theme</div>
              </div>
              
              <div className="flex flex-wrap gap-1">
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: localTheme.success_color || '#10B981' }}
                ></div>
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: localTheme.error_color || '#EF4444' }}
                ></div>
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: localTheme.warning_color || '#F59E0B' }}
                ></div>
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: localTheme.info_color || '#3B82F6' }}
                ></div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowSavePaletteModal(false);
                  setNewPaletteName('');
                  setEditingPaletteId(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePalette}
                disabled={!newPaletteName.trim()}
                className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingPaletteId ? 'Update Palette' : 'Save Palette'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Info */}
      {debugInfo && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md overflow-auto">
          <p className="font-medium mb-1">Debug Info:</p>
          <pre className="whitespace-pre-wrap text-xs">{debugInfo}</pre>
        </div>
      )}
    </div>
  );
};

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  allowAlpha?: boolean;
  active: boolean;
  onToggle: () => void;
  colorPickerRef: React.RefObject<HTMLDivElement>;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ 
  label, 
  value, 
  onChange, 
  description,
  allowAlpha = false,
  active,
  onToggle,
  colorPickerRef
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const colorId = `color-${label.replace(/\s+/g, '-').toLowerCase()}`;
  
  // Focus the input when the color picker is opened
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // Handle direct color input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Handle color picker changes
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const newColor = e.target.value;
      
      // If we're using alpha and the current color is rgba, preserve the alpha
      if (allowAlpha && value.startsWith('rgba')) {
        const alpha = getAlphaFromColor(value);
        onChange(hexToRgba(newColor, alpha));
      } else {
        onChange(newColor);
      }
    } catch (error) {
      console.error("Error changing color:", error);
    }
  };

  // Handle clicking on a color preset
  const handlePresetClick = (color: string) => {
    if (allowAlpha && value.startsWith('rgba')) {
      const alpha = getAlphaFromColor(value);
      onChange(hexToRgba(color, alpha));
    } else {
      onChange(color);
    }
  };

  // Extract the hex part of the color for the color picker input
  const getColorForPicker = (): string => {
    if (value.startsWith('rgba')) {
      return rgbaToHex(value);
    }
    return value;
  };

  return (
    <div className="relative">
      <label htmlFor={colorId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex">
        <div 
          className="w-10 h-10 rounded-md cursor-pointer border border-gray-300 flex items-center justify-center"
          style={{ backgroundColor: value }}
          onClick={onToggle}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${active ? 'rotate-180' : ''}`} 
            style={{ color: isLightColor(value) ? '#000000' : '#FFFFFF' }} 
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          className="flex-1 px-3 py-2 ml-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
      
      {active && (
        <div 
          ref={colorPickerRef}
          className="absolute z-50 mt-1 left-0 bg-white rounded-md shadow-lg p-3 border border-gray-200"
          style={{ minWidth: '240px' }}
        >
          <input
            id={colorId}
            type="color"
            value={getColorForPicker()}
            onChange={handleColorPickerChange}
            className="w-full h-10 cursor-pointer border-0 p-0 m-0"
          />
          
          {allowAlpha && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Opacity: {getAlphaFromColor(value).toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={getAlphaFromColor(value)}
                onChange={(e) => {
                  const alpha = parseFloat(e.target.value);
                  const newColor = setAlphaInColor(value, alpha);
                  onChange(newColor);
                }}
                className="w-full"
              />
            </div>
          )}
          
          <div className="mt-2 grid grid-cols-5 gap-1">
            {['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', 
              '#F59E0B', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6'].map((color) => (
              <div
                key={color}
                className="w-6 h-6 rounded-md cursor-pointer border border-gray-200"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetClick(color)}
              />
            ))}
          </div>
          
          <div className="mt-2 grid grid-cols-5 gap-1">
            {['#000000', '#333333', '#666666', '#999999', '#CCCCCC', 
              '#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'].map((color) => (
              <div
                key={color}
                className="w-6 h-6 rounded-md cursor-pointer border border-gray-200"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetClick(color)}
              />
            ))}
          </div>
        </div>
      )}
      
      {description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
};

// Helper function to convert rgba to hex (approximate)
function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
  if (!match) return '#000000';
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to get alpha value from color
function getAlphaFromColor(color: string): number {
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*(?:\.\d+)?)\)/);
    if (match && match[4]) {
      return parseFloat(match[4]);
    }
  }
  return 1;
}

// Helper function to set alpha in color
function setAlphaInColor(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*(?:\d*(?:\.\d+)?)\)/, `rgba($1, $2, $3, ${alpha})`);
  } else if (color.startsWith('rgb')) {
    return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, `rgba($1, $2, $3, ${alpha})`);
  } else if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export default ThemeEditor;
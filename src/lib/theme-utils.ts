// Theme utility functions for consistent theming across the application

export interface ThemeColors {
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
}

// Default theme colors
export const defaultTheme: ThemeColors = {
  primary_color: '#6366F1', // Indigo
  secondary_color: '#8B5CF6', // Purple
  background_color: '#F3F4F6', // Light gray
  text_color: '#1F2937', // Dark gray
  container_bg_color: 'rgba(255, 255, 255, 0.1)', // Translucent white
  input_bg_color: 'rgba(255, 255, 255, 0.2)', // Slightly more opaque white
  input_text_color: '#FFFFFF', // White
  button_text_color: '#FFFFFF', // White
  success_color: '#10B981', // Green
  error_color: '#EF4444', // Red
  warning_color: '#F59E0B', // Amber
  info_color: '#3B82F6', // Blue
};

// Predefined theme palettes
export const themePalettes = [
  {
    id: 'default',
    name: 'Default',
    theme: defaultTheme
  },
  {
    id: 'ocean',
    name: 'Ocean',
    theme: {
      primary_color: '#0EA5E9',
      secondary_color: '#06B6D4',
      background_color: '#F0F9FF',
      text_color: '#0F172A',
      success_color: '#059669',
      error_color: '#DC2626',
      warning_color: '#D97706',
      info_color: '#2563EB'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    theme: {
      primary_color: '#16A34A',
      secondary_color: '#65A30D',
      background_color: '#F0FDF4',
      text_color: '#14532D',
      success_color: '#15803D',
      error_color: '#B91C1C',
      warning_color: '#CA8A04',
      info_color: '#1D4ED8'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    theme: {
      primary_color: '#F97316',
      secondary_color: '#EA580C',
      background_color: '#FFF7ED',
      text_color: '#7C2D12',
      success_color: '#16A34A',
      error_color: '#DC2626',
      warning_color: '#FBBF24',
      info_color: '#3B82F6'
    }
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    theme: {
      primary_color: '#8B5CF6',
      secondary_color: '#6366F1',
      background_color: '#1E293B',
      text_color: '#F8FAFC',
      container_bg_color: 'rgba(255, 255, 255, 0.05)',
      input_bg_color: 'rgba(255, 255, 255, 0.1)',
      success_color: '#22C55E',
      error_color: '#EF4444',
      warning_color: '#F59E0B',
      info_color: '#3B82F6'
    }
  }
];

// Generate CSS variables from theme
export function generateCssVariables(theme: ThemeColors): string {
  const variables = Object.entries(theme).map(([key, value]) => {
    return `--${key.replace(/_/g, '-')}: ${value};`;
  }).join('\n');

  return `:root {\n${variables}\n}`;
}

// Apply theme to document
export function applyTheme(theme: ThemeColors): void {
  console.log('Applying theme to CSS variables:', theme);
  const root = document.documentElement;
  
  // Apply all theme properties to CSS variables
  Object.entries(theme).forEach(([key, value]) => {
    if (value) {
      const cssVarName = `--${key.replace(/_/g, '-')}`;
      root.style.setProperty(cssVarName, value);
      console.log(`Setting ${cssVarName} to ${value}`);
    }
  });
  
  // Apply fallback values for optional properties
  if (!theme.container_bg_color) {
    root.style.setProperty('--container-bg-color', 'rgba(255, 255, 255, 0.1)');
  }
  if (!theme.input_bg_color) {
    root.style.setProperty('--input-bg-color', 'rgba(255, 255, 255, 0.2)');
  }
  if (!theme.input_text_color) {
    root.style.setProperty('--input-text-color', '#FFFFFF');
  }
  if (!theme.button_text_color) {
    root.style.setProperty('--button-text-color', '#FFFFFF');
  }
  if (!theme.success_color) {
    root.style.setProperty('--success-color', '#10B981');
  }
  if (!theme.error_color) {
    root.style.setProperty('--error-color', '#EF4444');
  }
  if (!theme.warning_color) {
    root.style.setProperty('--warning-color', '#F59E0B');
  }
  if (!theme.info_color) {
    root.style.setProperty('--info-color', '#3B82F6');
  }
}

// Check if a color is light or dark
export function isLightColor(color: string): boolean {
  if (!color || typeof color !== 'string') return true;
  
  try {
    // Handle rgba colors
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        return brightness > 0.5;
      }
      return true;
    }
    
    // Handle rgb colors
    if (color.startsWith('rgb')) {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        return brightness > 0.5;
      }
      return true;
    }
    
    // Handle hex colors
    if (!color.startsWith('#') || color.length < 7) return true;
    
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Calculate perceived brightness using the formula
    // (0.299*R + 0.587*G + 0.114*B)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    
    // Return true if the color is light (brightness > 0.5)
    return brightness > 0.5;
  } catch (error) {
    console.error('Error checking if color is light:', error);
    return true;
  }
}

// Get contrasting text color (black or white) based on background
export function getContrastColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#1F2937' : '#FFFFFF';
}

// Generate color palette for poll options
export function generatePollColors(theme: ThemeColors, count: number): string[] {
  const baseColors = [
    theme.primary_color,
    theme.secondary_color,
    theme.success_color || '#10B981',
    theme.warning_color || '#F59E0B',
    theme.error_color || '#EF4444',
    '#06B6D4', // Cyan
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F97316', // Orange
    '#14B8A6', // Teal
  ];

  // If we need more colors than we have in the base array, generate variations
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  const result = [...baseColors];
  
  // Generate variations of the base colors
  for (let i = 0; result.length < count; i++) {
    const baseColor = baseColors[i % baseColors.length];
    const variation = adjustColorLightness(baseColor, (i / baseColors.length) * 0.4 - 0.2);
    result.push(variation);
  }

  return result.slice(0, count);
}

// Save a theme palette to localStorage
export function saveThemePalette(name: string, theme: ThemeColors): string {
  try {
    const paletteId = `palette-${Date.now()}`;
    const palette = {
      id: paletteId,
      name,
      theme,
      createdAt: new Date().toISOString()
    };
    
    // Get existing palettes
    const existingPalettesJson = localStorage.getItem('theme-palettes');
    const existingPalettes = existingPalettesJson ? JSON.parse(existingPalettesJson) : [];
    
    // Add new palette
    const updatedPalettes = [...existingPalettes, palette];
    
    // Save back to localStorage
    localStorage.setItem('theme-palettes', JSON.stringify(updatedPalettes));
    
    return paletteId;
  } catch (error) {
    console.error('Error saving theme palette:', error);
    return '';
  }
}

// Get all saved theme palettes
export function getSavedThemePalettes(): any[] {
  try {
    const palettesJson = localStorage.getItem('theme-palettes');
    return palettesJson ? JSON.parse(palettesJson) : [];
  } catch (error) {
    console.error('Error getting saved theme palettes:', error);
    return [];
  }
}

// Delete a saved theme palette
export function deleteThemePalette(id: string): boolean {
  try {
    const palettesJson = localStorage.getItem('theme-palettes');
    if (!palettesJson) return false;
    
    const palettes = JSON.parse(palettesJson);
    const updatedPalettes = palettes.filter((p: any) => p.id !== id);
    
    localStorage.setItem('theme-palettes', JSON.stringify(updatedPalettes));
    return true;
  } catch (error) {
    console.error('Error deleting theme palette:', error);
    return false;
  }
}

// Helper function to adjust color lightness
function adjustColorLightness(hex: string, amount: number): string {
  // Handle non-hex colors
  if (!hex.startsWith('#')) {
    return hex;
  }

  try {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Convert RGB to HSL
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }

    // Adjust lightness
    l = Math.max(0, Math.min(1, l + amount));

    // Convert back to RGB
    let r1: number, g1: number, b1: number;

    if (s === 0) {
      r1 = g1 = b1 = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r1 = hue2rgb(p, q, h + 1/3);
      g1 = hue2rgb(p, q, h);
      b1 = hue2rgb(p, q, h - 1/3);
    }

    // Convert back to hex
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
  } catch (error) {
    console.error('Error adjusting color lightness:', error);
    return hex;
  }
}
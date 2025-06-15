import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeColors, defaultTheme, applyTheme } from '../lib/theme-utils';

interface ThemeContextType {
  theme: ThemeColors & { colors?: any };
  setTheme: (theme: ThemeColors) => void;
  updateThemeColor: (key: keyof ThemeColors, value: string) => void;
  resetTheme: () => void;
  savedPalettes: SavedPalette[];
  savePalette: (name: string, theme: ThemeColors) => void;
  deletePalette: (id: string) => void;
}

export interface SavedPalette {
  id: string;
  name: string;
  theme: ThemeColors;
  createdAt: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeColors;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme 
}) => {
  // Try to load theme from localStorage first
  const [theme, setThemeState] = useState<ThemeColors & { colors?: any }>(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme) {
        const parsedTheme = JSON.parse(savedTheme);
        const fullTheme = { ...defaultTheme, ...parsedTheme };
        // Add colors property for backward compatibility
        fullTheme.colors = {
          primary: fullTheme.primary_color,
          secondary: fullTheme.secondary_color,
          background: fullTheme.background_color,
          text: fullTheme.text_color
        };
        return fullTheme;
      }
      const fullTheme = initialTheme || defaultTheme;
      // Add colors property for backward compatibility
      fullTheme.colors = {
        primary: fullTheme.primary_color,
        secondary: fullTheme.secondary_color,
        background: fullTheme.background_color,
        text: fullTheme.text_color
      };
      return fullTheme;
    } catch (error) {
      console.error('Error loading theme from localStorage:', error);
      const fullTheme = initialTheme || defaultTheme;
      // Add colors property for backward compatibility
      fullTheme.colors = {
        primary: fullTheme.primary_color,
        secondary: fullTheme.secondary_color,
        background: fullTheme.background_color,
        text: fullTheme.text_color
      };
      return fullTheme;
    }
  });

  // Load saved palettes from localStorage
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(() => {
    try {
      const palettes = localStorage.getItem('custom-color-palettes');
      return palettes ? JSON.parse(palettes) : [];
    } catch (error) {
      console.error('Error loading saved palettes:', error);
      return [];
    }
  });

  // Apply theme whenever it changes
  useEffect(() => {
    console.log('Theme changed, applying new theme:', theme);
    
    // Make a copy to ensure we're not working with a read-only object
    const themeToApply = { ...theme };
    
    // Apply the theme to CSS variables
    applyTheme(themeToApply);
    
    // Save to localStorage
    try {
      localStorage.setItem('app-theme', JSON.stringify(themeToApply));
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [theme]);

  // Apply theme on initial load
  useEffect(() => {
    console.log('Initial theme application');
    applyTheme(theme);
    
    // Force reapplication after a short delay to ensure it takes effect
    const timer = setTimeout(() => {
      console.log('Reapplying theme after delay');
      applyTheme(theme);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Set theme function
  const setTheme = (newTheme: ThemeColors) => {
    console.log('Setting new theme:', newTheme);
    // Ensure we preserve any default values that might be missing
    setThemeState((prev: any) => {
      const mergedTheme = {
        ...prev,
        ...newTheme
      };
      
      // Update colors property for backward compatibility
      mergedTheme.colors = {
        primary: mergedTheme.primary_color,
        secondary: mergedTheme.secondary_color,
        background: mergedTheme.background_color,
        text: mergedTheme.text_color
      };
      
      console.log('Merged theme:', mergedTheme);
      return mergedTheme;
    });
  };

  // Update a single color in the theme
  const updateThemeColor = (key: keyof ThemeColors, value: string) => {
    console.log(`Updating theme color ${key} to ${value}`);
    setThemeState((prev: any) => {
      const newTheme = {
        ...prev,
        [key]: value
      };
      
      // Update colors property for backward compatibility
      if (key === 'primary_color') newTheme.colors = { ...prev.colors, primary: value };
      if (key === 'secondary_color') newTheme.colors = { ...prev.colors, secondary: value };
      if (key === 'background_color') newTheme.colors = { ...prev.colors, background: value };
      if (key === 'text_color') newTheme.colors = { ...prev.colors, text: value };
      
      return newTheme;
    });
  };

  // Reset theme to default
  const resetTheme = () => {
    console.log('Resetting theme to default');
    const fullTheme = { ...defaultTheme };
    // Add colors property for backward compatibility
    fullTheme.colors = {
      primary: fullTheme.primary_color,
      secondary: fullTheme.secondary_color,
      background: fullTheme.background_color,
      text: fullTheme.text_color
    };
    setThemeState(fullTheme);
  };

  // Save a new palette
  const savePalette = (name: string, paletteTheme: ThemeColors) => {
    const newPalette: SavedPalette = {
      id: `palette-${Date.now()}`,
      name,
      theme: { ...paletteTheme },
      createdAt: new Date().toISOString()
    };
    
    const updatedPalettes = [...savedPalettes, newPalette];
    setSavedPalettes(updatedPalettes);
    
    // Save to localStorage
    try {
      localStorage.setItem('custom-color-palettes', JSON.stringify(updatedPalettes));
    } catch (error) {
      console.error('Error saving palettes to localStorage:', error);
    }
  };

  // Delete a palette
  const deletePalette = (id: string) => {
    const updatedPalettes = savedPalettes.filter(palette => palette.id !== id);
    setSavedPalettes(updatedPalettes);
    
    // Save to localStorage
    try {
      localStorage.setItem('custom-color-palettes', JSON.stringify(updatedPalettes));
    } catch (error) {
      console.error('Error saving palettes to localStorage:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      updateThemeColor, 
      resetTheme,
      savedPalettes,
      savePalette,
      deletePalette
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
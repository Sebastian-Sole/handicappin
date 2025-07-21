import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

// Theme color utility that reads from CSS custom properties
// This ensures single source of truth from globals.css

export const getThemeColor = (colorName: string): string => {
  if (typeof window === 'undefined') return '';
  
  // Map color names to CSS custom properties
  const colorMap: Record<string, string> = {
    primary: '--primary',
    destructive: '--destructive',
    barActive: '--bar-active',
    barInactive: '--bar-inactive',
    chart1: '--chart-1',
  };
  
  const cssVariable = colorMap[colorName];
  if (!cssVariable) return '';
  
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim();
  return value;
};

// React hook for reactive theme colors
export const useThemeColors = () => {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState({
    primary: '',
    destructive: '',
    barActive: '',
    barInactive: '',
    chart1: ''
  });

  useEffect(() => {
    // Force a re-read of CSS variables after theme change
    const updateColors = () => {
      setColors({
        primary: getThemeColor('primary'),
        destructive: getThemeColor('destructive'),
        barActive: getThemeColor('barActive'),
        barInactive: getThemeColor('barInactive'),
        chart1: getThemeColor('chart1')
      });
    };

    // Immediate update
    updateColors();

    // Also update after a small delay to ensure CSS has propagated
    const timer = setTimeout(updateColors, 10);

    return () => clearTimeout(timer);
  }, [resolvedTheme]);

  return colors;
}; 
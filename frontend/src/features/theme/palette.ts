/** Accent palette definitions for the theme picker UI */
export type ThemeMode = 'light' | 'dark';
export type AccentColor = 'gray' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple' | 'black';

export interface AccentSwatch {
  name: AccentColor;
  label: string;
  lightColor: string;  // swatch color shown in light mode
  darkColor: string;   // swatch color shown in dark mode
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { name: 'gray',   label: 'Gray',   lightColor: '#6b7280', darkColor: '#9ca3af' },
  { name: 'blue',   label: 'Blue',   lightColor: '#2563eb', darkColor: '#60a5fa' },
  { name: 'green',  label: 'Green',  lightColor: '#16a34a', darkColor: '#4ade80' },
  { name: 'yellow', label: 'Yellow', lightColor: '#ca8a04', darkColor: '#facc15' },
  { name: 'pink',   label: 'Pink',   lightColor: '#db2777', darkColor: '#f472b6' },
  { name: 'orange', label: 'Orange', lightColor: '#ea580c', darkColor: '#fb923c' },
  { name: 'purple', label: 'Purple', lightColor: '#7c3aed', darkColor: '#a78bfa' },
  { name: 'black',  label: 'Black',  lightColor: '#1a1a1a', darkColor: '#e5e5e5' },
];

export const DEFAULT_THEME: ThemeMode = 'light';
export const DEFAULT_ACCENT: AccentColor = 'black';

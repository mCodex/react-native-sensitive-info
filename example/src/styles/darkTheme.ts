/**
 * Dark theme configuration for the React Native Sensitive Info example app
 * This replaces the light/dark theme toggle with a fixed dark theme
 */

/**
 * Dark theme configuration for the React Native Sensitive Info example app
 */

export const darkTheme = {
  // Core colors
  background: '#0a0a0a',
  surface: '#1a1a1a',
  card: '#2a2a2a',
  primary: '#3b82f6',
  secondary: '#6366f1',
  accent: '#10b981',

  // Text colors
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',

  // UI colors
  border: '#374151',
  borderLight: '#4b5563',
  divider: '#374151',

  // Input colors
  inputBackground: '#374151',
  inputBorder: '#4b5563',
  inputFocus: '#3b82f6',

  // Button colors
  buttonPrimary: '#3b82f6',
  buttonSecondary: '#374151',
  buttonDanger: '#ef4444',
  buttonSuccess: '#10b981',

  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.8)',
  backdrop: 'rgba(0, 0, 0, 0.5)',

  // Shadow
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // Border radius
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
  },

  // Typography
  typography: {
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
    },
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
};

export type Theme = typeof darkTheme;

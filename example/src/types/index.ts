/**
 * Type definitions for the React Native Sensitive Info example app
 */

export interface StoredItem {
  key: string;
  value: string;
  truncated?: boolean;
}

export interface Theme {
  background: string;
  card: string;
  primary: string;
  accent: string;
  success: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBackground: string;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
}

export interface DemoDataEntry {
  [key: string]: string;
}

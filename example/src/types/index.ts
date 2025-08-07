/**
 * Type definitions for the React Native Sensitive Info example app
 */

export interface StoredItem {
  key: string;
  value: string;
  truncated?: boolean;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
}

export interface DemoDataEntry {
  [key: string]: string;
}

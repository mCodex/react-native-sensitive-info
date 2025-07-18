import type { DemoDataEntry } from '../types';

export const DEMO_DATA: DemoDataEntry = {
  userToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
  userProfile: JSON.stringify({
    id: 123,
    name: 'John Doe',
    email: 'john.doe@example.com',
    preferences: { theme: 'dark', notifications: true },
  }),
  biometricSeed: 'secure-biometric-seed-value-2024',
  encryptionKey: 'aes256-encryption-key-super-secure',
  sessionData: JSON.stringify({
    sessionId: 'sess_abc123xyz789',
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  }),
};

/**
 * Get an appropriate icon for an item based on its key
 */
export function getItemIcon(key: string): string {
  if (key.toLowerCase().includes('token')) return '🎫';
  if (key.toLowerCase().includes('key')) return '🔑';
  if (
    key.toLowerCase().includes('user') ||
    key.toLowerCase().includes('profile')
  )
    return '👤';
  if (key.toLowerCase().includes('session')) return '⏱️';
  if (key.toLowerCase().includes('biometric')) return '👆';
  if (key.toLowerCase().includes('api')) return '🔌';
  return '📦';
}

/**
 * Get an appropriate color for an item based on its key
 */
export function getItemColor(key: string): string {
  if (key.toLowerCase().includes('token')) return '#4CAF50';
  if (key.toLowerCase().includes('key')) return '#FF9800';
  if (
    key.toLowerCase().includes('user') ||
    key.toLowerCase().includes('profile')
  )
    return '#2196F3';
  if (key.toLowerCase().includes('session')) return '#9C27B0';
  if (key.toLowerCase().includes('biometric')) return '#E91E63';
  if (key.toLowerCase().includes('api')) return '#607D8B';
  return '#666666';
}

/**
 * Truncate a value for display purposes
 */
export function truncateValue(
  value: string,
  maxLength: number = 50
): { value: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }
  return {
    value: value.substring(0, maxLength) + '...',
    truncated: true,
  };
}

/**
 * Format performance timing for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  return `${ms.toFixed(2)}ms`;
}

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

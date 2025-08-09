// Test setup file for Vitest
// This file is automatically loaded before all tests run

import { beforeEach, afterEach } from 'vitest';
import { setupTauriMocks, cleanupTauriMocks } from './mocks/tauriMocks';
import '@testing-library/jest-dom';

// Set up Tauri mocks before each test
beforeEach(() => {
  setupTauriMocks();
});

// Clean up after each test
afterEach(() => {
  cleanupTauriMocks();
});

// Mock the @tauri-apps/api/tauri module at the module level
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/tauri', () => {
  return {
    invoke: vi.fn().mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      // This will be overridden by the TauriMockManager in each test
      const mockManager = await import('./mocks/tauriMocks').then(m => m.TauriMockManager.getInstance());
      return mockManager.mockInvoke(command, args);
    })
  };
});

// Ensure window object exists in test environment
Object.defineProperty(window, '__TAURI_IPC__', {
  value: {},
  writable: true,
  configurable: true
});
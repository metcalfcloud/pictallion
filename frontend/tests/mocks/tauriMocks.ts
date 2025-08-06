// Mock implementation for Tauri APIs in testing environment
// This provides a complete mock of the Tauri IPC system for unit and integration tests

export interface TauriMockConfig {
  shouldFail?: boolean;
  failureMessage?: string;
  delay?: number;
  customResponses?: Record<string, unknown>;
}

export interface TauriCallRecord {
  command: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export class TauriMockManager {
  private static instance: TauriMockManager;
  private config: TauriMockConfig = {};
  private callHistory: TauriCallRecord[] = [];

  static getInstance(): TauriMockManager {
    if (!TauriMockManager.instance) {
      TauriMockManager.instance = new TauriMockManager();
    }
    return TauriMockManager.instance;
  }

  configure(config: TauriMockConfig): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.config = {};
    this.callHistory = [];
  }

  getCallHistory(): TauriCallRecord[] {
    return [...this.callHistory];
  }

  private recordCall(command: string, args: Record<string, unknown>): void {
    this.callHistory.push({
      command,
      args,
      timestamp: Date.now()
    });
  }

  async mockInvoke(command: string, args?: Record<string, unknown>): Promise<unknown> {
    this.recordCall(command, args || {});

    // Simulate network delay if configured
    if (this.config.delay) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }

    // Check for custom responses first
    if (this.config.customResponses && this.config.customResponses[command]) {
      return this.config.customResponses[command];
    }

    // Simulate failure if configured
    if (this.config.shouldFail) {
      throw new Error(this.config.failureMessage || `Mock failure for command: ${command}`);
    }

    // Default mock responses for each command
    switch (command) {
      case 'add_photo':
        return `Photo added successfully: ${args?.filePath || 'unknown'}`;
      
      case 'get_photo_metadata':
        return JSON.stringify({
          id: args?.photoId || 'mock-photo-id',
          filePath: '/mock/path/photo.jpg',
          metadata: {
            camera: 'Mock Camera',
            dateTime: '2024-01-01T12:00:00Z',
            location: 'Mock Location'
          }
        });
      
      case 'promote_photo_tier':
      case 'promote_photo':
        return `Photo promoted to ${args?.tier || 'silver'} tier`;
      
      case 'list_people':
        return [
          { id: 'person-1', name: 'Mock Person 1' },
          { id: 'person-2', name: 'Mock Person 2' }
        ];
      
      case 'create_person':
        return {
          id: 'new-person-id',
          name: (args?.req as { name?: string })?.name || 'New Person'
        };
      
      case 'update_person':
        return {
          id: args?.personId || 'updated-person-id',
          name: (args?.req as { name?: string })?.name || 'Updated Person'
        };
      
      case 'delete_person':
        return `Person ${args?.personId || 'unknown'} deleted successfully`;
      
      case 'merge_people':
        return `Merged ${(args?.req as { personIds?: string[] })?.personIds?.length || 0} people successfully`;
      
      case 'list_relationships':
        return [
          { id: 'rel-1', type: 'friend' },
          { id: 'rel-2', type: 'family' }
        ];
      
      case 'list_photos':
        return [
          { id: 'photo-1', filePath: '/mock/photo1.jpg', tier: 'bronze' },
          { id: 'photo-2', filePath: '/mock/photo2.jpg', tier: 'silver' },
          { id: 'photo-3', filePath: '/mock/photo3.jpg', tier: 'gold' }
        ];
      
      case 'detect_faces':
        return [
          {
            boundingBox: [100, 100, 200, 200],
            embedding: new Array(128).fill(0).map(() => Math.random())
          }
        ];
      
      case 'generate_face_embedding':
        return new Array(128).fill(0).map(() => Math.random());
      
      case 'face_detection_health_check':
        return true;
      
      default:
        return `Mock response for ${command}`;
    }
  }
}

// Global mock setup for window.__TAURI_IPC__
export function setupTauriMocks(): void {
  const mockManager = TauriMockManager.getInstance();
  
  // Mock the Tauri IPC object
  const globalWindow = global as unknown as { window?: { __TAURI_IPC__?: unknown } };
  globalWindow.window = globalWindow.window || {};
  globalWindow.window.__TAURI_IPC__ = {
    invoke: mockManager.mockInvoke.bind(mockManager)
  };

  // Mock the @tauri-apps/api/tauri module
  const mockTauriApi = {
    invoke: mockManager.mockInvoke.bind(mockManager)
  };

  // Store original require if it exists
  const globalWithRequire = global as unknown as { require?: (moduleName: string) => unknown };
  const originalRequire = globalWithRequire.require;
  
  // Mock require for @tauri-apps/api/tauri
  globalWithRequire.require = (moduleName: string) => {
    if (moduleName === '@tauri-apps/api/tauri') {
      return mockTauriApi;
    }
    return originalRequire ? originalRequire(moduleName) : {};
  };
}

// Cleanup function for tests
export function cleanupTauriMocks(): void {
  const mockManager = TauriMockManager.getInstance();
  mockManager.reset();
  
  // Clean up global mocks
  const globalWindow = global as unknown as { window?: { __TAURI_IPC__?: unknown } };
  if (globalWindow.window) {
    delete globalWindow.window.__TAURI_IPC__;
  }
}

// Helper functions for test scenarios
export function mockTauriSuccess(customResponses?: Record<string, unknown>): void {
  const mockManager = TauriMockManager.getInstance();
  mockManager.configure({
    shouldFail: false,
    customResponses
  });
}

export function mockTauriFailure(message?: string): void {
  const mockManager = TauriMockManager.getInstance();
  mockManager.configure({
    shouldFail: true,
    failureMessage: message
  });
}

export function mockTauriDelay(delay: number): void {
  const mockManager = TauriMockManager.getInstance();
  mockManager.configure({ delay });
}

export function getTauriCallHistory(): TauriCallRecord[] {
  const mockManager = TauriMockManager.getInstance();
  return mockManager.getCallHistory();
}
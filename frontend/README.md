# Pictallion Frontend

A React + TypeScript application for the Pictallion photo management platform, built with Vite and integrated with Tauri for native desktop features.

## Tech Stack

- **React 19** with TypeScript
- **Vite** for development and build
- **Material-UI** for UI components
- **Tauri** for native API integration
- **Vitest** for testing (with Tauri API mocking)

## Getting Started

```bash
npm install           # Install dependencies
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
```

## Testing

Comprehensive tests cover React components and Tauri integration.

```bash
npm run test                      # Run all tests
npm run test -- --watch           # Watch mode
npm run test -- --coverage        # Coverage report
npm run test -- tests/integration/upload.test.tsx
npm run test -- tests/integration/tauriApi.test.ts
```

Test structure:

```
tests/
├── setup.ts
├── mocks/
│   └── tauriMocks.ts
├── integration/
│   ├── upload.test.tsx
│   └── tauriApi.test.ts
└── App.test.tsx
```

### Tauri API Mocking

- Mocks all Tauri IPC commands used in the app
- Simulates errors, delays, and concurrent operations
- Tracks API call history for assertions

Example usage:

```typescript
import { mockTauriSuccess, mockTauriFailure, getTauriCallHistory } from './mocks/tauriMocks';

mockTauriSuccess();
await addPhoto('/path/to/photo.jpg');
expect(getTauriCallHistory()[0].command).toBe('add_photo');

mockTauriFailure('Network error');
await expect(addPhoto('/invalid/path.jpg')).rejects.toThrow('Network error');
```

### Test Environment

- No Tauri runtime or Rust required
- Uses `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom`

## Architecture & Tauri Integration

- [`src/lib/tauriApi.ts`](src/lib/tauriApi.ts): Type-safe wrappers for Tauri commands (photo, people, face detection, metadata)
- Automatic environment detection:
  ```typescript
  console.log("Running in Tauri:", !!window.__TAURI_IPC__);
  ```
- All API calls include error handling and user feedback

## Build Configuration

- Development: HMR, TypeScript, ESLint
- Production: Optimized bundle, tree shaking, asset optimization
- Tauri: Frontend included in native bundle

## Contributing

- Follow TypeScript best practices
- Write tests for new features
- Use Tauri API mocking for integration tests
- Update documentation for new features
- Ensure accessibility compliance

## Troubleshooting

- **Tests failing with Tauri errors**: Check test setup
- **TypeScript errors**: Ensure dependencies are installed
- **Build failures**: Node.js 18+ required
- **Mock issues**: Call `setupTauriMocks()` in test setup
- **API calls not tracked**: Use `getTauriCallHistory()` after operations
- **Async test failures**: Use proper `await` and `waitFor` timeouts

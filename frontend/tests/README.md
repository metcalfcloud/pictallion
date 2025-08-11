# Frontend Test Suite Guide

This directory contains integration, UI, and end-to-end tests for the Pictallion frontend. Tests cover Tauri API interactions, component behavior, and user workflows. All Tauri functionality is fully mocked—no Tauri runtime or Rust toolchain is required.

## Test Structure

- **Integration Tests** (`integration/`): Validate workflows such as uploads and Tauri API calls using Vitest and Testing Library.
- **UI Integration Tests** ([`App.test.tsx`](App.test.tsx:1)): Test app-level component integration.
- **Mocks** ([`mocks/tauriMocks.ts`](mocks/tauriMocks.ts:1)): Simulate Tauri IPC, track API calls, and configure error/performance scenarios.
- **Setup** ([`setup.ts`](setup.ts:1)): Initializes mocks and global configuration before each test.
- **End-to-End Tests** ([`../e2e/`](../e2e/example.spec.ts:1)): Use Playwright for browser-based workflows.
- **Puppeteer UI Tests** ([`puppeteer/ui.test.js`](puppeteer/ui.test.js:1)): Legacy UI automation with Puppeteer.

## Configuration

- Uses [`vitest`](../vitest.config.ts:1) with `jsdom` for DOM testing.
- Playwright configuration in [`../playwright.config.ts`](../playwright.config.ts:1).
- Puppeteer tests run via Node.js.
- Automatic setup via [`setup.ts`](setup.ts:1).
- No native or file system dependencies.

## Running Tests

Run all Vitest tests:

```bash
npm run test
```

Run specific Vitest tests:

```bash
npm run test -- tests/integration/
npm run test -- tests/integration/upload.test.tsx
npm run test -- tests/integration/tauriApi.test.ts
npm run test -- tests/App.test.tsx
```

Development options (Vitest):

```bash
npm run test -- --watch
npm run test -- --coverage
npm run test -- --reporter=verbose
```

Run Playwright end-to-end tests:

```bash
npm run test:e2e
```

Run Puppeteer UI tests:

```bash
npm run test:puppeteer
```

## Writing Tests

Use [`vitest`](https://vitest.dev/), [`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/), [`@testing-library/user-event`](https://testing-library.com/docs/user-event/intro/), [`playwright`](https://playwright.dev/), and [`puppeteer`](https://pptr.dev/).

Example (Vitest):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockTauriSuccess, mockTauriFailure, getTauriCallHistory, TauriMockManager } from '../mocks/tauriMocks';

describe('Upload', () => {
  let mockManager: TauriMockManager;
  beforeEach(() => {
    mockManager = TauriMockManager.getInstance();
    mockManager.reset();
  });

  it('should upload a photo', async () => {
    mockTauriSuccess();
    render(<Upload />);
    // ...test steps...
    expect(getTauriCallHistory()).toHaveLength(1);
  });
});
```

### Best Practices

- Reset mocks in `beforeEach`.
- Verify API calls with `getTauriCallHistory()`.
- Test both success and error scenarios.
- Use `waitFor` for async operations.
- Simulate user interactions with `userEvent`.

## Mocking Tauri

Basic usage:

```typescript
mockTauriSuccess();
mockTauriFailure("Error message");
mockTauriDelay(1000);
```

Advanced:

```typescript
const mockManager = TauriMockManager.getInstance();
mockManager.configure({
  shouldFail: false,
  delay: 500,
  customResponses: { add_photo: "Success" },
});
```

## Troubleshooting

- Ensure mocks are initialized in setup.
- Reset mock state before each test.
- Use `waitFor` for async assertions.
- Log call history for debugging:
  ```typescript
  console.log(getTauriCallHistory());
  ```

## Environment Requirements

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `jsdom`
- `playwright`
- `puppeteer`

No Tauri runtime, Rust, or native build required.

## Contributing

- Follow established patterns.
- Include both success and error cases.
- Test realistic user interactions.
- Keep tests deterministic and isolated.
- Update this documentation for new test categories.

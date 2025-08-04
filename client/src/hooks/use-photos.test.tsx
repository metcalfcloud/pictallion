// client/src/hooks/use-photos.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePhotos } from './use-photos';

vi.mock('../lib/api', () => {
  const mockPhotos = [{ id: '1', tier: 'gold' }];
  return {
    api: {
      getPhotos: vi.fn().mockResolvedValue(mockPhotos),
      // Provide no-op mocks for other api methods if needed
      uploadFiles: vi.fn(),
      processPhoto: vi.fn(),
      updatePhotoMetadata: vi.fn(),
      getStats: vi.fn(),
      getPhoto: vi.fn(),
      getPhotoVersions: vi.fn(),
      deletePhoto: vi.fn(),
      getPeople: vi.fn(),
      getEvents: vi.fn(),
      getCollections: vi.fn(),
    },
  };
});

const queryClient = new QueryClient();

function TestComponent({ tier }: { tier: string }) {
  const { data, isSuccess } = usePhotos(tier);
  return (
    <div>{isSuccess && <span data-testid="result">{JSON.stringify(data)}</span>}</div>
  );
}

describe('usePhotos', () => {
  it('fetches photos for a given tier', async () => {
    const expected = [{ id: '1', tier: 'gold' }];
    const { findByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <TestComponent tier="gold" />
      </QueryClientProvider>,
    );

    const result = await findByTestId('result');
    expect(result.textContent).toBe(JSON.stringify(expected));
  });
});

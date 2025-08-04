// client/src/components/error-boundary.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from './error-boundary';

const ThrowError: React.FC = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <span>Safe</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/test error/i)).toBeTruthy();
  });

  it('renders custom fallback if provided', () => {
    render(
      <ErrorBoundary fallback={<span>Custom fallback</span>}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeTruthy();
  });
});
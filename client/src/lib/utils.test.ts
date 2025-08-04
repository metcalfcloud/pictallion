// client/src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', undefined, 'b')).toBe('a b');
    expect(cn('a', false, 'b')).toBe('a b');
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils/cn';

describe('cn', () => {
  it('merges conditional classes', () => {
    expect(cn('rounded-md', null, 'bg-card')).toBe('rounded-md bg-card');
  });
});

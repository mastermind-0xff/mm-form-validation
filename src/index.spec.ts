import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('scaffold', () => {
  it('builds and tests', () => {
    expect(packageName).toBe('@mmutils/form-validation');
  });
});

import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { multiline } from './multiline.js';

describe('multiline', () => {
  for (const c of typeContract(multiline, [
    {},
    { max: 200, maxLines: 3 },
    { max: 30, maxLines: 1 },
    { min: 10, max: 1000 },
  ]))
    it(c.name, c.run);

  it('keeps line breaks, drops trailing spaces and blank lines around', () => {
    expect(
      multiline().check('\r\n  First line  \r\nSecond\t\rThird \n\n')
    ).toEqual({ state: 'valid', value: 'First line\nSecond\nThird' });
  });

  it('counts lines', () => {
    expect(multiline({ maxLines: 2 }).check('a\nb\nc')).toMatchObject({
      stage: 'lines',
      message: 'At most 2 lines (now 3).',
      incomplete: false,
    });
    expect(multiline({ maxLines: 1 }).check('a\nb')).toMatchObject({
      message: 'At most 1 line (now 2).',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { personName, place, samples, streetAddress, text } from './text.js';

describe('text', () => {
  for (const c of typeContract(text, [
    {},
    { max: 10 },
    { min: 3, max: 5 },
    { chars: 'digits', max: 6 },
    { chars: 'code', contains: 'digit', max: 20 },
    { chars: 'name', contains: 'letter', min: 2, max: 50 },
    { chars: /[^a-z]/u, max: 8 },
  ]))
    it(c.name, c.run);

  it('collapses whitespace, trims, composes (NFC)', () => {
    expect(text().check('  Ae \t Sweets\n Ltd. ')).toEqual({
      state: 'valid',
      value: 'Ae Sweets Ltd.',
    });
    expect(text().check('Cafe\u0301')).toEqual({
      state: 'valid',
      value: 'Café',
    });
  });

  it('refuses a long run of combining marks, and fast', () => {
    const start = performance.now();
    const result = text({ max: 1_000_000 }).check(
      `a${'\u0301\u0323'.repeat(51_000)}`
    );
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toMatchObject({
      stage: 'chars',
      message: 'The character U+0301 is not allowed.',
    });
    // three marks on a letter are nothing special
    expect(text().check('a\u0301\u0323\u0308').state).toBe('valid');
  });

  it.each([
    ['\u200B', 'U+200B'],
    ['\u200D', 'U+200D'],
    ['\uFE0F', 'U+FE0F'],
    ['\u0301', 'U+0301'],
    ['\u3164', 'U+3164'],
    ['\u2800', 'U+2800'],
    ['\uFFA0', 'U+FFA0'],
  ])('%j alone doesn’t fill a required field, and is named', (value, name) => {
    expect(text().check(value)).toMatchObject({
      stage: 'chars',
      message: `The character ${name} is not allowed.`,
    });
  });

  it('a set no filler fits gives no examples', () => {
    expect(text({ chars: /./u }).examples()).toEqual({
      valid: [],
      invalid: [],
    });
  });
});

describe('names and addresses from anywhere (plan §12 F3)', () => {
  it.each([
    '山田太郎',
    'ジョン・スミス',
    '约翰·史密斯',
    'Тихомир',
    '김민수',
    'Nguyễn',
  ])('personName: %s', (name) => {
    expect(personName().check(name).state).toBe('valid');
  });

  it.each(['東京都', '北京市（朝阳区）', 'Sofia 1000'])('place: %s', (name) => {
    expect(place().check(name).state).toBe('valid');
  });

  it.each([
    '〒100-0001 千代田区千代田１−１',
    '朝阳区，建国路８８号',
    'ул. Витоша 1, ап. 4',
  ])('streetAddress: %s', (address) => {
    expect(streetAddress().check(address).state).toBe('valid');
  });
});

describe('personName', () => {
  for (const c of typeContract(personName, [{}, { max: 10 }, { min: 2 }]))
    it(c.name, c.run);

  it('a Hangul filler alone isn’t a name', () => {
    expect(personName().check('\u3164')).toMatchObject({
      stage: 'chars',
      message: 'The character U+3164 is not allowed.',
    });
  });
});

describe('place', () => {
  for (const c of typeContract(place, [{}, { max: 20 }])) it(c.name, c.run);

  it('a Hangul filler alone isn’t a place', () => {
    expect(place().check('\u3164')).toMatchObject({ stage: 'chars' });
  });

  it('City "1" fails, real one-letter places pass', () => {
    expect(place().check('1')).toMatchObject({
      stage: 'contains',
      message: 'Use at least one letter.',
    });
    expect(place().check('Å').state).toBe('valid');
    expect(place().check('Y').state).toBe('valid');
  });
});

describe('streetAddress', () => {
  for (const c of typeContract(streetAddress, [{}, { min: 1, max: 40 }]))
    it(c.name, c.run);

  it('Address "1" fails', () => {
    expect(streetAddress().check('1')).toMatchObject({
      stage: 'length',
      message: 'At least 3 characters.',
      incomplete: true,
    });
    expect(streetAddress().check('221B Baker Street').state).toBe('valid');
  });

  it('needs a letter or a digit: punctuation alone is no address', () => {
    for (const junk of ['...', '---', '###', '(/)', '№№№', '´´´', '" " "'])
      expect(streetAddress().check(junk)).toMatchObject({
        stage: 'contains',
        message: 'Use at least one letter or digit.',
        incomplete: true,
      });
    for (const line of ['1-2-3', '2-14', 'ul. 3', 'Ул. Шипка'])
      expect(streetAddress().check(line).state).toBe('valid');
  });
});

describe('presets with other arguments keep their own examples true', () => {
  for (const c of typeContract(personName, [
    { chars: 'text' },
    { chars: 'place', contains: undefined },
  ]))
    it(c.name, c.run);
  for (const c of typeContract(place, [{ chars: 'text', contains: undefined }]))
    it(c.name, c.run);
  for (const c of typeContract(streetAddress, [
    { chars: 'text' },
    { contains: 'letter' },
    { contains: undefined },
  ]))
    it(c.name, c.run);

  it('keeps a sample of a later stage when the earlier ones let it through', () => {
    const examples = samples(
      ['ok'],
      [
        { value: 'reaches', stage: 'rule' },
        { value: '\u0007', stage: 'rule' },
        { value: 'x'.repeat(9), stage: 'pattern' },
      ]
    );
    expect(
      examples({ min: 1, max: 8, chars: 'text', contains: undefined }).invalid
    ).toEqual([{ value: 'reaches', stage: 'rule' }]);
  });

  it('a Japanese address line of numbers passes', () => {
    expect(streetAddress().check('1-2-3')).toEqual({
      state: 'valid',
      value: '1-2-3',
    });
    expect(streetAddress({ contains: 'letter' }).check('1-2-3')).toMatchObject({
      stage: 'contains',
    });
  });
});

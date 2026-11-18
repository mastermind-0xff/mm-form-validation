/**
 * The schemas of the example forms. The page script (page.js) and the server
 * (server.js) import this same module: one definition, two sides.
 */
import {
  checkbox,
  choice,
  confirm,
  defineForm,
  email,
  multiline,
  password,
  personName,
  place,
  select,
  streetAddress,
  text,
  vatNumber,
} from '../dist/esm/index.js';

/** The drop-down's options and the values the server accepts: one list. */
export const countries = [
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgium' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'CY', label: 'Cyprus' },
  { value: 'CZ', label: 'Czechia' },
  { value: 'DE', label: 'Germany' },
  { value: 'DK', label: 'Denmark' },
  { value: 'ES', label: 'Spain' },
  { value: 'FR', label: 'France' },
  { value: 'GR', label: 'Greece' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'PL', label: 'Poland' },
  { value: 'RO', label: 'Romania' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
];

/** A sign-in form. */
export const signIn = defineForm({
  email: email({ messages: { required: 'Enter your e-mail.' } }),
  // signing in checks only that a password was typed: the rules are for choosing one
  password: password({
    min: 1,
    max: 512,
    hint: '',
    messages: { required: 'Enter your password.' },
  }),
});

export const register = defineForm({
  email: email(),
  password: password(),
  passwordConfirm: confirm({
    of: 'password',
    messages: {
      required: 'Type the password again.',
      rule: 'The two passwords differ.',
    },
  }),
  newsletter: checkbox({ required: false }),
  consent: checkbox({
    messages: {
      required: 'Please accept the Terms of Use and the Privacy Policy.',
    },
  }),
});

const isCompany = (values) => values.isCompany === '1';

/** A billing form: company fields, a VAT number shaped by the country. */
export const billing = defineForm({
  isCompany: choice({
    options: ['0', '1'],
    messages: { required: 'Choose one.' },
  }),
  country: select({
    options: countries,
    messages: { required: 'Choose your country.' },
  }),
  firstName: personName(),
  lastName: personName(),
  companyName: text({ max: 200, when: isCompany }),
  entityNumber: text({ max: 50, required: false, when: isCompany }),
  vatNumber: vatNumber({
    required: false,
    when: isCompany,
    country: (values) => String(values.country ?? ''),
    // each side has its own: the page asks this server, the server asks VIES
    gates: ['vies'],
  }),
  city: place({ required: isCompany }),
  address1: streetAddress({ required: isCompany }),
  address2: streetAddress({ required: false, min: 1, contains: undefined }),
});

export const contact = defineForm({
  name: personName(),
  email: email(),
  topic: select({
    options: [
      { value: 'order', label: 'An order' },
      { value: 'wholesale', label: 'Wholesale' },
      { value: 'other', label: 'Something else' },
    ],
  }),
  orderNumber: text({
    max: 20,
    chars: 'code',
    required: false,
    when: (values) => values.topic === 'order',
    hint: 'On the confirmation e-mail, like AES-10293.',
  }),
  message: multiline({ min: 10, max: 1000, maxLines: 20 }),
});

export const forms = { signIn, register, billing, contact };

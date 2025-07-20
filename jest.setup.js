import '@testing-library/jest-dom';

// Mock crypto.randomUUID for Node.js environments
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  global.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          var r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    },
  };
}

// Mock fetch globally
global.fetch = jest.fn();

// Mock environment variables
process.env.SENDGRID_API_KEY = 'SG.test-api-key';
process.env.SENDGRID_FROM_EMAIL = 'test@alert24.io';

// Mock NextAuth and related modules
jest.mock('next-auth', () => ({
  default: jest.fn(),
}));

jest.mock('next-auth/providers/google', () => ({
  default: jest.fn(() => ({
    id: 'google',
    name: 'Google',
    type: 'oauth',
  })),
}));

jest.mock('@auth/core', () => ({
  Auth: jest.fn(),
  customFetch: jest.fn(),
}));

// Mock the auth configuration
jest.mock('@/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

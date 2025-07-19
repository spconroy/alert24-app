import { render } from '@testing-library/react';
import { OrganizationContext } from '@/contexts/OrganizationContext';

// Mock organization context for tests
export const mockOrganizationContext = {
  currentOrganization: {
    id: 'test-org-123',
    name: 'Test Organization',
    slug: 'test-org',
  },
  organizations: [
    {
      id: 'test-org-123',
      name: 'Test Organization',
      slug: 'test-org',
    },
  ],
  setCurrentOrganization: jest.fn(),
  loading: false,
  error: null,
};

// Custom render function that includes providers
export const renderWithProviders = (ui, options = {}) => {
  const {
    organizationContext = mockOrganizationContext,
    ...renderOptions
  } = options;

  const Wrapper = ({ children }) => {
    return (
      <OrganizationContext.Provider value={organizationContext}>
        {children}
      </OrganizationContext.Provider>
    );
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock fetch responses for common API calls
export const mockApiResponses = {
  preferences: {
    success: {
      ok: true,
      json: async () => ({
        id: 'pref-123',
        user_id: 'user-123',
        email_invitations: true,
        email_incidents: true,
        email_monitoring: false,
        email_updates: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }),
    },
    error: {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    },
  },

  notifications: {
    success: {
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'notif-1',
            to_email: 'user1@example.com',
            subject: 'Test Notification',
            email_type: 'incident',
            priority: 'high',
            status: 'sent',
            attempts: 1,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      }),
    },
    error: {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    },
  },

  stats: {
    success: {
      ok: true,
      json: async () => ({
        total: 100,
        sent: 95,
        failed: 3,
        pending: 2,
        deliveryRate: 96.9,
        byType: {
          incident: { total: 50, sent: 48, failed: 2, pending: 0 },
          monitoring: { total: 30, sent: 29, failed: 1, pending: 0 },
          invitation: { total: 20, sent: 18, failed: 0, pending: 2 },
        },
        byPriority: {
          critical: { total: 20, sent: 19, failed: 1, pending: 0 },
          high: { total: 30, sent: 29, failed: 1, pending: 0 },
          normal: { total: 40, sent: 38, failed: 1, pending: 1 },
          low: { total: 10, sent: 9, failed: 0, pending: 1 },
        },
        retryStats: {
          singleAttempt: 85,
          multipleAttempts: 15,
          maxAttempts: 3,
          avgAttempts: 1.2,
        },
        timeRange: '24h',
        organizationId: 'test-org-123',
        generatedAt: '2024-01-01T12:00:00Z',
      }),
    },
    error: {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    },
  },
};

// Helper to create mock FormData
export const createMockFormData = (data) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value);
    }
  });
  return formData;
};

// Helper to create mock Request objects
export const createMockRequest = (options = {}) => {
  const {
    url = 'http://localhost/api/test',
    method = 'GET',
    body = null,
    json = null,
    formData = null,
  } = options;

  const request = {
    url,
    method,
  };

  if (json) {
    request.json = jest.fn().mockResolvedValue(json);
  }

  if (formData) {
    request.formData = jest.fn().mockResolvedValue(formData);
  }

  if (body) {
    request.body = body;
  }

  return request;
};

// Helper to create mock Supabase responses
export const createMockSupabaseResponse = (data, error = null) => {
  return {
    data,
    error,
  };
};

// Mock Supabase query builder
export const createMockSupabaseQuery = (response) => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };

  // For methods that return promises
  mockQuery.then = jest.fn().mockResolvedValue(response);

  return mockQuery;
};

// Helper to wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock console methods for cleaner test output
export const mockConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });
};

// Mock window methods
export const mockWindow = () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost',
        origin: 'http://localhost',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
    });

    window.close = jest.fn();
  });
};

// Assertion helpers
export const expectFetchToBeCalled = (url, options = {}) => {
  expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining(options));
};

export const expectSupabaseQuery = (mockSupabase, table, operation, params = {}) => {
  expect(mockSupabase.from).toHaveBeenCalledWith(table);
  
  if (operation === 'select') {
    expect(mockSupabase.from().select).toHaveBeenCalled();
  } else if (operation === 'insert') {
    expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining(params));
  } else if (operation === 'update') {
    expect(mockSupabase.from().update).toHaveBeenCalledWith(expect.objectContaining(params));
  } else if (operation === 'upsert') {
    expect(mockSupabase.from().upsert).toHaveBeenCalledWith(expect.objectContaining(params));
  }
};

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

export const createTestOrganization = (overrides = {}) => ({
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  ...overrides,
});

export const createTestNotification = (overrides = {}) => ({
  id: 'notif-123',
  to_email: 'user@example.com',
  subject: 'Test Notification',
  email_type: 'incident',
  priority: 'normal',
  status: 'sent',
  attempts: 1,
  message_id: 'msg-123',
  error: null,
  created_at: '2024-01-01T00:00:00Z',
  sent_at: '2024-01-01T00:01:00Z',
  last_attempt_at: '2024-01-01T00:01:00Z',
  ...overrides,
});

export const createTestPreferences = (overrides = {}) => ({
  id: 'pref-123',
  user_id: 'user-123',
  email_invitations: true,
  email_incidents: true,
  email_monitoring: true,
  email_updates: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
import { GET, PUT } from '@/app/api/notifications/preferences/route';
import { auth } from '@/auth';
import { supabase } from '@/lib/db-supabase';

// Mock dependencies
jest.mock('@/auth');
jest.mock('@/lib/db-supabase');

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, options) => ({
      json: data,
      status: options?.status || 200,
    }),
  },
}));

describe('/api/notifications/preferences', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockPreferences = {
    id: 'pref-123',
    user_id: 'user-123',
    email_invitations: true,
    email_incidents: true,
    email_monitoring: false,
    email_updates: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return existing user preferences', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPreferences,
              error: null,
            }),
          }),
        }),
      });

      const response = await GET();

      expect(response.json).toEqual(mockPreferences);
      expect(response.status).toBe(200);
      expect(supabase.from).toHaveBeenCalledWith('notification_preferences');
    });

    it('should create default preferences when none exist', async () => {
      const defaultPreferences = {
        id: 'pref-new',
        user_id: 'user-123',
        email_invitations: true,
        email_incidents: true,
        email_monitoring: true,
        email_updates: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Mock no existing preferences
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      // Mock successful creation
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: defaultPreferences,
              error: null,
            }),
          }),
        }),
      });

      const response = await GET();

      expect(response.json).toEqual(defaultPreferences);
      expect(response.status).toBe(200);
    });

    it('should return 401 when user is not authenticated', async () => {
      auth.mockResolvedValue(null);

      const response = await GET();

      expect(response.json.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 500 when failing to create default preferences', async () => {
      // Mock no existing preferences
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      // Mock failed creation
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Insert failed'),
            }),
          }),
        }),
      });

      const response = await GET();

      expect(response.json.error).toBe('Failed to create preferences');
      expect(response.status).toBe(500);
    });

    it('should handle database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const response = await GET();

      expect(response.json.error).toBe('Internal server error');
      expect(response.status).toBe(500);
    });
  });

  describe('PUT', () => {
    const validPreferences = {
      email_invitations: false,
      email_incidents: true,
      email_monitoring: true,
      email_updates: false,
    };

    it('should update user preferences successfully', async () => {
      const updatedPreferences = {
        ...mockPreferences,
        ...validPreferences,
        updated_at: '2024-01-02T00:00:00Z',
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(validPreferences),
      };

      supabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedPreferences,
              error: null,
            }),
          }),
        }),
      });

      const response = await PUT(mockRequest);

      expect(response.json.success).toBe(true);
      expect(response.json.preferences).toEqual(updatedPreferences);
      expect(response.status).toBe(200);

      expect(supabase.from).toHaveBeenCalledWith('notification_preferences');
    });

    it('should return 401 when user is not authenticated', async () => {
      auth.mockResolvedValue(null);

      const mockRequest = {
        json: jest.fn().mockResolvedValue(validPreferences),
      };

      const response = await PUT(mockRequest);

      expect(response.json.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 400 when preference values are invalid', async () => {
      const invalidPreferences = {
        email_invitations: 'invalid', // Should be boolean
        email_incidents: true,
        email_monitoring: true,
        email_updates: false,
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(invalidPreferences),
      };

      const response = await PUT(mockRequest);

      expect(response.json.error).toBe('Invalid preference values');
      expect(response.status).toBe(400);
    });

    it('should return 400 when required fields are missing', async () => {
      const incompletePreferences = {
        email_invitations: true,
        // Missing other required fields
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(incompletePreferences),
      };

      const response = await PUT(mockRequest);

      expect(response.json.error).toBe('Invalid preference values');
      expect(response.status).toBe(400);
    });

    it('should return 500 when database update fails', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue(validPreferences),
      };

      supabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Update failed'),
            }),
          }),
        }),
      });

      const response = await PUT(mockRequest);

      expect(response.json.error).toBe('Failed to update preferences');
      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON gracefully', async () => {
      const mockRequest = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      const response = await PUT(mockRequest);

      expect(response.json.error).toBe('Internal server error');
      expect(response.status).toBe(500);
    });

    it('should validate all boolean fields are present and valid', async () => {
      const testCases = [
        { email_invitations: null },
        { email_incidents: undefined },
        { email_monitoring: 'yes' },
        { email_updates: 1 },
      ];

      for (const testCase of testCases) {
        const mockRequest = {
          json: jest.fn().mockResolvedValue({
            email_invitations: true,
            email_incidents: true,
            email_monitoring: true,
            email_updates: true,
            ...testCase,
          }),
        };

        const response = await PUT(mockRequest);

        expect(response.json.error).toBe('Invalid preference values');
        expect(response.status).toBe(400);
      }
    });

    it('should include updated_at timestamp in upsert', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue(validPreferences),
      };

      const mockUpsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockPreferences,
            error: null,
          }),
        }),
      });

      supabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await PUT(mockRequest);

      expect(mockUpsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        ...validPreferences,
        updated_at: expect.any(String),
      });
    });
  });
});
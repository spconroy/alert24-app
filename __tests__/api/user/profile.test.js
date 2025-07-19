import { createMocks } from 'node-mocks-http';
import { GET, PUT } from '@/app/api/user/profile/route';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

// Mock the dependencies
jest.mock('@/lib/session-manager');
jest.mock('@/lib/db-supabase');

describe('/api/user/profile', () => {
  let mockSessionManager;
  let mockSupabaseClient;
  let mockDbInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SessionManager
    mockSessionManager = {
      getSessionFromRequest: jest.fn(),
    };
    SessionManager.mockImplementation(() => mockSessionManager);

    // Mock SupabaseClient instance
    mockDbInstance = {
      getUserByEmail: jest.fn(),
      client: {
        from: jest.fn(() => ({
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(),
              })),
            })),
          })),
        })),
      },
    };

    // Mock SupabaseClient constructor
    mockSupabaseClient = jest.fn(() => mockDbInstance);
    SupabaseClient.mockImplementation(mockSupabaseClient);
  });

  describe('GET /api/user/profile', () => {
    it('should return user profile data for authenticated user', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=valid-session-token',
        },
      });

      const mockSession = {
        user: {
          email: 'test@example.com',
        },
      };

      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        phone_number: '+1234567890',
        timezone: 'America/New_York',
        notification_preferences: {
          email_incidents: true,
          email_escalations: true,
          sms_critical: false,
          sms_escalations: false,
        },
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockUser);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        user: mockUser,
      });

      expect(mockSessionManager.getSessionFromRequest).toHaveBeenCalledWith(req);
      expect(mockDbInstance.getUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { req } = createMocks({
        method: 'GET',
      });

      mockSessionManager.getSessionFromRequest.mockResolvedValue(null);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 401 for session without email', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=invalid-session-token',
        },
      });

      const mockSession = {
        user: {}, // No email
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 404 when user is not found in database', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=valid-session-token',
        },
      });

      const mockSession = {
        user: {
          email: 'nonexistent@example.com',
        },
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(null);

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        error: 'User not found',
      });
    });

    it('should handle database errors gracefully', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=valid-session-token',
        },
      });

      const mockSession = {
        user: {
          email: 'test@example.com',
        },
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to fetch user profile',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching user profile:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('PUT /api/user/profile', () => {
    const mockUpdateData = {
      name: 'Updated Name',
      email: 'updated@example.com',
      phone: '+1987654321',
      timezone: 'America/Los_Angeles',
      notification_preferences: {
        email_incidents: false,
        email_escalations: true,
        sms_critical: true,
        sms_escalations: false,
      },
    };

    it('should update user profile successfully', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: mockUpdateData,
      });

      const mockSession = {
        user: {
          email: 'test@example.com',
        },
      };

      const mockCurrentUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      const mockUpdatedUser = {
        ...mockCurrentUser,
        ...mockUpdateData,
        phone_number: mockUpdateData.phone,
        updated_at: expect.any(String),
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      // Mock the database update chain
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockUpdatedUser,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        user: mockUpdatedUser,
        message: 'Profile updated successfully',
      });

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          email: 'updated@example.com',
          phone_number: '+1987654321',
          timezone: 'America/Los_Angeles',
          notification_preferences: mockUpdateData.notification_preferences,
          updated_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should handle phone number field variations', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: {
          phoneNumber: '+1987654321', // Using phoneNumber instead of phone
        },
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockCurrentUser, phone_number: '+1987654321' },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const response = await PUT(req);
      
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: '+1987654321',
        })
      );
    });

    it('should handle notification preferences field variations', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: {
          notificationPreferences: { email_incidents: false }, // Using camelCase
        },
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockCurrentUser, notification_preferences: { email_incidents: false } },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const response = await PUT(req);
      
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_preferences: { email_incidents: false },
        })
      );
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: mockUpdateData,
      });

      mockSessionManager.getSessionFromRequest.mockResolvedValue(null);

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 404 when user is not found', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: mockUpdateData,
      });

      const mockSession = {
        user: {
          email: 'nonexistent@example.com',
        },
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(null);

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        error: 'User not found',
      });
    });

    it('should handle database update errors', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: mockUpdateData,
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database update failed' },
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to update user profile',
      });

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON in request body', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: 'invalid-json',
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to update user profile',
      });

      consoleSpy.mockRestore();
    });

    it('should only update provided fields', async () => {
      const partialUpdate = {
        name: 'Only Name Updated',
      };

      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: partialUpdate,
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockCurrentUser, name: 'Only Name Updated' },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const response = await PUT(req);
      
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Only Name Updated',
        updated_at: expect.any(String),
      });
    });

    it('should handle empty request body', async () => {
      const { req } = createMocks({
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=valid-session-token',
        },
        body: {},
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      const mockCurrentUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      mockDbInstance.getUserByEmail.mockResolvedValue(mockCurrentUser);

      const mockSingle = jest.fn().mockResolvedValue({
        data: mockCurrentUser,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
      
      mockDbInstance.client.from = mockFrom;

      const response = await PUT(req);
      
      expect(response.status).toBe(200);
      // Should only update the timestamp
      expect(mockUpdate).toHaveBeenCalledWith({
        updated_at: expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle session manager errors', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=invalid-token',
        },
      });

      mockSessionManager.getSessionFromRequest.mockRejectedValue(
        new Error('Session validation failed')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to fetch user profile',
      });

      consoleSpy.mockRestore();
    });

    it('should handle Supabase client initialization errors', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'session=valid-session-token',
        },
      });

      const mockSession = {
        user: { email: 'test@example.com' },
      };

      mockSessionManager.getSessionFromRequest.mockResolvedValue(mockSession);
      SupabaseClient.mockImplementation(() => {
        throw new Error('Supabase initialization failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to fetch user profile',
      });

      consoleSpy.mockRestore();
    });
  });
});
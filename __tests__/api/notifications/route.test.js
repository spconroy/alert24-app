import { GET, POST } from '@/app/api/notifications/route';
import { auth } from '@/auth';
import { supabase } from '@/lib/db-supabase';

// Mock dependencies
jest.mock('@/auth');
jest.mock('@/lib/db-supabase');
jest.mock('@/lib/email-service', () => ({
  emailService: {
    sendBulkNotifications: jest.fn(),
  },
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, options) => ({
      json: data,
      status: options?.status || 200,
    }),
  },
}));

describe('/api/notifications', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockMembership = {
    role: 'admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        to_email: 'user1@example.com',
        subject: 'Test Notification 1',
        email_type: 'incident',
        priority: 'high',
        status: 'sent',
        attempts: 1,
        message_id: 'msg-1',
        error: null,
        created_at: '2024-01-01T00:00:00Z',
        sent_at: '2024-01-01T00:01:00Z',
        last_attempt_at: '2024-01-01T00:01:00Z',
      },
      {
        id: 'notif-2',
        to_email: 'user2@example.com',
        subject: 'Test Notification 2',
        email_type: 'monitoring',
        priority: 'critical',
        status: 'failed',
        attempts: 3,
        message_id: null,
        error: 'Connection timeout',
        created_at: '2024-01-01T01:00:00Z',
        sent_at: null,
        last_attempt_at: '2024-01-01T01:05:00Z',
      },
    ];

    it('should return notifications for organization', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications?organizationId=org-123&limit=10&offset=0',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      // Mock notifications query
      const mockNotificationsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockNotifications,
                error: null,
              }),
            }),
          }),
        }),
      };

      // Mock count query
      const mockCountQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 25,
          }),
        }),
      };

      supabase.from
        .mockReturnValueOnce(mockNotificationsQuery.select().eq().order().range())
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce(mockNotificationsQuery)
        .mockReturnValueOnce(mockCountQuery);

      const response = await GET(mockRequest);

      expect(response.json.notifications).toEqual(mockNotifications);
      expect(response.json.pagination).toEqual({
        total: 25,
        limit: 10,
        offset: 0,
        hasMore: true,
      });
      expect(response.status).toBe(200);
    });

    it('should return 401 when user is not authenticated', async () => {
      auth.mockResolvedValue(null);

      const mockRequest = {
        url: 'http://localhost/api/notifications?organizationId=org-123',
      };

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 400 when organizationId is missing', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications',
      };

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Organization ID required');
      expect(response.status).toBe(400);
    });

    it('should return 403 when user is not member of organization', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications?organizationId=org-123',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Access denied');
      expect(response.status).toBe(403);
    });

    it('should filter notifications by type', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications?organizationId=org-123&type=incident',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      const mockNotificationsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: mockNotifications.filter(n => n.email_type === 'incident'),
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce(mockNotificationsQuery);

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      // Verify that the eq method was called with 'email_type' and 'incident'
      expect(mockNotificationsQuery.select().eq().order().range().eq).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications?organizationId=org-123',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      const mockNotificationsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            }),
          }),
        }),
      };

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce(mockNotificationsQuery);

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Failed to fetch notifications');
      expect(response.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('should send bulk notifications successfully', async () => {
      const notifications = [
        {
          to: 'user1@example.com',
          subject: 'Test 1',
          htmlContent: '<h1>Test 1</h1>',
          textContent: 'Test 1',
          emailType: 'incident',
          priority: 'high',
        },
        {
          to: 'user2@example.com',
          subject: 'Test 2',
          htmlContent: '<h1>Test 2</h1>',
          textContent: 'Test 2',
          emailType: 'monitoring',
          priority: 'critical',
        },
      ];

      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          organizationId: 'org-123',
          notifications,
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      // Mock email service response
      const { emailService } = require('@/lib/email-service');
      emailService.sendBulkNotifications.mockResolvedValue({
        processed: 2,
        failed: 0,
        totalQueued: 2,
        queueIds: ['queue-1', 'queue-2'],
      });

      const response = await POST(mockRequest);

      expect(response.json.success).toBe(true);
      expect(response.json.processed).toBe(2);
      expect(response.json.failed).toBe(0);
      expect(response.json.totalQueued).toBe(2);
      expect(response.json.queueIds).toEqual(['queue-1', 'queue-2']);
      expect(response.status).toBe(200);

      expect(emailService.sendBulkNotifications).toHaveBeenCalledWith(
        notifications.map(n => ({ ...n, organizationId: 'org-123' }))
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      auth.mockResolvedValue(null);

      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          organizationId: 'org-123',
          notifications: [],
        }),
      };

      const response = await POST(mockRequest);

      expect(response.json.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 400 when request data is invalid', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          organizationId: 'org-123',
          // Missing notifications array
        }),
      };

      const response = await POST(mockRequest);

      expect(response.json.error).toBe('Invalid request data');
      expect(response.status).toBe(400);
    });

    it('should return 403 when user lacks permission', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          organizationId: 'org-123',
          notifications: [
            {
              to: 'test@example.com',
              subject: 'Test',
              htmlContent: '<h1>Test</h1>',
              textContent: 'Test',
            },
          ],
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'viewer' }, // Insufficient role
              error: null,
            }),
          }),
        }),
      });

      const response = await POST(mockRequest);

      expect(response.json.error).toBe('Access denied');
      expect(response.status).toBe(403);
    });

    it('should handle email service errors', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          organizationId: 'org-123',
          notifications: [
            {
              to: 'test@example.com',
              subject: 'Test',
              htmlContent: '<h1>Test</h1>',
              textContent: 'Test',
            },
          ],
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      const { emailService } = require('@/lib/email-service');
      emailService.sendBulkNotifications.mockRejectedValue(new Error('Email service error'));

      const response = await POST(mockRequest);

      expect(response.json.error).toBe('Internal server error');
      expect(response.status).toBe(500);
    });
  });
});
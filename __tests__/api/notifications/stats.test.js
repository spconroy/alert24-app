import { GET } from '@/app/api/notifications/stats/route';
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

describe('/api/notifications/stats', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockMembership = {
    role: 'admin',
  };

  const mockNotifications = [
    {
      status: 'sent',
      email_type: 'incident',
      priority: 'critical',
      attempts: 1,
    },
    {
      status: 'sent',
      email_type: 'monitoring',
      priority: 'high',
      attempts: 2,
    },
    {
      status: 'failed',
      email_type: 'incident',
      priority: 'medium',
      attempts: 3,
    },
    {
      status: 'pending',
      email_type: 'invitation',
      priority: 'normal',
      attempts: 0,
    },
    {
      status: 'sent',
      email_type: 'monitoring',
      priority: 'critical',
      attempts: 1,
    },
  ];

  const mockHourlyData = [
    { created_at: '2024-01-01T10:00:00Z', status: 'sent' },
    { created_at: '2024-01-01T10:30:00Z', status: 'sent' },
    { created_at: '2024-01-01T11:00:00Z', status: 'failed' },
    { created_at: '2024-01-01T11:15:00Z', status: 'sent' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('should return comprehensive notification statistics', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123&timeRange=24h',
      };

      // Mock membership check
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      // Mock overall stats query
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: mockNotifications,
              error: null,
            }),
          }),
        }),
      });

      // Mock hourly data query
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockHourlyData,
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      
      const stats = response.json;
      expect(stats).toEqual({
        total: 5,
        sent: 3,
        failed: 1,
        pending: 1,
        deliveryRate: 75, // 3 sent out of 4 delivery attempts (3 sent + 1 failed)
        
        byType: {
          incident: { total: 2, sent: 1, failed: 1, pending: 0 },
          monitoring: { total: 2, sent: 2, failed: 0, pending: 0 },
          invitation: { total: 1, sent: 0, failed: 0, pending: 1 },
        },
        
        byPriority: {
          critical: { total: 2, sent: 2, failed: 0, pending: 0 },
          high: { total: 1, sent: 1, failed: 0, pending: 0 },
          medium: { total: 1, sent: 0, failed: 1, pending: 0 },
          normal: { total: 1, sent: 0, failed: 0, pending: 1 },
        },
        
        byStatus: {
          sent: 3,
          failed: 1,
          pending: 1,
        },
        
        retryStats: {
          singleAttempt: 2, // 1 attempt
          multipleAttempts: 2, // 2 or 3 attempts
          maxAttempts: 3,
          avgAttempts: 1.4, // (1+2+3+0+1)/5
        },
        
        hourlyBreakdown: {
          '2024-01-01T10': { total: 2, sent: 2, failed: 0, pending: 0 },
          '2024-01-01T11': { total: 2, sent: 1, failed: 1, pending: 0 },
        },
        
        timeRange: '24h',
        organizationId: 'org-123',
        generatedAt: expect.any(String),
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      auth.mockResolvedValue(null);

      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
      };

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 400 when organizationId is missing', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats',
      };

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Organization ID required');
      expect(response.status).toBe(400);
    });

    it('should return 403 when user is not member of organization', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
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

    it('should handle different time ranges correctly', async () => {
      const timeRanges = ['1h', '7d', '30d'];
      
      for (const timeRange of timeRanges) {
        const mockRequest = {
          url: `http://localhost/api/notifications/stats?organizationId=org-123&timeRange=${timeRange}`,
        };

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        });

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        });

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        });

        const response = await GET(mockRequest);

        expect(response.status).toBe(200);
        expect(response.json.timeRange).toBe(timeRange);
        
        jest.clearAllMocks();
      }
    });

    it('should use default timeRange when not specified', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.json.timeRange).toBe('24h');
    });

    it('should handle database errors gracefully', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.json.error).toBe('Failed to fetch stats');
      expect(response.status).toBe(500);
    });

    it('should calculate delivery rate correctly with edge cases', async () => {
      const testCases = [
        {
          notifications: [],
          expectedRate: 0,
        },
        {
          notifications: [
            { status: 'pending', email_type: 'test', priority: 'normal', attempts: 0 },
          ],
          expectedRate: 0, // No delivery attempts yet
        },
        {
          notifications: [
            { status: 'sent', email_type: 'test', priority: 'normal', attempts: 1 },
            { status: 'sent', email_type: 'test', priority: 'normal', attempts: 1 },
          ],
          expectedRate: 100, // All sent
        },
        {
          notifications: [
            { status: 'failed', email_type: 'test', priority: 'normal', attempts: 3 },
          ],
          expectedRate: 0, // All failed
        },
      ];

      for (const testCase of testCases) {
        const mockRequest = {
          url: 'http://localhost/api/notifications/stats?organizationId=org-123',
        };

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        });

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: testCase.notifications,
                error: null,
              }),
            }),
          }),
        });

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        });

        const response = await GET(mockRequest);

        expect(response.status).toBe(200);
        expect(response.json.deliveryRate).toBe(testCase.expectedRate);
        
        jest.clearAllMocks();
      }
    });

    it('should handle hourly breakdown errors gracefully', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: mockNotifications,
              error: null,
            }),
          }),
        }),
      });

      // Mock hourly data query to fail
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Hourly query failed'),
              }),
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.json.hourlyBreakdown).toBeUndefined();
      // Should still return main stats despite hourly breakdown failure
      expect(response.json.total).toBe(5);
    });

    it('should properly group notifications by type and priority', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/stats?organizationId=org-123',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [
                { status: 'sent', email_type: 'incident', priority: 'critical', attempts: 1 },
                { status: 'failed', email_type: 'incident', priority: 'critical', attempts: 3 },
                { status: 'sent', email_type: null, priority: null, attempts: 1 }, // Test null handling
              ],
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      
      const stats = response.json;
      expect(stats.byType).toEqual({
        incident: { total: 2, sent: 1, failed: 1, pending: 0 },
        unknown: { total: 1, sent: 1, failed: 0, pending: 0 },
      });
      
      expect(stats.byPriority).toEqual({
        critical: { total: 2, sent: 1, failed: 1, pending: 0 },
        normal: { total: 1, sent: 1, failed: 0, pending: 0 },
      });
    });
  });
});
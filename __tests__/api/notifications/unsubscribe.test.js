import { GET, POST } from '@/app/api/notifications/unsubscribe/route';
import { supabase } from '@/lib/db-supabase';

// Mock dependencies
jest.mock('@/lib/db-supabase');

describe('/api/notifications/unsubscribe', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
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
  });

  describe('GET', () => {
    it('should return unsubscribe form when valid token and email provided', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token&email=test@example.com',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPreferences,
              error: null,
            }),
          }),
        }),
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      
      // Convert Response to text to check content
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Email Notification Preferences');
      expect(htmlContent).toContain('test@example.com');
      expect(htmlContent).toContain('checked'); // Should have checked checkboxes based on preferences
    });

    it('should return error when token or email is missing', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token',
        // Missing email parameter
      };

      const response = await GET(mockRequest);

      expect(response.status).toBe(400);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Invalid Unsubscribe Link');
    });

    it('should return error when email is not found', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token&email=notfound@example.com',
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

      expect(response.status).toBe(404);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Email Not Found');
      expect(htmlContent).toContain('notfound@example.com');
    });

    it('should create default preferences when none exist', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token&email=test@example.com',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      // No existing preferences
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

      // Mock successful creation of default preferences
      const defaultPreferences = {
        ...mockPreferences,
        email_monitoring: true, // Default should be true
      };

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

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Email Notification Preferences');
    });

    it('should handle database errors when creating preferences', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token&email=test@example.com',
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

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

      const response = await GET(mockRequest);

      expect(response.status).toBe(500);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Error');
    });

    it('should handle unexpected errors gracefully', async () => {
      const mockRequest = {
        url: 'http://localhost/api/notifications/unsubscribe?token=valid-token&email=test@example.com',
      };

      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(500);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Error');
    });
  });

  describe('POST', () => {
    it('should update preferences successfully', async () => {
      const formData = new FormData();
      formData.append('token', 'valid-token');
      formData.append('email', 'test@example.com');
      formData.append('email_invitations', 'on');
      formData.append('email_incidents', 'on');
      // email_monitoring and email_updates not included (should be false)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(formData),
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockPreferences,
            error: null,
          }),
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Preferences Updated');
      expect(htmlContent).toContain('✅');

      // Verify upsert was called with correct preferences
      expect(supabase.from().upsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        email_invitations: true,
        email_incidents: true,
        email_monitoring: false,
        email_updates: false,
        updated_at: expect.any(String),
      });
    });

    it('should return error when token or email is missing', async () => {
      const formData = new FormData();
      formData.append('token', 'valid-token');
      // Missing email

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(formData),
      };

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Invalid Request');
    });

    it('should return error when user is not found', async () => {
      const formData = new FormData();
      formData.append('token', 'valid-token');
      formData.append('email', 'notfound@example.com');

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(formData),
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

      const response = await POST(mockRequest);

      expect(response.status).toBe(404);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Email Not Found');
    });

    it('should handle database update errors', async () => {
      const formData = new FormData();
      formData.append('token', 'valid-token');
      formData.append('email', 'test@example.com');
      formData.append('email_invitations', 'on');

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(formData),
      };

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Update failed'),
          }),
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Error');
    });

    it('should correctly interpret form checkbox values', async () => {
      // Test all combinations of checkbox states
      const testCases = [
        {
          formFields: ['email_invitations'],
          expected: { email_invitations: true, email_incidents: false, email_monitoring: false, email_updates: false }
        },
        {
          formFields: ['email_invitations', 'email_monitoring'],
          expected: { email_invitations: true, email_incidents: false, email_monitoring: true, email_updates: false }
        },
        {
          formFields: [],
          expected: { email_invitations: false, email_incidents: false, email_monitoring: false, email_updates: false }
        },
      ];

      for (const testCase of testCases) {
        const formData = new FormData();
        formData.append('token', 'valid-token');
        formData.append('email', 'test@example.com');
        
        testCase.formFields.forEach(field => {
          formData.append(field, 'on');
        });

        const mockRequest = {
          formData: jest.fn().mockResolvedValue(formData),
        };

        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null,
              }),
            }),
          }),
        });

        const mockUpsert = jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockPreferences,
            error: null,
          }),
        });

        supabase.from.mockReturnValueOnce({
          upsert: mockUpsert,
        });

        await POST(mockRequest);

        expect(mockUpsert).toHaveBeenCalledWith({
          user_id: 'user-123',
          ...testCase.expected,
          updated_at: expect.any(String),
        });

        jest.clearAllMocks();
      }
    });

    it('should handle malformed form data gracefully', async () => {
      const mockRequest = {
        formData: jest.fn().mockRejectedValue(new Error('Invalid form data')),
      };

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const htmlContent = await response.text();
      expect(htmlContent).toContain('Error');
    });
  });
});
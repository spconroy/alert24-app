import { EmailService } from '@/lib/email-service';

// Mock fetch
global.fetch = jest.fn();

describe('EmailService', () => {
  let emailService;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SENDGRID_API_KEY = 'SG.test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@alert24.io';
    
    // Create new instance for each test
    emailService = new EmailService();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  describe('Constructor', () => {
    it('should initialize with valid API key', () => {
      expect(emailService.isEnabled()).toBe(true);
      expect(emailService.apiKey).toBe('SG.test-api-key');
      expect(emailService.fromEmail).toBe('test@alert24.io');
    });

    it('should disable service when API key is missing', () => {
      delete process.env.SENDGRID_API_KEY;
      const disabledService = new EmailService();
      
      expect(disabledService.isEnabled()).toBe(false);
    });

    it('should use default email when SENDGRID_FROM_EMAIL is not set', () => {
      delete process.env.SENDGRID_FROM_EMAIL;
      const defaultEmailService = new EmailService();
      
      expect(defaultEmailService.fromEmail).toBe('noreply@alert24.io');
    });
  });

  describe('checkSendGridStatus', () => {
    it('should return valid status when API key is valid', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          type: 'free',
          reputation: 95,
        }),
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.checkSendGridStatus();
      
      expect(result.valid).toBe(true);
      expect(result.account.type).toBe('free');
      expect(result.account.reputation).toBe(95);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/account',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer SG.test-api-key',
          }),
        })
      );
    });

    it('should return invalid status when API returns error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.checkSendGridStatus();
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SendGrid API error: 401 - Unauthorized');
      expect(result.status).toBe(401);
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      const result = await emailService.checkSendGridStatus();
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should return error when service is disabled', async () => {
      delete process.env.SENDGRID_API_KEY;
      const disabledService = new EmailService();
      
      const result = await disabledService.checkSendGridStatus();
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email service not configured');
    });
  });

  describe('sendEmail', () => {
    const testEmailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      htmlContent: '<h1>Test</h1>',
      textContent: 'Test',
      organizationId: 'org-123',
      emailType: 'test',
      priority: 'normal',
    };

    it('should send email successfully', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('test-message-id'),
        },
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendEmail(testEmailData);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.attempts).toBe(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer SG.test-api-key',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"to":[{"email":"test@example.com"}]'),
        })
      );
    });

    it('should return error when service is disabled', async () => {
      delete process.env.SENDGRID_API_KEY;
      const disabledService = new EmailService();
      
      const result = await disabledService.sendEmail(testEmailData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service not configured');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should retry failed requests with exponential backoff', async () => {
      // Mock fetch to fail twice then succeed
      const mockFailedResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      
      const mockSuccessResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('test-message-id-retry'),
        },
      };
      
      fetch
        .mockResolvedValueOnce(mockFailedResponse)
        .mockResolvedValueOnce(mockFailedResponse)
        .mockResolvedValueOnce(mockSuccessResponse);
      
      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123;
      });
      
      const result = await emailService.sendEmail(testEmailData);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(fetch).toHaveBeenCalledTimes(3);
      
      // Cleanup
      global.setTimeout.mockRestore();
    });

    it('should not retry on authorization errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendEmail(testEmailData);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.error).toContain('SendGrid API key is invalid or expired');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      // Mock setTimeout to avoid actual delays
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123;
      });
      
      const result = await emailService.sendEmail(testEmailData);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // maxRetries
      expect(result.error).toContain('Failed to send email after 3 attempts');
      expect(fetch).toHaveBeenCalledTimes(3);
      
      // Cleanup
      global.setTimeout.mockRestore();
    });

    it('should include tracking settings in payload', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('test-message-id'),
        },
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      await emailService.sendEmail(testEmailData);
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.tracking_settings).toEqual({
        click_tracking: { enable: true },
        open_tracking: { enable: true },
        subscription_tracking: { enable: true },
      });
    });
  });

  describe('queueEmail', () => {
    it('should add email to queue with correct priority', () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        priority: 'high',
      };
      
      const queueId = emailService.queueEmail(emailData);
      
      expect(queueId).toBeDefined();
      expect(emailService.deliveryQueue).toHaveLength(1);
      expect(emailService.deliveryQueue[0].priority).toBe('high');
      expect(emailService.deliveryQueue[0].to).toBe('test@example.com');
    });

    it('should sort queue by priority', () => {
      emailService.queueEmail({ subject: 'Low', priority: 'low' });
      emailService.queueEmail({ subject: 'Critical', priority: 'critical' });
      emailService.queueEmail({ subject: 'Normal', priority: 'normal' });
      emailService.queueEmail({ subject: 'High', priority: 'high' });
      
      expect(emailService.deliveryQueue).toHaveLength(4);
      expect(emailService.deliveryQueue[0].subject).toBe('Critical');
      expect(emailService.deliveryQueue[1].subject).toBe('High');
      expect(emailService.deliveryQueue[2].subject).toBe('Normal');
      expect(emailService.deliveryQueue[3].subject).toBe('Low');
    });

    it('should use normal priority as default', () => {
      const queueId = emailService.queueEmail({
        to: 'test@example.com',
        subject: 'Test Email',
      });
      
      expect(emailService.deliveryQueue[0].priority).toBe('normal');
    });
  });

  describe('processBatchQueue', () => {
    beforeEach(() => {
      // Mock setTimeout for throttling
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123;
      });
    });

    afterEach(() => {
      global.setTimeout.mockRestore();
    });

    it('should process empty queue', async () => {
      const result = await emailService.processBatchQueue();
      
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should process queue in batches', async () => {
      // Add more emails than batch size
      for (let i = 0; i < 15; i++) {
        emailService.queueEmail({
          to: `test${i}@example.com`,
          subject: `Test Email ${i}`,
          htmlContent: '<h1>Test</h1>',
          textContent: 'Test',
        });
      }
      
      // Mock successful responses
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('test-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.processBatchQueue();
      
      expect(result.processed).toBe(15);
      expect(result.failed).toBe(0);
      expect(emailService.deliveryQueue).toHaveLength(0);
      expect(fetch).toHaveBeenCalledTimes(15);
    });

    it('should handle mixed success/failure in batch', async () => {
      // Add test emails
      emailService.queueEmail({
        to: 'success@example.com',
        subject: 'Success Email',
        htmlContent: '<h1>Test</h1>',
        textContent: 'Test',
      });
      
      emailService.queueEmail({
        to: 'fail@example.com',
        subject: 'Fail Email',
        htmlContent: '<h1>Test</h1>',
        textContent: 'Test',
      });
      
      // Mock mixed responses
      const mockSuccessResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('success-message-id'),
        },
      };
      
      const mockFailResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      };
      
      fetch
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce(mockFailResponse)
        .mockResolvedValueOnce(mockFailResponse)
        .mockResolvedValueOnce(mockFailResponse);
      
      const result = await emailService.processBatchQueue();
      
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('sendBulkNotifications', () => {
    beforeEach(() => {
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123;
      });
    });

    afterEach(() => {
      global.setTimeout.mockRestore();
    });

    it('should send bulk notifications', async () => {
      const notifications = [
        { to: 'user1@example.com', subject: 'Test 1', htmlContent: '<h1>Test 1</h1>', textContent: 'Test 1' },
        { to: 'user2@example.com', subject: 'Test 2', htmlContent: '<h1>Test 2</h1>', textContent: 'Test 2' },
      ];
      
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('bulk-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendBulkNotifications(notifications);
      
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.totalQueued).toBe(2);
      expect(result.queueIds).toHaveLength(2);
    });
  });

  describe('getDeliveryStats', () => {
    it('should return mock stats', () => {
      const stats = emailService.getDeliveryStats('org-123', '24h');
      
      expect(stats).toEqual({
        sent: 125,
        failed: 3,
        pending: 7,
        deliveryRate: 97.6,
        organizationId: 'org-123',
        timeRange: '24h',
        generatedAt: expect.any(String),
      });
    });

    it('should use default parameters', () => {
      const stats = emailService.getDeliveryStats();
      
      expect(stats.organizationId).toBe(null);
      expect(stats.timeRange).toBe('24h');
    });
  });

  describe('sendInvitationEmail', () => {
    const invitationData = {
      toEmail: 'invitee@example.com',
      toName: 'John Doe',
      organizationName: 'Test Org',
      inviterName: 'Jane Smith',
      role: 'member',
      invitationLink: 'https://alert24.io/accept/123',
      expiresAt: new Date('2024-12-31'),
      organizationId: 'org-123',
    };

    it('should send invitation email successfully', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('invitation-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendInvitationEmail(invitationData);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('invitation-message-id');
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.personalizations[0].subject).toContain('invited to join Test Org');
      expect(payload.personalizations[0].to[0].email).toBe('invitee@example.com');
    });

    it('should include unsubscribe link in HTML content', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('invitation-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      await emailService.sendInvitationEmail(invitationData);
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const htmlContent = payload.content.find(c => c.type === 'text/html').value;
      
      expect(htmlContent).toContain('{{unsubscribe}}');
      expect(htmlContent).toContain('Unsubscribe');
    });
  });

  describe('sendIncidentNotification', () => {
    const incidentData = {
      toEmail: 'responder@example.com',
      toName: 'Response Team',
      organizationName: 'Test Org',
      incidentTitle: 'Database Connection Issue',
      incidentDescription: 'Cannot connect to primary database',
      severity: 'critical',
      status: 'open',
      incidentUrl: 'https://alert24.io/incidents/123',
      organizationId: 'org-123',
    };

    it('should send critical incident notification with high priority', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('incident-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendIncidentNotification(incidentData);
      
      expect(result.success).toBe(true);
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.personalizations[0].subject).toContain('[CRITICAL]');
      expect(payload.personalizations[0].subject).toContain('Database Connection Issue');
    });

    it('should use appropriate colors for severity levels', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('incident-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      await emailService.sendIncidentNotification({
        ...incidentData,
        severity: 'medium',
      });
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const htmlContent = payload.content.find(c => c.type === 'text/html').value;
      
      expect(htmlContent).toContain('#1976d2'); // Medium severity color
    });
  });

  describe('sendMonitoringAlert', () => {
    const monitoringData = {
      toEmail: 'ops@example.com',
      toName: 'Operations Team',
      organizationName: 'Test Org',
      serviceName: 'API Service',
      checkName: 'Health Check',
      alertType: 'down',
      errorMessage: 'Connection timeout',
      responseTime: null,
      checkUrl: 'https://api.example.com/health',
      organizationId: 'org-123',
    };

    it('should send service down alert with critical priority', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('monitoring-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await emailService.sendMonitoringAlert(monitoringData);
      
      expect(result.success).toBe(true);
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.personalizations[0].subject).toContain('🔴 Service Down');
      expect(payload.personalizations[0].subject).toContain('API Service');
    });

    it('should send service recovery alert with normal priority', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('monitoring-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      await emailService.sendMonitoringAlert({
        ...monitoringData,
        alertType: 'up',
        errorMessage: null,
        responseTime: 150,
      });
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.personalizations[0].subject).toContain('✅ Service Recovered');
    });

    it('should include response time when available', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('monitoring-message-id'),
        },
      };
      fetch.mockResolvedValue(mockResponse);
      
      await emailService.sendMonitoringAlert({
        ...monitoringData,
        alertType: 'up',
        responseTime: 250,
      });
      
      const callArgs = fetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const htmlContent = payload.content.find(c => c.type === 'text/html').value;
      
      expect(htmlContent).toContain('250ms');
    });
  });
});
/**
 * Webhook Integration Service
 * Handles outbound webhook delivery with authentication, retry logic, and monitoring
 * Compatible with Cloudflare Edge Runtime
 */

import crypto from 'crypto';

class WebhookService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.timeout = 30000; // 30 seconds
    this.maxPayloadSize = 1024 * 1024; // 1MB
  }

  /**
   * Send webhook to a single endpoint
   */
  async sendWebhook(webhook, payload, options = {}) {
    try {
      const webhookPayload = this.preparePayload(webhook, payload, options);
      const headers = await this.prepareHeaders(webhook, webhookPayload, options);
      
      const response = await this.makeRequest(webhook.url, webhookPayload, headers, options);
      
      return {
        success: true,
        webhookId: webhook.id,
        url: webhook.url,
        status: response.status,
        responseTime: response.responseTime,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: response.body,
        timestamp: new Date().toISOString(),
        attempt: options.attempt || 1
      };

    } catch (error) {
      console.error('Webhook delivery failed:', error);
      return {
        success: false,
        webhookId: webhook.id,
        url: webhook.url,
        error: error.message,
        status: error.status,
        timestamp: new Date().toISOString(),
        attempt: options.attempt || 1
      };
    }
  }

  /**
   * Send webhook with retry logic
   */
  async sendWebhookWithRetry(webhook, payload, options = {}) {
    let lastResult = null;
    let attempt = 1;

    while (attempt <= this.maxRetries) {
      const result = await this.sendWebhook(webhook, payload, {
        ...options,
        attempt
      });

      lastResult = result;

      if (result.success) {
        return result;
      }

      // Don't retry on client errors (4xx)
      if (result.status && result.status >= 400 && result.status < 500) {
        break;
      }

      // Don't retry if webhook is disabled
      if (!webhook.is_active) {
        break;
      }

      if (attempt < this.maxRetries) {
        const delay = this.calculateRetryDelay(attempt);
        await this.delay(delay);
      }

      attempt++;
    }

    return lastResult;
  }

  /**
   * Send webhooks to multiple endpoints
   */
  async sendBatchWebhooks(webhooks, payload, options = {}) {
    const batchSize = options.batchSize || 10;
    const results = [];

    for (let i = 0; i < webhooks.length; i += batchSize) {
      const batch = webhooks.slice(i, i + batchSize);
      const batchPromises = batch.map(webhook => 
        this.sendWebhookWithRetry(webhook, payload, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { 
          success: false, 
          error: result.reason?.message || 'Unknown error',
          webhookId: null 
        }
      ));

      // Rate limiting between batches
      if (i + batchSize < webhooks.length) {
        await this.delay(options.batchDelay || 100);
      }
    }

    return results;
  }

  /**
   * Prepare webhook payload
   */
  preparePayload(webhook, data, options = {}) {
    const basePayload = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: options.event || 'notification',
      organization_id: webhook.organization_id,
      webhook_id: webhook.id,
      data
    };

    // Apply payload template if configured
    if (webhook.payload_template) {
      try {
        const template = JSON.parse(webhook.payload_template);
        return this.applyTemplate(template, { ...basePayload, ...data });
      } catch (error) {
        console.warn('Invalid payload template, using default:', error);
      }
    }

    // Apply field mapping if configured
    if (webhook.field_mapping) {
      try {
        const mapping = JSON.parse(webhook.field_mapping);
        return this.applyFieldMapping(basePayload, mapping);
      } catch (error) {
        console.warn('Invalid field mapping, using default:', error);
      }
    }

    return basePayload;
  }

  /**
   * Apply template to payload
   */
  applyTemplate(template, data) {
    const templateStr = JSON.stringify(template);
    const interpolated = templateStr.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? JSON.stringify(value).slice(1, -1) : match;
    });
    
    return JSON.parse(interpolated);
  }

  /**
   * Apply field mapping to payload
   */
  applyFieldMapping(payload, mapping) {
    const mappedPayload = {};
    
    for (const [targetField, sourceField] of Object.entries(mapping)) {
      const value = this.getNestedValue(payload, sourceField);
      if (value !== undefined) {
        this.setNestedValue(mappedPayload, targetField, value);
      }
    }
    
    return mappedPayload;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Prepare headers for webhook request
   */
  async prepareHeaders(webhook, payload, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Alert24-Webhook/1.0',
      'X-Alert24-Webhook-Id': webhook.id,
      'X-Alert24-Timestamp': new Date().toISOString(),
      'X-Alert24-Delivery-Id': crypto.randomUUID()
    };

    // Add custom headers
    if (webhook.headers) {
      try {
        const customHeaders = JSON.parse(webhook.headers);
        Object.assign(headers, customHeaders);
      } catch (error) {
        console.warn('Invalid custom headers:', error);
      }
    }

    // Add authentication headers
    if (webhook.auth_type && webhook.auth_config) {
      try {
        const authConfig = JSON.parse(webhook.auth_config);
        const authHeaders = await this.generateAuthHeaders(webhook.auth_type, authConfig, payload);
        Object.assign(headers, authHeaders);
      } catch (error) {
        console.warn('Failed to generate auth headers:', error);
      }
    }

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await this.generateSignature(payload, webhook.secret);
      headers['X-Alert24-Signature'] = signature;
      headers['X-Alert24-Signature-256'] = `sha256=${signature}`;
    }

    return headers;
  }

  /**
   * Generate authentication headers
   */
  async generateAuthHeaders(authType, authConfig, payload) {
    const headers = {};

    switch (authType) {
      case 'bearer':
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;

      case 'basic':
        if (authConfig.username && authConfig.password) {
          const credentials = btoa(`${authConfig.username}:${authConfig.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'api_key':
        if (authConfig.key && authConfig.value) {
          headers[authConfig.key] = authConfig.value;
        }
        break;

      case 'custom':
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
        break;

      default:
        console.warn(`Unknown auth type: ${authType}`);
    }

    return headers;
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  async generateSignature(payload, secret) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    // Use Web Crypto API for Edge Runtime compatibility
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payloadString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(url, payload, headers, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || this.timeout);
    
    const startTime = Date.now();

    try {
      const payloadString = JSON.stringify(payload);
      
      // Check payload size
      if (payloadString.length > this.maxPayloadSize) {
        throw new Error(`Payload too large: ${payloadString.length} bytes (max: ${this.maxPayloadSize})`);
      }

      const response = await fetch(url, {
        method: options.method || 'POST',
        headers,
        body: payloadString,
        signal: controller.signal
      });

      const responseTime = Date.now() - startTime;
      let responseBody = '';

      try {
        responseBody = await response.text();
      } catch (bodyError) {
        console.warn('Failed to read response body:', bodyError);
      }

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = responseBody;
        throw error;
      }

      return {
        status: response.status,
        headers: response.headers,
        body: responseBody,
        responseTime
      };

    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    return this.retryDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Validate webhook configuration
   */
  validateWebhook(webhook) {
    const errors = [];

    if (!webhook.url) {
      errors.push('URL is required');
    } else {
      try {
        new URL(webhook.url);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    if (webhook.auth_config) {
      try {
        JSON.parse(webhook.auth_config);
      } catch {
        errors.push('Invalid auth configuration JSON');
      }
    }

    if (webhook.headers) {
      try {
        JSON.parse(webhook.headers);
      } catch {
        errors.push('Invalid headers JSON');
      }
    }

    if (webhook.payload_template) {
      try {
        JSON.parse(webhook.payload_template);
      } catch {
        errors.push('Invalid payload template JSON');
      }
    }

    if (webhook.field_mapping) {
      try {
        JSON.parse(webhook.field_mapping);
      } catch {
        errors.push('Invalid field mapping JSON');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhook, testPayload = null) {
    const validation = this.validateWebhook(webhook);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Webhook validation failed: ${validation.errors.join(', ')}`
      };
    }

    const payload = testPayload || {
      test: true,
      message: 'This is a test webhook from Alert24',
      timestamp: new Date().toISOString()
    };

    return this.sendWebhook(webhook, payload, { event: 'test' });
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(results) {
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      avgResponseTime: 0,
      errors: {}
    };

    let totalResponseTime = 0;
    let successfulWithTime = 0;

    results.forEach(result => {
      if (result.success) {
        stats.successful++;
        if (result.responseTime) {
          totalResponseTime += result.responseTime;
          successfulWithTime++;
        }
      } else {
        stats.failed++;
        const errorType = result.error || 'unknown';
        stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;
      }
    });

    stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
    stats.avgResponseTime = successfulWithTime > 0 ? totalResponseTime / successfulWithTime : 0;

    return stats;
  }

  /**
   * Create webhook payload for different event types
   */
  createEventPayload(eventType, data) {
    const baseData = {
      event: eventType,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    switch (eventType) {
      case 'incident.created':
      case 'incident.updated':
      case 'incident.resolved':
        return {
          ...baseData,
          incident: {
            id: data.id,
            title: data.title,
            description: data.description,
            severity: data.severity,
            status: data.status,
            service_id: data.service_id,
            created_at: data.created_at,
            updated_at: data.updated_at,
            resolved_at: data.resolved_at,
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/incidents/${data.id}`
          }
        };

      case 'service.down':
      case 'service.up':
      case 'service.degraded':
        return {
          ...baseData,
          service: {
            id: data.id,
            name: data.name,
            status: data.status,
            previous_status: data.previous_status,
            updated_at: data.updated_at,
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/services/${data.id}`
          }
        };

      case 'monitoring.alert':
        return {
          ...baseData,
          alert: {
            check_id: data.check_id,
            check_name: data.check_name,
            status: data.status,
            response_time: data.response_time,
            error_message: data.error_message,
            timestamp: data.timestamp,
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/monitoring/${data.check_id}`
          }
        };

      default:
        return {
          ...baseData,
          data
        };
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default WebhookService;
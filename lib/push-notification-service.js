/**
 * Push Notification Service
 * Handles web push notifications using Web Push API
 * Compatible with Cloudflare Edge Runtime
 */

const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  email: process.env.VAPID_EMAIL || 'notifications@alert24.app'
};

class PushNotificationService {
  constructor() {
    this.validateConfiguration();
  }

  validateConfiguration() {
    if (!VAPID_KEYS.publicKey || !VAPID_KEYS.privateKey) {
      throw new Error('VAPID keys not configured');
    }
  }

  /**
   * Send push notification to a single subscription
   */
  async sendNotification(subscription, payload, options = {}) {
    try {
      const headers = await this.generateHeaders(subscription.endpoint, payload);
      
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers,
        body: payload
      });

      return {
        success: response.ok,
        status: response.status,
        endpoint: subscription.endpoint,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Push notification failed:', error);
      return {
        success: false,
        error: error.message,
        endpoint: subscription.endpoint,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send push notifications to multiple subscriptions with batching
   */
  async sendBatchNotifications(subscriptions, payload, options = {}) {
    const batchSize = options.batchSize || 100;
    const results = [];

    for (let i = 0; i < subscriptions.length; i += batchSize) {
      const batch = subscriptions.slice(i, i + batchSize);
      const batchPromises = batch.map(subscription => 
        this.sendNotification(subscription, payload, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
      ));

      // Rate limiting between batches
      if (i + batchSize < subscriptions.length) {
        await this.delay(options.batchDelay || 100);
      }
    }

    return results;
  }

  /**
   * Generate Web Push protocol headers
   */
  async generateHeaders(endpoint, payload) {
    const url = new URL(endpoint);
    
    // Basic headers
    const headers = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': payload.length.toString()
    };

    // Add TTL (time to live)
    headers['TTL'] = '86400'; // 24 hours

    // Add urgency
    headers['Urgency'] = 'normal';

    // VAPID authentication for supported endpoints
    if (this.supportsVapid(endpoint)) {
      const vapidHeaders = await this.generateVapidHeaders(endpoint);
      Object.assign(headers, vapidHeaders);
    }

    return headers;
  }

  /**
   * Check if endpoint supports VAPID
   */
  supportsVapid(endpoint) {
    return endpoint.includes('fcm.googleapis.com') || 
           endpoint.includes('updates.push.services.mozilla.com') ||
           endpoint.includes('notify.windows.com');
  }

  /**
   * Generate VAPID authentication headers
   */
  async generateVapidHeaders(endpoint) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    
    // JWT claims
    const claims = {
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
      sub: `mailto:${VAPID_KEYS.email}`
    };

    try {
      // In production, you'd use a proper JWT library
      // For Edge Runtime compatibility, we'll use a simplified approach
      const token = await this.createJWT(claims);
      
      return {
        'Authorization': `vapid t=${token}, k=${VAPID_KEYS.publicKey}`
      };
    } catch (error) {
      console.error('VAPID header generation failed:', error);
      return {};
    }
  }

  /**
   * Create JWT token (simplified for Edge Runtime)
   */
  async createJWT(claims) {
    const header = {
      typ: 'JWT',
      alg: 'ES256'
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(claims));
    const data = `${encodedHeader}.${encodedPayload}`;

    // This is a simplified implementation
    // In production, use a proper cryptographic signing
    const signature = await this.sign(data);
    
    return `${data}.${signature}`;
  }

  /**
   * Base64 URL encode
   */
  base64UrlEncode(data) {
    return btoa(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Sign data (simplified implementation)
   */
  async sign(data) {
    // This is a placeholder - in production use proper ECDSA P-256 signing
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data + VAPID_KEYS.privateKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    return this.base64UrlEncode(String.fromCharCode(...hashArray));
  }

  /**
   * Create notification payload
   */
  createPayload(notification) {
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/notification-icon.png',
      badge: notification.badge || '/icons/notification-badge.png',
      image: notification.image,
      tag: notification.tag || 'alert24-notification',
      renotify: notification.renotify || false,
      requireInteraction: notification.requireInteraction || false,
      actions: notification.actions || [],
      data: {
        url: notification.url,
        timestamp: new Date().toISOString(),
        ...notification.data
      }
    };

    return JSON.stringify(payload);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate push subscription
   */
  validateSubscription(subscription) {
    return subscription &&
           subscription.endpoint &&
           subscription.keys &&
           subscription.keys.p256dh &&
           subscription.keys.auth;
  }

  /**
   * Get notification statistics
   */
  async getDeliveryStats(results) {
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      errors: {}
    };

    results.forEach(result => {
      if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;
        const errorType = result.error || 'unknown';
        stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;
      }
    });

    stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

    return stats;
  }
}

export default PushNotificationService;
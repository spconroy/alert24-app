/**
 * SMS Notification Service using Twilio
 * Handles SMS delivery with global carrier support and fallback
 * Compatible with Cloudflare Edge Runtime
 */

class SMSService {
  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    
    this.validateConfiguration();
  }

  validateConfiguration() {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      throw new Error('Twilio credentials not configured');
    }
    
    if (!this.twilioPhoneNumber && !this.twilioMessagingServiceSid) {
      throw new Error('Either Twilio phone number or messaging service SID must be configured');
    }
  }

  /**
   * Send SMS to a single recipient
   */
  async sendSMS(to, message, options = {}) {
    try {
      const payload = {
        To: this.formatPhoneNumber(to),
        Body: message,
        ...this.getFromIdentifier(options),
        ...(options.statusCallback && { StatusCallback: options.statusCallback }),
        MaxPrice: options.maxPrice || '0.50', // USD price limit per message
        ProvideFeedback: true
      };

      // Add media URLs for MMS if provided
      if (options.mediaUrls && options.mediaUrls.length > 0) {
        options.mediaUrls.forEach((url, index) => {
          payload[`MediaUrl${index}`] = url;
        });
      }

      // Set delivery attempt timeouts
      if (options.validityPeriod) {
        payload.ValidityPeriod = options.validityPeriod; // seconds
      }

      // Set message priority
      if (options.priority === 'high') {
        payload.SendAsMms = true; // High priority messages as MMS for better delivery
      }

      const response = await this.makeTwilioRequest('Messages', payload);

      return {
        success: true,
        messageId: response.sid,
        status: response.status,
        to: response.to,
        from: response.from,
        cost: response.price,
        currency: response.price_unit,
        direction: response.direction,
        timestamp: new Date().toISOString(),
        provider: 'twilio'
      };

    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        to,
        timestamp: new Date().toISOString(),
        provider: 'twilio'
      };
    }
  }

  /**
   * Send SMS to multiple recipients with batching
   */
  async sendBatchSMS(recipients, message, options = {}) {
    const batchSize = options.batchSize || 50; // Twilio rate limits
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(recipient => {
        const phoneNumber = typeof recipient === 'string' ? recipient : recipient.phoneNumber;
        const customMessage = typeof recipient === 'object' && recipient.message ? recipient.message : message;
        const recipientOptions = typeof recipient === 'object' ? { ...options, ...recipient.options } : options;
        
        return this.sendSMS(phoneNumber, customMessage, recipientOptions);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
      ));

      // Rate limiting between batches
      if (i + batchSize < recipients.length) {
        await this.delay(options.batchDelay || 1000); // 1 second between batches
      }
    }

    return results;
  }

  /**
   * Send SMS with carrier-specific optimization
   */
  async sendOptimizedSMS(to, message, options = {}) {
    const phoneInfo = await this.getPhoneNumberInfo(to);
    
    // Optimize message based on carrier and country
    const optimizedOptions = {
      ...options,
      ...this.getCarrierOptimizations(phoneInfo)
    };

    return this.sendSMS(to, message, optimizedOptions);
  }

  /**
   * Get phone number information for optimization
   */
  async getPhoneNumberInfo(phoneNumber) {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const response = await this.makeTwilioRequest(`PhoneNumbers/${encodeURIComponent(formattedNumber)}`, null, 'GET');
      
      return {
        phoneNumber: response.phone_number,
        countryCode: response.country_code,
        carrier: response.carrier,
        lineType: response.type, // mobile, landline, voip
        isValid: true
      };
    } catch (error) {
      console.warn('Phone number lookup failed:', error);
      return {
        phoneNumber,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get carrier-specific optimizations
   */
  getCarrierOptimizations(phoneInfo) {
    const optimizations = {};

    // Country-specific optimizations
    switch (phoneInfo.countryCode) {
      case 'US':
      case 'CA':
        // North America optimizations
        optimizations.validityPeriod = 259200; // 3 days
        break;
      case 'GB':
      case 'DE':
      case 'FR':
        // Europe optimizations
        optimizations.validityPeriod = 172800; // 2 days
        break;
      case 'IN':
      case 'CN':
      case 'JP':
        // Asia optimizations
        optimizations.validityPeriod = 86400; // 1 day
        optimizations.maxPrice = '0.10'; // Lower cost threshold
        break;
      default:
        optimizations.validityPeriod = 86400; // 1 day default
    }

    // Line type optimizations
    if (phoneInfo.lineType === 'landline') {
      // Landlines may not support SMS
      optimizations.fallbackToVoice = true;
    }

    return optimizations;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Check if it starts with + and has country code
    if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
      return { isValid: true, formatted: cleaned };
    }
    
    // Try to add default country code if missing
    if (!cleaned.startsWith('+') && cleaned.length === 10) {
      // Assume US/Canada if 10 digits
      return { isValid: true, formatted: `+1${cleaned}` };
    }
    
    return { isValid: false, error: 'Invalid phone number format' };
  }

  /**
   * Format phone number for Twilio
   */
  formatPhoneNumber(phoneNumber) {
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid phone number');
    }
    return validation.formatted;
  }

  /**
   * Get from identifier (phone number or messaging service)
   */
  getFromIdentifier(options = {}) {
    if (options.from) {
      return { From: this.formatPhoneNumber(options.from) };
    }
    
    if (this.twilioMessagingServiceSid) {
      return { MessagingServiceSid: this.twilioMessagingServiceSid };
    }
    
    if (this.twilioPhoneNumber) {
      return { From: this.twilioPhoneNumber };
    }
    
    throw new Error('No from identifier configured');
  }

  /**
   * Make Twilio API request
   */
  async makeTwilioRequest(endpoint, payload = null, method = 'POST') {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/${endpoint}.json`;
    
    const headers = {
      'Authorization': `Basic ${btoa(`${this.twilioAccountSid}:${this.twilioAuthToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const options = {
      method,
      headers
    };

    if (payload && method !== 'GET') {
      options.body = new URLSearchParams(payload).toString();
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'Twilio API error');
      error.code = data.code;
      error.moreInfo = data.more_info;
      error.status = data.status;
      throw error;
    }

    return data;
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId) {
    try {
      const response = await this.makeTwilioRequest(`Messages/${messageId}`, null, 'GET');
      
      return {
        messageId: response.sid,
        status: response.status,
        to: response.to,
        from: response.from,
        cost: response.price,
        currency: response.price_unit,
        dateCreated: response.date_created,
        dateSent: response.date_sent,
        dateUpdated: response.date_updated,
        errorCode: response.error_code,
        errorMessage: response.error_message,
        numSegments: response.num_segments,
        direction: response.direction
      };
    } catch (error) {
      console.error('Failed to get message status:', error);
      throw error;
    }
  }

  /**
   * Get account balance and usage
   */
  async getAccountInfo() {
    try {
      const [balance, usage] = await Promise.all([
        this.makeTwilioRequest('Balance', null, 'GET'),
        this.makeTwilioRequest('Usage/Records/Today', null, 'GET')
      ]);

      return {
        balance: {
          amount: balance.balance,
          currency: balance.currency
        },
        usage: {
          today: usage.usage_records
        }
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      throw error;
    }
  }

  /**
   * Create message template for different types
   */
  createMessageTemplate(type, data) {
    const templates = {
      incident_alert: {
        template: `🚨 INCIDENT ALERT\n${data.title}\nSeverity: ${data.severity}\nStatus: ${data.status}\nView: ${data.url}`,
        priority: 'high'
      },
      incident_update: {
        template: `📋 INCIDENT UPDATE\n${data.title}\nStatus: ${data.status}\n${data.message}\nView: ${data.url}`,
        priority: 'normal'
      },
      monitoring_alert: {
        template: `⚠️ SERVICE ALERT\n${data.serviceName} is ${data.status}\nCheck: ${data.checkName}\nView: ${data.url}`,
        priority: 'high'
      },
      maintenance_notice: {
        template: `🔧 MAINTENANCE\n${data.title}\nScheduled: ${data.scheduledAt}\nDuration: ${data.duration}\nView: ${data.url}`,
        priority: 'normal'
      },
      service_recovery: {
        template: `✅ SERVICE RECOVERED\n${data.serviceName} is now operational\nDowntime: ${data.downtime}\nView: ${data.url}`,
        priority: 'normal'
      }
    };

    const template = templates[type];
    if (!template) {
      throw new Error(`Unknown message template type: ${type}`);
    }

    return {
      message: template.template,
      priority: template.priority
    };
  }

  /**
   * Send templated SMS
   */
  async sendTemplatedSMS(to, type, data, options = {}) {
    const { message, priority } = this.createMessageTemplate(type, data);
    
    const smsOptions = {
      ...options,
      priority,
      ...(options.statusCallback && { statusCallback: options.statusCallback })
    };

    return this.sendSMS(to, message, smsOptions);
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(results) {
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      pending: 0,
      totalCost: 0,
      currencies: {},
      errors: {}
    };

    results.forEach(result => {
      if (result.success) {
        stats.successful++;
        if (result.cost && result.cost !== null) {
          const cost = parseFloat(result.cost) || 0;
          stats.totalCost += Math.abs(cost); // Twilio costs are negative
          const currency = result.currency || 'USD';
          stats.currencies[currency] = (stats.currencies[currency] || 0) + Math.abs(cost);
        }
      } else {
        stats.failed++;
        const errorType = result.errorCode || result.error || 'unknown';
        stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;
      }
    });

    stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if SMS is supported in country
   */
  isSMSSupported(countryCode) {
    // List of countries where SMS is well supported
    const supportedCountries = [
      'US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AU', 'NZ',
      'JP', 'KR', 'IN', 'SG', 'HK', 'BR', 'MX', 'AR', 'CL', 'CO'
    ];
    
    return supportedCountries.includes(countryCode?.toUpperCase());
  }

  /**
   * Get cost estimate for SMS
   */
  getCostEstimate(countryCode, messageLength = 160) {
    // Simplified cost estimation based on Twilio pricing
    const pricing = {
      'US': { base: 0.0075, mms: 0.02 },
      'CA': { base: 0.0075, mms: 0.02 },
      'GB': { base: 0.04, mms: 0.05 },
      'DE': { base: 0.075, mms: 0.09 },
      'FR': { base: 0.075, mms: 0.09 },
      'AU': { base: 0.054, mms: 0.25 },
      'IN': { base: 0.0051, mms: 0.0051 },
      'default': { base: 0.05, mms: 0.075 }
    };

    const rates = pricing[countryCode?.toUpperCase()] || pricing.default;
    const segments = Math.ceil(messageLength / 160);
    
    return {
      estimatedCost: rates.base * segments,
      currency: 'USD',
      segments,
      ratePerSegment: rates.base
    };
  }
}

export default SMSService;
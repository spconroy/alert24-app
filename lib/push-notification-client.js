/**
 * Client-side Push Notification Manager
 * Handles service worker registration and push subscription management
 */

class PushNotificationClient {
  constructor() {
    this.publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    this.serviceWorkerUrl = '/sw.js';
    this.isSupported = this.checkSupport();
  }

  /**
   * Check if push notifications are supported
   */
  checkSupport() {
    if (typeof window === 'undefined') return false;
    
    return 'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      throw new Error('Push notifications are blocked');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if (!this.isSupported) {
      throw new Error('Service workers are not supported');
    }

    try {
      const registration = await navigator.serviceWorker.register(this.serviceWorkerUrl);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw new Error('Failed to register service worker');
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe() {
    try {
      // Check permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permission denied for notifications');
      }

      // Register service worker
      const registration = await this.registerServiceWorker();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicVapidKey)
      });

      // Get device information
      const deviceInfo = this.getDeviceInfo();

      // Send subscription to server
      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceInfo
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register push subscription');
      }

      const result = await response.json();
      
      // Store subscription locally for reference
      localStorage.setItem('push-subscription', JSON.stringify(subscription.toJSON()));
      localStorage.setItem('push-subscription-id', result.subscriptionId);

      return {
        subscription,
        subscriptionId: result.subscriptionId,
        deviceInfo
      };

    } catch (error) {
      console.error('Push subscription failed:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('No service worker registration found');
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        throw new Error('No push subscription found');
      }

      // Unsubscribe from push manager
      await subscription.unsubscribe();

      // Remove from server
      const response = await fetch(`/api/notifications/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        console.warn('Failed to remove subscription from server');
      }

      // Clear local storage
      localStorage.removeItem('push-subscription');
      localStorage.removeItem('push-subscription-id');

      return true;

    } catch (error) {
      console.error('Push unsubscription failed:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscription() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;

      const subscription = await registration.pushManager.getSubscription();
      return subscription;

    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed() {
    const subscription = await this.getSubscription();
    return subscription !== null;
  }

  /**
   * Get user's push subscriptions from server
   */
  async getUserSubscriptions() {
    try {
      const response = await fetch('/api/notifications/push');
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const result = await response.json();
      return result.subscriptions;

    } catch (error) {
      console.error('Failed to get user subscriptions:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const response = await fetch('/api/notifications/push/send', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Test notification failed:', error);
      throw error;
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get device information
   */
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    
    // Detect device type
    let deviceType = 'desktop';
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/iPad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Detect browser
    let browser = 'unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Get device name
    let deviceName = 'Unknown Device';
    if (deviceType === 'mobile') {
      if (userAgent.includes('iPhone')) deviceName = 'iPhone';
      else if (userAgent.includes('Android')) deviceName = 'Android Device';
    } else {
      deviceName = `${browser} on ${navigator.platform}`;
    }

    return {
      type: deviceType,
      name: deviceName,
      browser,
      userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Handle service worker messages
   */
  setupMessageListener() {
    if (!this.isSupported) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'NOTIFICATION_CLICKED':
          this.handleNotificationClick(data);
          break;
        case 'NOTIFICATION_CLOSED':
          this.handleNotificationClose(data);
          break;
        default:
          console.log('Unknown service worker message:', event.data);
      }
    });
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(data) {
    console.log('Notification clicked:', data);
    
    // Open URL if provided
    if (data.url) {
      window.open(data.url, '_blank');
    }

    // Send analytics event
    this.trackNotificationEvent('click', data);
  }

  /**
   * Handle notification close
   */
  handleNotificationClose(data) {
    console.log('Notification closed:', data);
    
    // Send analytics event
    this.trackNotificationEvent('close', data);
  }

  /**
   * Track notification events
   */
  trackNotificationEvent(action, data) {
    try {
      // Send analytics to server
      fetch('/api/analytics/notification-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notificationData: data,
          timestamp: new Date().toISOString()
        })
      }).catch(error => {
        console.warn('Failed to track notification event:', error);
      });
    } catch (error) {
      console.warn('Failed to track notification event:', error);
    }
  }
}

export default PushNotificationClient;
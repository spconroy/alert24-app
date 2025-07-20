/**
 * Service Worker for Push Notifications
 * Handles background push messages and notification display
 */

const CACHE_NAME = 'alert24-notifications-v1';
const NOTIFICATION_TAG = 'alert24-notification';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

// Push event
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push message received');

  if (!event.data) {
    console.warn('Push event has no data');
    return;
  }

  try {
    const notification = event.data.json();
    console.log('Push notification data:', notification);

    const options = {
      body: notification.body,
      icon: notification.icon || '/icons/notification-icon-192.png',
      badge: notification.badge || '/icons/notification-badge-72.png',
      image: notification.image,
      tag: notification.tag || NOTIFICATION_TAG,
      renotify: notification.renotify || false,
      requireInteraction: notification.requireInteraction || false,
      silent: false,
      timestamp: Date.now(),
      data: notification.data || {},
      actions: notification.actions || []
    };

    // Add default actions if none provided
    if (!options.actions.length) {
      options.actions = [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-icon.png'
        }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(notification.title, options)
    );

  } catch (error) {
    console.error('Error processing push notification:', error);
    
    // Show fallback notification
    event.waitUntil(
      self.registration.showNotification('Alert24 Notification', {
        body: 'You have a new notification',
        icon: '/icons/notification-icon-192.png',
        badge: '/icons/notification-badge-72.png',
        tag: NOTIFICATION_TAG
      })
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'dismiss') {
    // Just close the notification
    sendMessageToClient({
      type: 'NOTIFICATION_CLOSED',
      data: { action: 'dismiss', ...data }
    });
    return;
  }

  // Handle view action or notification click
  event.waitUntil(
    handleNotificationClick(data, action)
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed');
  
  const data = event.notification.data || {};
  
  sendMessageToClient({
    type: 'NOTIFICATION_CLOSED',
    data
  });
});

/**
 * Handle notification click
 */
async function handleNotificationClick(data, action) {
  const url = data.url || '/';
  
  try {
    // Get all window clients
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    // Check if the app is already open
    let clientToFocus = null;
    
    for (const client of clients) {
      if (client.url.includes(new URL(url, self.location.origin).pathname)) {
        clientToFocus = client;
        break;
      }
    }

    // If app is already open, focus it
    if (clientToFocus) {
      await clientToFocus.focus();
      
      // Send message to the client
      clientToFocus.postMessage({
        type: 'NOTIFICATION_CLICKED',
        data: { action, ...data }
      });
      
      return;
    }

    // If no matching client found, check if any Alert24 window is open
    const alert24Client = clients.find(client => 
      client.url.includes(self.location.origin)
    );

    if (alert24Client) {
      // Navigate existing window to the URL
      await alert24Client.navigate(url);
      await alert24Client.focus();
      
      alert24Client.postMessage({
        type: 'NOTIFICATION_CLICKED',
        data: { action, ...data }
      });
    } else {
      // Open new window
      await self.clients.openWindow(url);
    }

    // Send analytics
    sendNotificationAnalytics('click', { action, ...data });

  } catch (error) {
    console.error('Error handling notification click:', error);
    
    // Fallback: just open the URL
    await self.clients.openWindow(url);
  }
}

/**
 * Send message to all clients
 */
function sendMessageToClient(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

/**
 * Send notification analytics
 */
function sendNotificationAnalytics(action, data) {
  try {
    fetch('/api/analytics/notification-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        notificationData: data,
        timestamp: new Date().toISOString(),
        source: 'service-worker'
      })
    }).catch(error => {
      console.warn('Failed to send notification analytics:', error);
    });
  } catch (error) {
    console.warn('Failed to send notification analytics:', error);
  }
}

// Background sync (for future use)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

/**
 * Sync notifications in background
 */
async function syncNotifications() {
  try {
    // Fetch pending notifications
    const response = await fetch('/api/notifications/pending');
    
    if (response.ok) {
      const { notifications } = await response.json();
      
      // Show any pending notifications
      for (const notification of notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          tag: notification.tag || NOTIFICATION_TAG,
          data: notification.data
        });
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Message event (for communication with main thread)
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'SHOW_NOTIFICATION':
      self.registration.showNotification(data.title, data.options);
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});
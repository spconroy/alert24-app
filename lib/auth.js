import { SessionManager } from './session-manager.js';

/**
 * Get session from request
 */
export async function getSession(request = null) {
  try {
    const sessionManager = new SessionManager();
    
    if (request) {
      return await sessionManager.getSessionFromRequest(request);
    }
    
    // For client-side or server components
    if (typeof window === 'undefined') {
      // Server-side - need to get from headers/cookies
      const { headers } = await import('next/headers');
      const cookieStore = headers();
      const cookieHeader = cookieStore.get('cookie')?.value;
      
      if (!cookieHeader) return null;
      
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      
      const token = cookies['session-token'];
      return await sessionManager.verifySessionToken(token);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(request) {
  const session = await getSession(request);
  if (!session?.user?.email) {
    throw new Error('Authentication required');
  }
  return session;
}
// Simple session management for Edge Runtime
// Uses HTTP-only cookies and JWT-like tokens

export class SessionManager {
  constructor() {
    this.sessionSecret = process.env.NEXTAUTH_SECRET || 'fallback-secret';
  }

  // Create a simple session token
  async createSessionToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      image: user.picture || user.avatar_url,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    };

    // Simple base64 encoding (not secure, but works for Edge Runtime)
    // In production, you'd want proper JWT signing
    const encoded = btoa(JSON.stringify(payload));
    return encoded;
  }

  // Verify and decode session token
  async verifySessionToken(token) {
    try {
      if (!token) return null;

      const decoded = JSON.parse(atob(token));

      // Check expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return {
        user: {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name,
          image: decoded.image,
        },
        expires: new Date(decoded.exp * 1000).toISOString(),
      };
    } catch (error) {
      console.error('❌ Session verification error:', error);
      return null;
    }
  }

  // Create session cookie
  createSessionCookie(token) {
    const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds

    return [
      `session-token=${token}`,
      `Max-Age=${maxAge}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
  }

  // Clear session cookie
  clearSessionCookie() {
    return [
      'session-token=',
      'Max-Age=0',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
    ].join('; ');
  }

  // Extract session from request
  async getSessionFromRequest(request) {
    try {
      const cookieHeader = request.headers.get('cookie');
      if (!cookieHeader) return null;

      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );

      const token = cookies['session-token'];
      return await this.verifySessionToken(token);
    } catch (error) {
      console.error('❌ Session extraction error:', error);
      return null;
    }
  }
}

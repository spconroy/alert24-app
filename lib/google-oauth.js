// Direct Google OAuth implementation for Cloudflare Edge Runtime
// No NextAuth dependencies - pure OAuth 2.0 flow

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export class GoogleOAuth {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google/callback`;
  }

  // Generate Google OAuth URL for sign-in
  getAuthUrl(state = null) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: state || crypto.randomUUID(),
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Token exchange error:', error);
      throw error;
    }
  }

  // Get user info from Google
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`User info fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ User info fetch error:', error);
      throw error;
    }
  }

  // Verify token with Google
  async verifyToken(accessToken) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
      );

      if (!response.ok) {
        return false;
      }

      const tokenInfo = await response.json();
      return tokenInfo.audience === this.clientId;
    } catch (error) {
      console.error('❌ Token verification error:', error);
      return false;
    }
  }
}

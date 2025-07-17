/**
 * Edge Runtime-compatible password utilities using Web Crypto API
 * This replaces bcryptjs for Edge Runtime compatibility
 */

/**
 * Generate a random salt using Web Crypto API
 */
async function generateSalt() {
  const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(saltBuffer, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Hash a password with salt using PBKDF2 (Web Crypto API)
 */
async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = await generateSalt();
  }

  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  // Import the password as a key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive the hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 10000, // bcrypt equivalent rounds
      hash: 'SHA-256',
    },
    key,
    256 // 32 bytes output
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return `${salt}:${hashHex}`;
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password, storedHash) {
  try {
    // Handle different hash formats
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
      // This is a bcrypt hash - for backward compatibility
      // In a real migration, you'd want to rehash these passwords
      console.warn(
        'Bcrypt hash detected - consider migrating to Web Crypto hash'
      );

      // For now, return false to force password reset
      // In production, you might want to use a fallback or migration strategy
      return false;
    }

    if (storedHash.includes(':')) {
      // Our new format: salt:hash
      const [salt, hash] = storedHash.split(':');
      const newHash = await hashPassword(password, salt);
      return newHash === storedHash;
    }

    // Fallback for plain text (should not happen in production)
    console.warn('Plain text password detected - this is insecure');
    return password === storedHash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Check if a hash needs upgrading (is using old format)
 */
function needsHashUpgrade(storedHash) {
  return (
    storedHash.startsWith('$2a$') ||
    storedHash.startsWith('$2b$') ||
    !storedHash.includes(':')
  );
}

export { hashPassword, verifyPassword, generateSalt, needsHashUpgrade };

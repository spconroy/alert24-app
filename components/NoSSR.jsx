import React, { useState, useEffect } from 'react';

/**
 * NoSSR (No Server-Side Rendering) wrapper component
 *
 * This component ensures its children are only rendered on the client side,
 * preventing hydration mismatches when content differs between server and client.
 *
 * Use this for:
 * - Date/time formatting that varies by timezone
 * - Dynamic calculations that depend on client state
 * - Content that requires browser APIs
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render only on client
 * @param {React.ReactNode} props.fallback - Optional loading content for SSR
 */
export default function NoSSR({ children, fallback = null }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? children : fallback;
}

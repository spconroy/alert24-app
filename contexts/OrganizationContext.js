'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const OrganizationContext = createContext();

// Custom hook for session management (replaces NextAuth useSession)
function useSession() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setStatus('loading');
        console.log('🔍 Fetching session...');

        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const sessionData = await response.json();
          console.log('📥 Session response:', sessionData);

          setSession(sessionData);
          setStatus(sessionData ? 'authenticated' : 'unauthenticated');
        } else {
          console.log('❌ Session fetch failed:', response.status);
          setSession(null);
          setStatus('unauthenticated');
        }
      } catch (error) {
        console.error('❌ Error fetching session:', error);
        setSession(null);
        setStatus('unauthenticated');
      }
    };

    fetchSession();

    // Refresh session data every 5 minutes
    const interval = setInterval(fetchSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      setSession(null);
      setStatus('unauthenticated');
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  return { data: session, status, signOut };
}

// Helper functions for localStorage
const getStoredOrganizationId = () => {
  try {
    return localStorage.getItem('selectedOrganizationId');
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return null;
  }
};

const setStoredOrganizationId = organizationId => {
  try {
    if (organizationId) {
      localStorage.setItem('selectedOrganizationId', organizationId);
    } else {
      localStorage.removeItem('selectedOrganizationId');
    }
  } catch (error) {
    console.warn('Failed to write to localStorage:', error);
  }
};

export function OrganizationProvider({ children }) {
  const { data: session, status } = useSession();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch organizations when user is authenticated
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (status === 'authenticated' && session?.user?.email) {
        try {
          console.log('🔍 Fetching organizations for:', session.user.email);
          const response = await fetch('/api/organizations');

          if (response.ok) {
            const data = await response.json();
            console.log('📥 Organizations API response:', data);

            // Handle different response formats
            let orgs = [];
            if (Array.isArray(data)) {
              orgs = data;
            } else if (
              data.organizations &&
              Array.isArray(data.organizations)
            ) {
              orgs = data.organizations;
            } else if (data.data && Array.isArray(data.data)) {
              orgs = data.data;
            }

            console.log('📊 Organizations processed:', orgs.length, orgs);
            setOrganizations(orgs);

            // Set current organization from localStorage or default to first
            const storedId = getStoredOrganizationId();
            let selectedOrg = null;

            if (storedId) {
              selectedOrg = orgs.find(org => org.id === storedId);
              console.log('🎯 Found stored organization:', selectedOrg?.name);
            }

            if (!selectedOrg && orgs.length > 0) {
              selectedOrg = orgs[0];
              console.log('🏠 Using default organization:', selectedOrg.name);
              setStoredOrganizationId(selectedOrg.id);
            }

            setCurrentOrganization(selectedOrg);
          } else {
            console.error(
              'Failed to fetch organizations:',
              response.status,
              response.statusText
            );
          }
        } catch (error) {
          console.error('Error fetching organizations:', error);
        }
      } else if (status === 'unauthenticated') {
        console.log('🚪 User not authenticated - clearing organizations');
        setOrganizations([]);
        setCurrentOrganization(null);
        setStoredOrganizationId(null);
      }

      setLoading(false);
    };

    fetchOrganizations();
  }, [session, status]);

  const switchOrganization = organizationId => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      console.log('🔄 Switching to organization:', org.name);
      setCurrentOrganization(org);
      setStoredOrganizationId(organizationId);
    }
  };

  const refreshOrganizations = async () => {
    if (session?.user?.email) {
      setLoading(true);
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();

          // Handle different response formats
          let orgs = [];
          if (Array.isArray(data)) {
            orgs = data;
          } else if (data.organizations && Array.isArray(data.organizations)) {
            orgs = data.organizations;
          } else if (data.data && Array.isArray(data.data)) {
            orgs = data.data;
          }

          setOrganizations(orgs);

          // Update current organization if it still exists
          if (currentOrganization) {
            const updatedCurrent = orgs.find(
              o => o.id === currentOrganization.id
            );
            setCurrentOrganization(updatedCurrent || orgs[0] || null);
          }
        }
      } catch (error) {
        console.error('Error refreshing organizations:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const value = {
    session,
    status,
    organizations,
    currentOrganization,
    loading,
    switchOrganization,
    refreshOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    );
  }
  return context;
}

// Export the custom useSession hook
export { useSession };

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
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch organizations when user is authenticated
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (status === 'authenticated' && session?.user?.email) {
        try {
          setError(null);
          console.log('🔍 Fetching organizations for:', session.user.email);

          // Fetch both organizations and default organization in parallel
          const [orgsResponse, defaultOrgResponse] = await Promise.all([
            fetch('/api/organizations'),
            fetch('/api/user/default-organization'),
          ]);

          if (orgsResponse.ok) {
            const data = await orgsResponse.json();
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

            // Determine which organization to select
            let selectedOrg = null;

            // 1. First priority: User's default organization from database
            if (defaultOrgResponse.ok) {
              const defaultData = await defaultOrgResponse.json();
              if (defaultData.success && defaultData.defaultOrganizationId) {
                selectedOrg = orgs.find(
                  org => org.id === defaultData.defaultOrganizationId
                );
                if (selectedOrg) {
                  console.log(
                    '🎯 Using user default organization:',
                    selectedOrg.name
                  );
                  setStoredOrganizationId(selectedOrg.id); // Update localStorage to match
                }
              }
            }

            // 2. Second priority: Stored organization from localStorage
            if (!selectedOrg) {
              const storedId = getStoredOrganizationId();
              if (storedId) {
                selectedOrg = orgs.find(org => org.id === storedId);
                if (selectedOrg) {
                  console.log(
                    '💾 Found stored organization:',
                    selectedOrg.name
                  );
                }
              }
            }

            // 3. Last resort: First available organization
            if (!selectedOrg && orgs.length > 0) {
              selectedOrg = orgs[0];
              console.log(
                '🏠 Using first available organization:',
                selectedOrg.name
              );
              setStoredOrganizationId(selectedOrg.id);
            }

            setSelectedOrganization(selectedOrg);
          } else {
            console.error(
              'Failed to fetch organizations:',
              orgsResponse.status,
              orgsResponse.statusText
            );
          }
        } catch (error) {
          console.error('Error fetching organizations:', error);
          setError(error.message || 'Failed to load organizations');
          
          // Retry logic with exponential backoff
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`⏰ Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, delay);
          }
        } finally {
          setOrganizationsLoading(false);
        }
      } else if (status === 'unauthenticated') {
        console.log('🚪 User not authenticated - clearing organizations');
        setOrganizations([]);
        setSelectedOrganization(null);
        setStoredOrganizationId(null);
        setIsInitialized(true);
      }

      // Only set loading to false after both session and organizations are resolved
      if (status !== 'loading') {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [session, status, retryCount]);

  const switchOrganization = async organizationId => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      console.log('🔄 Switching to organization:', org.name);
      setSelectedOrganization(org);
      setStoredOrganizationId(organizationId);

      // Update the user's default organization in the database
      try {
        await fetch('/api/user/default-organization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organizationId }),
        });
        console.log('✅ Default organization updated in database');
      } catch (error) {
        console.warn(
          '⚠️ Failed to update default organization in database:',
          error
        );
        // Don't throw error - localStorage update still works
      }
    }
  };

  const refreshOrganizations = async () => {
    if (session?.user?.email) {
      setLoading(true);
      try {
        // Fetch both organizations and default organization
        const [orgsResponse, defaultOrgResponse] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/user/default-organization'),
        ]);

        if (orgsResponse.ok) {
          const data = await orgsResponse.json();

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

          // Determine which organization should be selected
          let updatedSelected = null;

          // 1. Check if user's default organization from database exists
          if (defaultOrgResponse.ok) {
            const defaultData = await defaultOrgResponse.json();
            if (defaultData.success && defaultData.defaultOrganizationId) {
              updatedSelected = orgs.find(
                org => org.id === defaultData.defaultOrganizationId
              );
            }
          }

          // 2. Fall back to current selected organization if it still exists
          if (!updatedSelected && selectedOrganization) {
            updatedSelected = orgs.find(o => o.id === selectedOrganization.id);
          }

          // 3. Fall back to first organization
          if (!updatedSelected && orgs.length > 0) {
            updatedSelected = orgs[0];
          }

          setSelectedOrganization(updatedSelected);
          if (updatedSelected) {
            setStoredOrganizationId(updatedSelected.id);
          }
        }
      } catch (error) {
        console.error('Error refreshing organizations:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const retryFetch = () => {
    setRetryCount(0);
    setError(null);
    setLoading(true);
    setIsInitialized(false);
  };

  // Calculate overall loading state
  const isLoading = status === 'loading' || (status === 'authenticated' && (!isInitialized || organizationsLoading));

  const value = {
    session,
    status,
    organizations,
    selectedOrganization,
    loading: isLoading,
    organizationsLoading,
    error,
    isInitialized,
    switchOrganization,
    refreshOrganizations,
    retryFetch,
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

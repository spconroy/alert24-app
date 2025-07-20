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
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(null);

  // Fetch organizations when user is authenticated
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (status === 'authenticated' && session?.user?.email) {
        try {
          setError(null);
          setNetworkError(false);
          setOrganizationsLoading(true);
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
            setLastSuccessfulFetch(Date.now());
            setRetryCount(0); // Reset retry count on successful fetch
            cacheOrganizations(orgs); // Cache the organizations data

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
          
          // Determine if this is a network error
          const isNetworkError = error.name === 'TypeError' || 
                                error.message.includes('fetch') || 
                                error.message.includes('network');
          
          setNetworkError(isNetworkError);
          setError(error.message || 'Failed to load organizations');
          
          // Try to use cached data if network error
          if (isNetworkError) {
            const cachedOrgs = getCachedOrganizations();
            if (cachedOrgs && cachedOrgs.length > 0) {
              console.log('📦 Using cached organizations data');
              setOrganizations(cachedOrgs);
              
              // Still try to select an organization from cache
              let selectedOrg = null;
              const storedId = getStoredOrganizationId();
              if (storedId) {
                selectedOrg = cachedOrgs.find(org => org.id === storedId);
              }
              if (!selectedOrg && cachedOrgs.length > 0) {
                selectedOrg = cachedOrgs[0];
                setStoredOrganizationId(selectedOrg.id);
              }
              setSelectedOrganization(selectedOrg);
            }
            
            // Only retry on network errors, not on authentication/authorization errors
            if (retryCount < 3) {
              const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              console.log(`⏰ Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
              }, delay);
            }
          } else {
            console.log('🚫 Not retrying - authentication/authorization error');
          }
        } finally {
          setOrganizationsLoading(false);
          setIsInitialized(true);
        }
      } else if (status === 'unauthenticated') {
        console.log('🚪 User not authenticated - clearing organizations');
        setOrganizations([]);
        setSelectedOrganization(null);
        setStoredOrganizationId(null);
        setOrganizationsLoading(false);
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
    if (!org) {
      throw new Error('Organization not found');
    }

    console.log('🔄 Switching to organization:', org.name);
    
    // Optimistically update the UI first
    const previousOrg = selectedOrganization;
    setSelectedOrganization(org);
    setStoredOrganizationId(organizationId);

    try {
      // Update the user's default organization in the database
      const response = await fetch('/api/user/default-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update default organization: ${response.statusText}`);
      }

      console.log('✅ Default organization updated in database');
      
      // Dispatch a custom event to notify other components of the organization change
      window.dispatchEvent(new CustomEvent('organizationChanged', {
        detail: { 
          newOrganization: org,
          previousOrganization: previousOrg
        }
      }));
      
    } catch (error) {
      console.error('❌ Failed to update default organization in database:', error);
      
      // Revert UI changes on database failure
      setSelectedOrganization(previousOrg);
      setStoredOrganizationId(previousOrg?.id || null);
      
      throw error; // Re-throw to let NavBar handle the error
    }
  };

  const refreshOrganizations = async () => {
    if (session?.user?.email) {
      setLoading(true);
      setOrganizationsLoading(true);
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
        setOrganizationsLoading(false);
      }
    }
  };

  const retryFetch = () => {
    console.log('🔄 Manual retry triggered');
    setRetryCount(0);
    setError(null);
    setNetworkError(false);
    setLoading(true);
    setOrganizationsLoading(true);
    setIsInitialized(false);
  };
  
  // Function to check if we should use cached data during offline scenarios
  const getCachedOrganizations = () => {
    try {
      const cached = localStorage.getItem('cachedOrganizations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cached data if it's less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to read cached organizations:', error);
    }
    return null;
  };
  
  // Function to cache organizations data
  const cacheOrganizations = (orgs) => {
    try {
      localStorage.setItem('cachedOrganizations', JSON.stringify({
        data: orgs,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache organizations:', error);
    }
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
    networkError,
    isInitialized,
    lastSuccessfulFetch,
    retryCount,
    switchOrganization,
    refreshOrganizations,
    retryFetch,
    getCachedOrganizations,
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

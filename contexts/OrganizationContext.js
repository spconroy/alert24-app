'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const OrganizationContext = createContext();

// Utility functions for localStorage operations
const getStoredOrganizationId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('selectedOrganizationId');
    }
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
  }
  return null;
};

const setStoredOrganizationId = orgId => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (orgId) {
        localStorage.setItem('selectedOrganizationId', orgId);
        console.log('✅ Saved to localStorage:', orgId);
        return true;
      } else {
        localStorage.removeItem('selectedOrganizationId');
        console.log('🗑️ Removed from localStorage');
        return true;
      }
    }
  } catch (error) {
    console.warn('Failed to write to localStorage:', error);
  }
  return false;
};

export function OrganizationProvider({ children }) {
  const { data: session, status } = useSession();
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isClient, setIsClient] = useState(false);

  // Client-side mounting detection
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Additional restoration check when client is ready and organizations are available
  useEffect(() => {
    if (isClient && organizations.length > 0 && !selectedOrganization) {
      console.log('🔍 Client-side restoration check...');
      const savedOrgId = getStoredOrganizationId();
      if (savedOrgId) {
        const orgToRestore = organizations.find(org => org.id === savedOrgId);
        if (orgToRestore) {
          console.log(
            '🔄 Client-side restoration successful:',
            orgToRestore.name
          );
          setSelectedOrganization(orgToRestore);
        } else {
          console.log(
            '⚠️ Saved organization no longer available, clearing storage'
          );
          setStoredOrganizationId(null);
        }
      }
    }
  }, [isClient, organizations, selectedOrganization]);

  // Fetch organizations when user session is available
  useEffect(() => {
    console.log(
      '🔄 OrganizationContext:',
      session?.user?.email || 'no session',
      `[${status}]`
    );

    if (session && status === 'authenticated') {
      fetchOrganizations();
    } else if (status === 'unauthenticated') {
      // Only clear when user is explicitly unauthenticated (logged out)
      console.log('🚪 User logged out - clearing organizations');
      setOrganizations([]);
      setSelectedOrganization(null);
      // Clear localStorage when user logs out
      setStoredOrganizationId(null);
    }
    // If status is 'loading', don't clear anything - preserve localStorage
  }, [session, status]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      // API now handles authentication internally via session
      const url = '/api/organizations';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        setOrganizations(orgs);

        // Try to restore selected organization from localStorage
        let orgToSelect = null;
        const savedOrgId = getStoredOrganizationId();
        console.log(
          '🔍 Checking localStorage for saved organization:',
          savedOrgId
        );
        if (savedOrgId) {
          orgToSelect = orgs.find(org => org.id === savedOrgId);
          if (orgToSelect) {
            console.log(
              '🎯 Found matching organization for restoration:',
              orgToSelect.name
            );
          } else {
            console.log(
              '⚠️ Saved organization ID not found in current organizations, clearing localStorage'
            );
            setStoredOrganizationId(null);
          }
        }

        // Fallback selection logic
        if (orgToSelect) {
          // Restore from localStorage
          console.log('✅ Restored organization:', orgToSelect.name);
          setSelectedOrganization(orgToSelect);
        } else if (orgs.length === 1) {
          // Auto-select if only one organization
          const singleOrg = orgs[0];
          console.log('🔄 Auto-selecting single organization:', singleOrg.name);
          setSelectedOrganization(singleOrg);
          // Save to localStorage
          setStoredOrganizationId(singleOrg.id);
        } else if (orgs.length === 0) {
          console.log('📭 No organizations available');
          setSelectedOrganization(null);
        } else {
          console.log(
            '🤔 Multiple organizations available, waiting for user selection'
          );
        }
        // For multiple orgs with no saved selection, let user choose
      } else {
        console.error(
          'Failed to fetch organizations:',
          response.status,
          response.statusText
        );
        setError('Failed to fetch organizations');
        // Don't break the app - set empty organizations
        setOrganizations([]);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err.message);
      // Don't break the app - set empty organizations
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const selectOrganization = organization => {
    console.log('💾 Selecting organization:', organization?.name || 'none');
    setSelectedOrganization(organization);

    // Save to localStorage for persistence across page refreshes
    setStoredOrganizationId(organization?.id || null);
  };

  const value = {
    selectedOrganization,
    organizations,
    loading,
    error,
    selectOrganization,
    refreshOrganizations: fetchOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    );
  }
  return context;
}

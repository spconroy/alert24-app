'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const { data: session, status } = useSession();
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedOrganizationId');
      }
    }
    // If status is 'loading', don't clear anything - preserve localStorage
  }, [session, status]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        setOrganizations(orgs);

        // Try to restore selected organization from localStorage
        let orgToSelect = null;
        if (typeof window !== 'undefined') {
          const savedOrgId = localStorage.getItem('selectedOrganizationId');
          console.log(
            '🔍 Checking localStorage for saved organization:',
            savedOrgId
          );
          if (savedOrgId) {
            orgToSelect = orgs.find(org => org.id === savedOrgId);
          }
        }

        // Fallback selection logic
        if (orgToSelect) {
          // Restore from localStorage
          console.log('✅ Restored organization:', orgToSelect.name);
          setSelectedOrganization(orgToSelect);
        } else if (orgs.length === 1) {
          // Auto-select if only one organization
          setSelectedOrganization(orgs[0]);
          // Save to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedOrganizationId', orgs[0].id);
          }
        } else if (orgs.length === 0) {
          setSelectedOrganization(null);
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
    if (typeof window !== 'undefined') {
      if (organization) {
        localStorage.setItem('selectedOrganizationId', organization.id);
      } else {
        localStorage.removeItem('selectedOrganizationId');
      }
    }
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

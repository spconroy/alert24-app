'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import OrganizationList from '../../components/OrganizationList';
import CreateOrganizationForm from '../../components/CreateOrganizationForm';
import OrganizationMembers from '../../components/OrganizationMembers';
import Button from '@mui/material/Button';
import React, { useState, useRef, useEffect } from 'react';
import StatusPageList from '../../components/StatusPageList';
import CreateStatusPageForm from '../../components/CreateStatusPageForm';
import StatusPageServices from '../../components/StatusPageServices';
import Alert from '@mui/material/Alert';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedStatusPage, setSelectedStatusPage] = useState(null);
  const [showCreateStatusPage, setShowCreateStatusPage] = useState(false);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [hasOrgs, setHasOrgs] = useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  const statusPageListRef = useRef();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get URL parameters
  const urlOrgId = searchParams.get('org');
  const urlStatusPageId = searchParams.get('statusPage');

  // Check if user has organizations and auto-show create form if none
  useEffect(() => {
    if (orgsLoaded && !hasOrgs && !showCreateOrg) {
      setShowCreateOrg(true);
    }
  }, [orgsLoaded, hasOrgs, showCreateOrg]);

  // Handle status page selection from URL when org is selected
  useEffect(() => {
    if (selectedOrg && urlStatusPageId && !selectedStatusPage && urlParamsProcessed) {
      // Fetch status pages for the selected org and find the target status page
      const fetchAndSelectStatusPage = async () => {
        try {
          const response = await fetch(`/api/status-pages?org_id=${selectedOrg.id}`);
          if (response.ok) {
            const data = await response.json();
            const statusPages = data.statusPages || [];
            const targetStatusPage = statusPages.find(page => page.id === urlStatusPageId);
            if (targetStatusPage) {
              setSelectedStatusPage(targetStatusPage);
              // Clean up URL parameters after successful navigation
              router.replace('/settings', { scroll: false });
            }
          }
        } catch (error) {
          console.error('Error fetching status pages:', error);
        }
      };
      
      fetchAndSelectStatusPage();
    }
  }, [selectedOrg, urlStatusPageId, selectedStatusPage, urlParamsProcessed]);

  const handleOrgsLoaded = (organizations) => {
    setOrgsLoaded(true);
    setHasOrgs(organizations && organizations.length > 0);
    
    // Handle URL parameters for direct navigation
    if (urlOrgId && organizations && organizations.length > 0 && !urlParamsProcessed) {
      const targetOrg = organizations.find(org => org.id === urlOrgId);
      if (targetOrg) {
        setSelectedOrg(targetOrg);
        setUrlParamsProcessed(true);
        return; // Skip auto-select logic below
      }
    }
    
    // Auto-select organization if there's only one (and no URL params)
    if (organizations && organizations.length === 1 && !selectedOrg && !urlOrgId) {
      setSelectedOrg(organizations[0]);
    }
  };

  return (
    <Box maxWidth={700} mx="auto" mt={6} p={3}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      {!selectedOrg && orgsLoaded && hasOrgs && (
        <Box my={4}>
          <Alert severity="info">
            Please select an organization to manage its members and status pages.
          </Alert>
        </Box>
      )}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Organizations
        </Typography>
        {showCreateOrg ? (
          <CreateOrganizationForm 
            onSuccess={() => { 
              setShowCreateOrg(false); 
              setOrgsLoaded(false); // Reset to reload orgs
              window.location.reload(); 
            }} 
            onBack={() => setShowCreateOrg(false)} 
          />
        ) : (
          <>
            <OrganizationList 
              onCreateNew={() => setShowCreateOrg(true)} 
              onSelectOrg={setSelectedOrg}
              onOrgsLoaded={handleOrgsLoaded}
              selectedOrg={selectedOrg}
            />
            {selectedOrg && (
              <Box mt={2}>
                <Alert severity="success">
                  Currently managing: <strong>{selectedOrg.name}</strong>
                  {orgsLoaded && hasOrgs && !showCreateOrg && (
                    <span> - Click another organization above to switch</span>
                  )}
                </Alert>
              </Box>
            )}
          </>
        )}
        {selectedOrg && (
          <>
            <OrganizationMembers orgId={selectedOrg.id} />
            <Box mt={6}>
              <Typography variant="h5" gutterBottom>
                Status Pages
              </Typography>
              {!selectedStatusPage ? (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ mb: 2 }}
                    onClick={() => setShowCreateStatusPage(true)}
                  >
                    Create Status Page
                  </Button>
                  <StatusPageList 
                    ref={statusPageListRef} 
                    orgId={selectedOrg.id}
                    onSelectStatusPage={setSelectedStatusPage}
                  />
                  {showCreateStatusPage && (
                    <CreateStatusPageForm
                      orgId={selectedOrg.id}
                      onSuccess={() => {
                        setShowCreateStatusPage(false);
                        statusPageListRef.current?.fetchStatusPages();
                      }}
                      onCancel={() => setShowCreateStatusPage(false)}
                    />
                  )}
                </>
              ) : (
                <Box>
                  <Button
                    variant="outlined"
                    sx={{ mb: 2 }}
                    onClick={() => setSelectedStatusPage(null)}
                  >
                    ← Back to Status Pages
                  </Button>
                  <StatusPageServices statusPage={selectedStatusPage} />
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
} 
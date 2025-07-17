'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function DebugMonitoringPage() {
  const [debugData, setDebugData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { selectedOrganization, organizations, session } = useOrganization();

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    const results = {};

    try {
      // Check session
      results.session = {
        exists: !!session,
        email: session?.user?.email,
        user: session?.user,
      };

      // Check organization context
      results.organizationContext = {
        selectedOrganization,
        organizations: organizations || [],
        organizationCount: organizations?.length || 0,
      };

      // Test monitoring API without org filter
      try {
        const responseAll = await fetch('/api/monitoring');
        results.monitoringApiAll = {
          status: responseAll.status,
          ok: responseAll.ok,
          data: responseAll.ok
            ? await responseAll.json()
            : await responseAll.text(),
        };
      } catch (err) {
        results.monitoringApiAll = { error: err.message };
      }

      // Test monitoring API with org filter
      if (selectedOrganization?.id) {
        try {
          const responseOrg = await fetch(
            `/api/monitoring?organization_id=${selectedOrganization.id}`
          );
          results.monitoringApiWithOrg = {
            status: responseOrg.status,
            ok: responseOrg.ok,
            data: responseOrg.ok
              ? await responseOrg.json()
              : await responseOrg.text(),
          };
        } catch (err) {
          results.monitoringApiWithOrg = { error: err.message };
        }
      }

      // Test organizations API
      try {
        const orgResponse = await fetch('/api/organizations');
        results.organizationsApi = {
          status: orgResponse.status,
          ok: orgResponse.ok,
          data: orgResponse.ok
            ? await orgResponse.json()
            : await orgResponse.text(),
        };
      } catch (err) {
        results.organizationsApi = { error: err.message };
      }

      setDebugData(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      runDiagnostics();
    }
  }, [session, selectedOrganization]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Monitoring Debug Page
      </Typography>

      <Button
        variant="contained"
        onClick={runDiagnostics}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Run Diagnostics'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {Object.keys(debugData).length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Debug Results
            </Typography>
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '16px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
              }}
            >
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

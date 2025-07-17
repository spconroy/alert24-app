'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicStatusPage from '../../../components/PublicStatusPage';
import { Box, CircularProgress, Alert } from '@mui/material';
import { notFound } from 'next/navigation';

export const runtime = 'edge';

export default function StatusPageView() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/status-pages/public/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
            return;
          }
          throw new Error(
            `Failed to fetch status page: ${response.statusText}`
          );
        }

        const fetchedData = await response.json();
        if (fetchedData.success) {
          setData({
            statusPage: fetchedData.statusPage,
            services: fetchedData.services,
            statusUpdates: fetchedData.statusUpdates,
          });
        } else {
          throw new Error(
            fetchedData.error || 'Failed to fetch status page data'
          );
        }
      } catch (err) {
        console.error('Error fetching status page:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchData();
    }
  }, [slug]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <PublicStatusPage
      statusPage={data.statusPage}
      services={data.services}
      statusUpdates={data.statusUpdates}
    />
  );
}

// Note: generateMetadata removed due to "use client" conflict
// Client components cannot export generateMetadata in Next.js
// The page will use default metadata from the layout

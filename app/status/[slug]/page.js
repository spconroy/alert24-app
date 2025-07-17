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

export async function generateMetadata({ params }) {
  const { slug } = params;

  try {
    // For metadata generation, we need to use fetch with the full URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/status-pages/public/${slug}`);

    if (!response.ok) {
      return {
        title: 'Status Page Not Found',
      };
    }

    const data = await response.json();

    if (!data.success || !data.statusPage) {
      return {
        title: 'Status Page Not Found',
      };
    }

    const { statusPage } = data;

    return {
      title: `${statusPage.name} - Status`,
      description:
        statusPage.description ||
        `Current status of ${statusPage.name} services`,
      openGraph: {
        title: `${statusPage.name} - Status`,
        description:
          statusPage.description ||
          `Current status of ${statusPage.name} services`,
        type: 'website',
      },
      robots: {
        index: statusPage.is_public,
        follow: statusPage.is_public,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Status Page',
    };
  }
}

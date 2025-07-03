'use client';
import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';

export default function AuthStatus() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'loading') {
    return <Typography>Loading...</Typography>;
  }

  if (!session) {
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      setLoading(false);
      if (res?.error) {
        setError(res.error);
      }
    };

    return (
      <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2} width={300}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          fullWidth
        />
        {error && <Typography color="error">{error}</Typography>}
        <Button type="submit" variant="contained" color="primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Avatar src={session.user?.image} alt={session.user?.name} />
      <Typography>{session.user?.name || session.user?.email}</Typography>
      <Button variant="outlined" color="secondary" onClick={() => signOut()}>
        Sign out
      </Button>
    </Box>
  );
} 
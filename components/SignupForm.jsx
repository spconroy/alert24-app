import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default function SignupForm({ onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Signup failed');
    } else {
      setSuccess(true);
      setName('');
      setEmail('');
      setPassword('');
      if (onSuccess) onSuccess(data.user);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2} width={300}>
      <Typography variant="h5" component="h2" gutterBottom>
        Sign Up
      </Typography>
      <TextField
        label="Name"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        fullWidth
      />
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
      {success && <Typography color="primary">Signup successful! You can now log in.</Typography>}
      <Button type="submit" variant="contained" color="primary" disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </Button>
    </Box>
  );
} 
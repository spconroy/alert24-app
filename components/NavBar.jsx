'use client';
import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningIcon from '@mui/icons-material/Warning';
import MonitorIcon from '@mui/icons-material/Monitor';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpIcon from '@mui/icons-material/Help';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BugReportIcon from '@mui/icons-material/BugReport';
import PaymentIcon from '@mui/icons-material/Payment';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization, useSession } from '@/contexts/OrganizationContext';

export default function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { currentOrganization, organizations, loading, switchOrganization } =
    useOrganization();

  const [defaultOrganizationId, setDefaultOrganizationId] = useState(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [incidentMenuAnchor, setIncidentMenuAnchor] = useState(null);
  const [monitoringMenuAnchor, setMonitoringMenuAnchor] = useState(null);

  // Fetch default organization when session is available
  useEffect(() => {
    if (session) {
      fetchDefaultOrganization();
    }
  }, [session]);

  const fetchDefaultOrganization = async () => {
    try {
      const response = await fetch('/api/user/default-organization');
      if (response.ok) {
        const data = await response.json();
        if (data.hasDefault) {
          setDefaultOrganizationId(data.defaultOrganization.id);
        }
      }
    } catch (error) {
      console.error('Error fetching default organization:', error);
    }
  };

  const handleSetDefault = async (organizationId, isDefault) => {
    if (settingDefault) return;

    setSettingDefault(true);
    try {
      if (isDefault) {
        const response = await fetch('/api/user/default-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        });

        if (response.ok) {
          setDefaultOrganizationId(organizationId);
        }
      } else {
        const response = await fetch('/api/user/default-organization', {
          method: 'DELETE',
        });

        if (response.ok) {
          setDefaultOrganizationId(null);
        }
      }
    } catch (error) {
      console.error('Error setting default organization:', error);
    } finally {
      setSettingDefault(false);
    }
  };

  const handleOrganizationChange = organizationId => {
    switchOrganization(organizationId);
  };

  // Custom sign in function
  const handleSignIn = () => {
    window.location.href = '/api/auth/google/signin';
  };

  // Custom sign out function
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Handle menu operations
  const handleIncidentMenuOpen = event => {
    setIncidentMenuAnchor(event.currentTarget);
  };

  const handleMonitoringMenuOpen = event => {
    setMonitoringMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setIncidentMenuAnchor(null);
    setMonitoringMenuAnchor(null);
  };

  // Show loading state only when session status is loading AND organizations are loading
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Alert24
          </Typography>
          <CircularProgress size={24} color="inherit" />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Loading...
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Alert24
        </Typography>

        {status === 'authenticated' && session ? (
          <>
            {/* Organization Selector with Enhanced Features */}
            {organizations.length > 0 && (
              <FormControl sx={{ mr: 2, minWidth: 220 }}>
                <InputLabel
                  id="organization-select-label"
                  sx={{ color: 'white' }}
                >
                  Organization
                </InputLabel>
                <Select
                  labelId="organization-select-label"
                  value={currentOrganization?.id || ''}
                  onChange={e => handleOrganizationChange(e.target.value)}
                  label="Organization"
                  size="small"
                  sx={{
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                    '& .MuiSvgIcon-root': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'white' },
                  }}
                  renderValue={selected => {
                    const org = organizations.find(o => o.id === selected);
                    return (
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {defaultOrganizationId === selected && (
                          <StarIcon sx={{ fontSize: 16, color: '#FFD700' }} />
                        )}
                        {org?.name || 'Select Organization'}
                      </Box>
                    );
                  }}
                >
                  {organizations.map(org => (
                    <MenuItem key={org.id} value={org.id}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          {org.name}
                        </Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={defaultOrganizationId === org.id}
                              onChange={e => {
                                e.stopPropagation();
                                handleSetDefault(org.id, e.target.checked);
                              }}
                              icon={<StarBorderIcon />}
                              checkedIcon={
                                <StarIcon sx={{ color: '#FFD700' }} />
                              }
                              size="small"
                              disabled={settingDefault}
                            />
                          }
                          label=""
                          sx={{ margin: 0 }}
                          onClick={e => e.stopPropagation()}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Enhanced Navigation Menu with Dropdowns */}
            <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
              {/* Dashboard */}
              <Button
                component={Link}
                href="/"
                color="inherit"
                startIcon={<DashboardIcon />}
                sx={{
                  backgroundColor:
                    pathname === '/' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Dashboard
              </Button>

              {/* Incidents Dropdown */}
              <Button
                color="inherit"
                startIcon={<WarningIcon />}
                endIcon={<KeyboardArrowDownIcon />}
                onClick={handleIncidentMenuOpen}
                sx={{
                  backgroundColor: pathname.startsWith('/incidents')
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Incidents
              </Button>
              <Menu
                anchorEl={incidentMenuAnchor}
                open={Boolean(incidentMenuAnchor)}
                onClose={handleMenuClose}
                MenuListProps={{ 'aria-labelledby': 'incidents-button' }}
              >
                <MenuItem
                  component={Link}
                  href="/incidents"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <WarningIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>All Incidents</ListItemText>
                </MenuItem>
                <MenuItem
                  component={Link}
                  href="/incidents/new"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <WarningIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Create Incident</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                  component={Link}
                  href="/escalation-policies"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <EscalatorWarningIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Escalation Policies</ListItemText>
                </MenuItem>
              </Menu>

              {/* Monitoring Dropdown */}
              <Button
                color="inherit"
                startIcon={<MonitorIcon />}
                endIcon={<KeyboardArrowDownIcon />}
                onClick={handleMonitoringMenuOpen}
                sx={{
                  backgroundColor: pathname.startsWith('/monitoring')
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Monitoring
              </Button>
              <Menu
                anchorEl={monitoringMenuAnchor}
                open={Boolean(monitoringMenuAnchor)}
                onClose={handleMenuClose}
                MenuListProps={{ 'aria-labelledby': 'monitoring-button' }}
              >
                <MenuItem
                  component={Link}
                  href="/monitoring"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <MonitorIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>All Checks</ListItemText>
                </MenuItem>
                <MenuItem
                  component={Link}
                  href="/monitoring/new"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <MonitorIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Create Check</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                  component={Link}
                  href="/status-pages"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <PublicIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Status Pages</ListItemText>
                </MenuItem>
              </Menu>

              {/* On-Call */}
              <Button
                component={Link}
                href="/on-call"
                color="inherit"
                startIcon={<PeopleIcon />}
                sx={{
                  backgroundColor: pathname.startsWith('/on-call')
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                On-Call
              </Button>
            </Box>

            {/* Enhanced User Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Settings Icon */}
              <Tooltip title="Settings">
                <IconButton
                  component={Link}
                  href="/settings"
                  color="inherit"
                  size="small"
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>

              {/* Billing Icon */}
              <Tooltip title="Billing">
                <IconButton
                  component={Link}
                  href="/billing"
                  color="inherit"
                  size="small"
                >
                  <PaymentIcon />
                </IconButton>
              </Tooltip>

              {/* Debug Icon (Development) */}
              {process.env.NODE_ENV === 'development' && (
                <Tooltip title="Debug">
                  <IconButton
                    component={Link}
                    href="/debug"
                    color="inherit"
                    size="small"
                  >
                    <BugReportIcon />
                  </IconButton>
                </Tooltip>
              )}

              {/* User Profile Section */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}
              >
                <Avatar
                  src={session.user?.image}
                  sx={{ width: 32, height: 32 }}
                >
                  {session.user?.name?.charAt(0)}
                </Avatar>
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.user?.name}
                </Typography>
                <Button
                  color="inherit"
                  variant="outlined"
                  size="small"
                  onClick={handleSignOut}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    },
                    ml: 1,
                  }}
                >
                  Sign out
                </Button>
              </Box>
            </Box>
          </>
        ) : (
          <Button
            color="primary"
            variant="contained"
            size="small"
            onClick={handleSignIn}
          >
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

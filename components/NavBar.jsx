'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization, useSession } from '@/contexts/OrganizationContext';

// Material UI Components
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
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Material UI Icons
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BugReportIcon from '@mui/icons-material/BugReport';
import PaymentIcon from '@mui/icons-material/Payment';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BusinessIcon from '@mui/icons-material/Business';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

export default function NavBar() {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { data: session, status } = useSession();
  const { selectedOrganization, organizations, loading, switchOrganization } =
    useOrganization();

  const [defaultOrganizationId, setDefaultOrganizationId] = useState(null);
  const [settingDefault, setSettingDefault] = useState(false);

  // Menu states
  const [incidentMenuAnchor, setIncidentMenuAnchor] = useState(null);
  const [monitoringMenuAnchor, setMonitoringMenuAnchor] = useState(null);
  const [toolsMenuAnchor, setToolsMenuAnchor] = useState(null);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
      const response = await fetch('/api/user/default-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: isDefault ? organizationId : null,
        }),
      });

      if (response.ok) {
        setDefaultOrganizationId(isDefault ? organizationId : null);
      }
    } catch (error) {
      console.error('❌ Error setting default organization:', error);
    } finally {
      setSettingDefault(false);
    }
  };

  const handleOrganizationChange = organizationId => {
    switchOrganization(organizationId);
  };

  const handleSignIn = () => {
    window.location.href = '/api/auth/google/signin';
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Menu handlers
  const handleIncidentMenuOpen = event =>
    setIncidentMenuAnchor(event.currentTarget);
  const handleMonitoringMenuOpen = event =>
    setMonitoringMenuAnchor(event.currentTarget);
  const handleToolsMenuOpen = event => setToolsMenuAnchor(event.currentTarget);
  const handleOrgMenuOpen = event => setOrgMenuAnchor(event.currentTarget);

  const handleMenuClose = () => {
    setIncidentMenuAnchor(null);
    setMonitoringMenuAnchor(null);
    setToolsMenuAnchor(null);
    setOrgMenuAnchor(null);
  };

  const toggleMobileDrawer = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  // Navigation items for mobile drawer
  const navigationItems = [
    { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
    { label: 'Incidents', href: '/incidents', icon: <WarningIcon /> },
    { label: 'Monitoring', href: '/monitoring', icon: <MonitorIcon /> },
    { label: 'Analytics', href: '/analytics', icon: <AnalyticsIcon /> },
    { label: 'Status Pages', href: '/status-pages', icon: <PublicIcon /> },
    { label: 'Teams', href: '/teams', icon: <PeopleIcon /> },
    { label: 'On-Call', href: '/on-call', icon: <PeopleIcon /> },
    {
      label: 'Escalation Policies',
      href: '/escalation-policies',
      icon: <EscalatorWarningIcon />,
    },
  ];

  // Show loading state
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Alert24
          </Typography>
          <CircularProgress size={20} color="inherit" />
        </Toolbar>
      </AppBar>
    );
  }

  // Mobile Drawer Component
  const MobileDrawer = (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={toggleMobileDrawer}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Alert24
        </Typography>

        {/* User Profile Section in Drawer */}
        {session && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              p: 2,
              backgroundColor: 'grey.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={session.user?.image}
                sx={{
                  width: 40,
                  height: 40,
                  border: session.user?.image
                    ? '2px solid rgba(76, 175, 80, 0.3)'
                    : 'none',
                }}
              >
                {session.user?.name?.charAt(0)}
              </Avatar>
              {session.user?.image && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    backgroundColor: 'success.main',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    border: '1px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'white',
                      borderRadius: '50%',
                    }}
                  />
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {session.user?.name?.split(' ')[0]}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block' }}
              >
                {session.user?.image ? 'Google Profile' : 'Default Avatar'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Organization Selector in Drawer */}
        {organizations.length > 0 && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Organization</InputLabel>
            <Select
              value={selectedOrganization?.id || ''}
              onChange={e => handleOrganizationChange(e.target.value)}
              label="Organization"
              size="small"
            >
              {organizations.map(org => (
                <MenuItem key={org.id} value={org.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {defaultOrganizationId === org.id && (
                      <StarIcon sx={{ fontSize: 16, color: '#FFD700' }} />
                    )}
                    {org.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      <Divider />

      <List>
        {navigationItems.map(item => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              component={Link}
              href={item.href}
              onClick={toggleMobileDrawer}
              selected={
                pathname === item.href || pathname.startsWith(item.href + '/')
              }
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <List>
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            href="/profile"
            onClick={toggleMobileDrawer}
          >
            <ListItemIcon>
              <PersonIcon />
            </ListItemIcon>
            <ListItemText primary="Profile" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            href="/settings"
            onClick={toggleMobileDrawer}
          >
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            href="/billing"
            onClick={toggleMobileDrawer}
          >
            <ListItemIcon>
              <PaymentIcon />
            </ListItemIcon>
            <ListItemText primary="Billing" />
          </ListItemButton>
        </ListItem>
        {(process.env.NODE_ENV === 'development' ||
          session?.user?.email?.endsWith('@inventivehq.com')) && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              href="/debug"
              onClick={toggleMobileDrawer}
            >
              <ListItemIcon>
                <BugReportIcon />
              </ListItemIcon>
              <ListItemText primary="Debug" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Drawer>
  );

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 },
                mr: { xs: 1, md: 4 },
              }}
            >
              Alert24
            </Typography>
          </Link>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {status === 'authenticated' && session ? (
            <>
              {/* Desktop Navigation */}
              {!isMobile && (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3 }}
                >
                  {/* Organization Selector - Compact */}
                  {organizations.length > 0 && (
                    <Tooltip title="Switch Organization">
                      <Button
                        onClick={handleOrgMenuOpen}
                        color="inherit"
                        startIcon={<BusinessIcon />}
                        endIcon={<KeyboardArrowDownIcon />}
                        sx={{
                          textTransform: 'none',
                          maxWidth: 160,
                          '& .MuiButton-startIcon': { mr: 0.5 },
                        }}
                      >
                        <Box
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {selectedOrganization?.name || 'Select Org'}
                        </Box>
                      </Button>
                    </Tooltip>
                  )}

                  {/* Primary Navigation */}
                  <Button
                    component={Link}
                    href="/"
                    color="inherit"
                    startIcon={<DashboardIcon />}
                    sx={{
                      backgroundColor:
                        pathname === '/'
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    Dashboard
                  </Button>

                  <Button
                    color="inherit"
                    startIcon={<WarningIcon />}
                    endIcon={<KeyboardArrowDownIcon />}
                    onClick={handleIncidentMenuOpen}
                    sx={{
                      backgroundColor:
                        pathname.startsWith('/incidents') ||
                        pathname.startsWith('/on-call') ||
                        pathname.startsWith('/escalation-policies') ||
                        pathname.startsWith('/teams')
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    Incidents
                  </Button>

                  <Button
                    color="inherit"
                    startIcon={<MonitorIcon />}
                    endIcon={<KeyboardArrowDownIcon />}
                    onClick={handleMonitoringMenuOpen}
                    sx={{
                      backgroundColor:
                        pathname.startsWith('/monitoring') ||
                        pathname.startsWith('/status-pages')
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    Monitoring
                  </Button>

                  <Button
                    component={Link}
                    href="/analytics"
                    color="inherit"
                    startIcon={<AnalyticsIcon />}
                    sx={{
                      backgroundColor: pathname.startsWith('/analytics')
                        ? 'rgba(255,255,255,0.1)'
                        : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    Analytics
                  </Button>
                </Box>
              )}

              {/* User Section */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Mobile Menu Button */}
                {isMobile && (
                  <IconButton color="inherit" onClick={toggleMobileDrawer}>
                    <MenuIcon />
                  </IconButton>
                )}

                {/* Tools Menu (Desktop Only) */}
                {!isMobile && (
                  <Tooltip title="Tools & Settings">
                    <IconButton color="inherit" onClick={handleToolsMenuOpen}>
                      <MoreVertIcon />
                    </IconButton>
                  </Tooltip>
                )}

                {/* User Profile */}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}
                >
                  <Tooltip
                    title={
                      session.user?.image ? 'Profile (Google Photo)' : 'Profile'
                    }
                  >
                    <Button
                      component={Link}
                      href="/profile"
                      color="inherit"
                      sx={{
                        textTransform: 'none',
                        minWidth: 'auto',
                        p: 0.5,
                        borderRadius: 2,
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box sx={{ position: 'relative' }}>
                          <Avatar
                            src={session.user?.image}
                            sx={{
                              width: 32,
                              height: 32,
                              border: session.user?.image
                                ? '2px solid rgba(76, 175, 80, 0.3)'
                                : 'none',
                            }}
                          >
                            {session.user?.name?.charAt(0)}
                          </Avatar>
                          {session.user?.image && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                backgroundColor: 'success.main',
                                borderRadius: '50%',
                                width: 12,
                                height: 12,
                                border: '1px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  backgroundColor: 'white',
                                  borderRadius: '50%',
                                }}
                              />
                            </Box>
                          )}
                        </Box>
                        {!isMobile && (
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 100,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: 'inherit',
                            }}
                          >
                            {session.user?.name?.split(' ')[0]}
                          </Typography>
                        )}
                      </Box>
                    </Button>
                  </Tooltip>
                  <Tooltip title="Sign out">
                    <IconButton
                      color="inherit"
                      onClick={handleSignOut}
                      size="small"
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Organization Menu */}
              <Menu
                anchorEl={orgMenuAnchor}
                open={Boolean(orgMenuAnchor)}
                onClose={handleMenuClose}
                PaperProps={{ sx: { minWidth: 220 } }}
              >
                {organizations.map(org => (
                  <MenuItem
                    key={org.id}
                    onClick={() => {
                      handleOrganizationChange(org.id);
                      handleMenuClose();
                    }}
                    selected={selectedOrganization?.id === org.id}
                  >
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
                        <BusinessIcon fontSize="small" />
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
                            checkedIcon={<StarIcon sx={{ color: '#FFD700' }} />}
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
              </Menu>

              {/* Incidents Menu */}
              <Menu
                anchorEl={incidentMenuAnchor}
                open={Boolean(incidentMenuAnchor)}
                onClose={handleMenuClose}
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
                <MenuItem
                  component={Link}
                  href="/teams"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <PeopleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Teams</ListItemText>
                </MenuItem>
                <MenuItem
                  component={Link}
                  href="/on-call"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <PeopleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>On-Call Schedules</ListItemText>
                </MenuItem>
              </Menu>

              {/* Monitoring Menu */}
              <Menu
                anchorEl={monitoringMenuAnchor}
                open={Boolean(monitoringMenuAnchor)}
                onClose={handleMenuClose}
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

              {/* Tools Menu */}
              <Menu
                anchorEl={toolsMenuAnchor}
                open={Boolean(toolsMenuAnchor)}
                onClose={handleMenuClose}
              >
                <MenuItem
                  component={Link}
                  href="/settings"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Settings</ListItemText>
                </MenuItem>
                <MenuItem
                  component={Link}
                  href="/billing"
                  onClick={handleMenuClose}
                >
                  <ListItemIcon>
                    <PaymentIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Billing</ListItemText>
                </MenuItem>
                {(process.env.NODE_ENV === 'development' ||
                  session?.user?.email?.endsWith('@inventivehq.com')) && (
                  <>
                    <Divider />
                    <MenuItem
                      component={Link}
                      href="/debug"
                      onClick={handleMenuClose}
                    >
                      <ListItemIcon>
                        <BugReportIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Debug</ListItemText>
                    </MenuItem>
                  </>
                )}
              </Menu>
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

      {/* Mobile Drawer */}
      {MobileDrawer}
    </>
  );
}

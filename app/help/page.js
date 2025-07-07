'use client';

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  InputAdornment,
  Grid,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Dashboard as DashboardIcon,
  Warning as IncidentIcon,
  Monitor as MonitorIcon,
  Schedule as ScheduleIcon,
  Business as OrgIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Lightbulb as TipIcon,
  PlayArrow as StepIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState(false);

  const handleAccordionChange = panel => (event, isExpanded) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  const helpSections = [
    {
      id: 'getting-started',
      title: '🚀 Getting Started',
      icon: <DashboardIcon />,
      description: 'New to Alert24? Start here to learn the basics.',
      content: {
        overview: `Alert24 is your comprehensive incident management platform that combines monitoring, 
        alerting, and status page functionality. Think of it as Pingdom + PagerDuty + StatusPage.io all in one.`,
        quickStart: [
          'Sign in with your Google account',
          'Create or join an organization',
          'Set up your first monitoring check',
          'Create an on-call schedule',
          'Configure escalation policies',
          'Customize your status page',
        ],
        keyFeatures: [
          'Real-time incident management',
          'Global monitoring infrastructure',
          'Smart alerting and escalation',
          'Team on-call scheduling',
          'Public status pages',
          'Multi-tenant organization support',
        ],
      },
    },
    {
      id: 'incidents',
      title: '🚨 Incident Management',
      icon: <IncidentIcon />,
      description:
        'Learn how to create, manage, and resolve incidents effectively.',
      content: {
        overview: `Incidents are the heart of Alert24. They represent any disruption to your services 
        that needs attention and resolution.`,
        creatingIncidents: [
          'Go to Incidents → Create New Incident',
          'Choose severity level (Critical, High, Medium, Low)',
          'Write a clear, descriptive title',
          'Add detailed description of the issue',
          'Assign to a team member or escalation policy',
          'Select affected services/components',
          'Add relevant tags for categorization',
        ],
        managingIncidents: [
          'Update incident status as you investigate',
          'Post timeline updates for stakeholders',
          'Escalate if not resolved within SLA',
          'Mark as resolved when fixed',
          'Add post-incident review notes',
        ],
        severityLevels: {
          Critical: 'Complete service outage affecting all users',
          High: 'Major functionality impaired for most users',
          Medium: 'Partial functionality affected for some users',
          Low: 'Minor issues with minimal user impact',
        },
      },
    },
    {
      id: 'monitoring',
      title: '📡 Monitoring Setup',
      icon: <MonitorIcon />,
      description:
        'Set up monitoring checks to detect issues before they become incidents.',
      content: {
        overview: `Monitoring checks continuously watch your services and automatically create 
        incidents when problems are detected.`,
        checkTypes: {
          'HTTP/HTTPS':
            'Monitor websites and APIs for uptime and response time',
          Ping: 'Basic connectivity checks to ensure servers are reachable',
          TCP: 'Check if specific ports are open and responding',
          'SSL Certificate': 'Monitor certificate expiration and validity',
        },
        setupSteps: [
          'Go to Monitoring → Create New Check',
          'Choose check type (HTTP, Ping, TCP, SSL)',
          'Enter the URL or IP address to monitor',
          'Set check frequency (1min to 60min intervals)',
          'Configure alerting thresholds',
          'Choose monitoring locations (global coverage)',
          'Set up notification rules',
          'Test the check before saving',
        ],
        bestPractices: [
          'Monitor critical user journeys, not just infrastructure',
          'Set realistic response time thresholds',
          'Use multiple monitoring locations for global services',
          'Create specific checks for each critical component',
          'Monitor dependencies and third-party services',
        ],
      },
    },
    {
      id: 'on-call',
      title: '👥 On-Call Schedules',
      icon: <ScheduleIcon />,
      description:
        'Manage team rotations and ensure 24/7 incident response coverage.',
      content: {
        overview: `On-call schedules ensure someone is always available to respond to incidents. 
        Team members rotate responsibility based on your configured schedule.`,
        addingResponders: [
          'Navigate to On-Call → Create New Schedule',
          'Fill in schedule details (name, description, dates)',
          'In "👥 On-Call Responders" section, use the search dropdown',
          'Type to find team members from your organization',
          'Click "Add to Rotation" to add them',
          'They appear in numbered order (#1, #2, #3...)',
          'Review the rotation preview at the bottom',
          'The first person added will be on-call when the schedule starts',
        ],
        rotationTypes: {
          Daily: 'Team members rotate every 24 hours',
          Weekly: 'Weekly rotations starting Monday',
          'Bi-weekly': 'Two-week rotation periods',
          Monthly: 'Monthly rotations on the 1st',
          Custom: 'Set your own rotation interval in hours',
        },
        troubleshooting: [
          'No team members in dropdown? Add people to your organization first',
          "Can't find someone? They need to be a member of your current organization",
          'Want to change order? Remove and re-add people in preferred sequence',
          'Only one person? Schedule will work but no rotation will occur',
        ],
      },
    },
    {
      id: 'escalation',
      title: '📈 Escalation Policies',
      icon: <SettingsIcon />,
      description:
        'Configure automated escalation rules to ensure incidents get attention.',
      content: {
        overview: `Escalation policies automatically notify additional team members if incidents 
        aren't acknowledged or resolved within specified timeframes.`,
        setupSteps: [
          'Go to Escalation Policies → Create New Policy',
          'Name your policy (e.g., "Engineering Primary Escalation")',
          'Add escalation levels (Level 1, 2, 3...)',
          'Set delay times between levels (5min, 15min, 30min)',
          'Choose notification targets for each level',
          'Configure notification methods (email, SMS, Slack)',
          'Test the policy with a sample incident',
        ],
        bestPractices: [
          'Start with the on-call person, then escalate to managers',
          "Use realistic timeframes (don't escalate too quickly)",
          'Include multiple contact methods for critical alerts',
          'Have a final escalation to senior leadership',
          'Test escalation paths regularly',
        ],
      },
    },
    {
      id: 'organizations',
      title: '🏢 Organization Management',
      icon: <OrgIcon />,
      description: 'Manage team members, roles, and organization settings.',
      content: {
        overview: `Organizations provide multi-tenant isolation. Each organization has its own 
        incidents, monitoring, schedules, and team members.`,
        memberRoles: {
          Owner:
            'Full administrative access including organization settings, name changes, and deletion. Can manage all users including other owners.',
          Admin:
            'Manage incidents, monitoring, team members, and most organization settings. Cannot modify organization name/deletion or manage owners.',
          Responder:
            'View all data, manage incidents, update service statuses, and post status updates. Cannot manage users or organization settings.',
          Stakeholder:
            'View non-public status pages and read-only access to incidents and services. Cannot make any changes to data.',
        },
        invitingMembers: [
          '1. Navigate to Organizations page and select your organization',
          '2. Scroll to "Team Members" section',
          '3. Click the blue "Invite Member" button',
          "4. Enter the colleague's email address",
          '5. Select their role (Member or Admin)',
          '6. Click "Send Invitation"',
          '7. Copy the invitation link to share manually if needed',
          '8. Track pending invitations in the "Pending Invitations" section',
        ],
        invitationDetails: {
          Expiration: 'Invitations expire after 7 days',
          Tracking: 'Monitor pending invitations and copy links to resend',
          Acceptance: 'Users must sign in to accept invitations',
          Roles: 'Choose appropriate role based on user responsibilities',
        },
        managingMembers: [
          'View all active members with their roles',
          'Monitor pending invitations and expiration dates',
          'Copy invitation links to resend manually',
          'Track who invited whom and when',
          'Remove inactive members as needed',
        ],
        troubleshooting: [
          'Invitation not received? Check spam folder and copy the link manually',
          'Wrong email address? Delete the pending invitation and create a new one',
          "User can't accept? Ensure they're signed in with the correct email",
          'Need to change role? Delete and resend with correct permissions',
        ],
      },
    },
    {
      id: 'user-roles',
      title: '👥 User Roles & Permissions',
      icon: <PersonIcon />,
      description:
        'Understanding user roles and their permissions within organizations.',
      content: {
        overview: `Alert24 uses a role-based permission system to control what users can do within 
        an organization. Each user is assigned one of four roles that determine their access level.`,
        roleTypes: {
          Owner: {
            description: 'Complete control over the organization',
            permissions: [
              'Modify organization name and settings',
              'Delete the organization',
              'Manage all users including other owners',
              'Full access to all features and data',
              'Billing and subscription management',
            ],
          },
          Admin: {
            description: 'Administrative access with some restrictions',
            permissions: [
              'Manage incidents, monitoring, and services',
              'Invite and manage team members (except owners)',
              'Configure escalation policies and schedules',
              'Access all organization data',
              'Cannot modify organization name or delete organization',
              'Cannot manage owners',
            ],
          },
          Responder: {
            description: 'Operational access for incident response',
            permissions: [
              'View all organization data',
              'Create and manage incidents',
              'Update service statuses and post messages',
              'Participate in on-call schedules',
              'Respond to alerts and escalations',
              'Cannot manage users or organization settings',
            ],
          },
          Stakeholder: {
            description: 'Read-only access for observers',
            permissions: [
              'View non-public status pages',
              'Read-only access to incidents and services',
              'View historical data and reports',
              'Subscribe to status page updates',
              'Cannot make any changes to data',
              'Ideal for external stakeholders and observers',
            ],
          },
        },
        invitationRules: [
          'Only Owners and Admins can invite new members',
          'Only Owners can invite new Admins',
          'Admins can invite Responders and Stakeholders',
          'Users can only invite roles equal to or lower than their own level',
        ],
        bestPractices: [
          "Assign the minimum role needed for each user's responsibilities",
          'Use Stakeholder role for external parties who need visibility',
          'Use Responder role for team members who handle incidents',
          'Limit Admin and Owner roles to trusted team leaders',
          'Regularly review and update user roles as responsibilities change',
        ],
      },
    },
    {
      id: 'profile',
      title: '👤 Profile & Settings',
      icon: <SettingsIcon />,
      description:
        'Manage your personal account information and notification preferences.',
      content: {
        overview: `Your profile page allows you to update personal information, set notification 
        preferences, and manage account settings for optimal incident response.`,
        accessingProfile: [
          'Click your name/avatar in the top-right corner of any page',
          'Select "Profile" from the navigation menu',
          'Or visit /profile directly',
        ],
        profileSections: {
          'Personal Information':
            'Update name, email, phone number, and timezone',
          'Notification Preferences': 'Configure email and SMS alert settings',
          'Security & Account': 'Manage Google OAuth settings and security',
        },
        notificationTypes: {
          'Email - New Incidents':
            'Receive email when new incidents are created',
          'Email - Escalations': 'Get notified when incidents escalate',
          'SMS - Critical Incidents':
            'Text alerts for critical severity incidents',
          'SMS - Escalations': 'Text notifications for escalated incidents',
        },
        importantNotes: [
          'Add a phone number to enable SMS notifications',
          'Timezone affects all date/time displays in the application',
          'Email changes require verification',
          'SMS notifications require a valid phone number format',
        ],
      },
    },
  ];

  const filteredSections = helpSections.filter(
    section =>
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(section.content)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
          📚 Alert24 Help Center
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          Everything you need to know about managing incidents, monitoring, and
          team response
        </Typography>

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search help topics..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />
      </Box>

      {/* Quick Links */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CardContent>
          <Typography
            variant="h5"
            sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}
          >
            🎯 Quick Start Guide
          </Typography>
          <Grid container spacing={2}>
            {[
              { title: 'Create Your First Incident', path: '/incidents/new' },
              { title: 'Set Up Monitoring', path: '/monitoring/new' },
              { title: 'Configure On-Call', path: '/on-call/new' },
              { title: 'Update Your Profile', path: '/profile' },
            ].map((link, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {link.title}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Help Sections */}
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        📖 Detailed Guides
      </Typography>

      {filteredSections.map(section => (
        <Accordion
          key={section.id}
          expanded={expandedSection === section.id}
          onChange={handleAccordionChange(section.id)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={2}>
              {section.icon}
              <div>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {section.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {section.description}
                </Typography>
              </div>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box sx={{ pl: 2 }}>
              {/* Overview */}
              {section.content.overview && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body1">
                    {section.content.overview}
                  </Typography>
                </Alert>
              )}

              {/* Quick Start Steps */}
              {section.content.quickStart && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <StepIcon color="primary" />
                    Quick Start Steps
                  </Typography>
                  <List dense>
                    {section.content.quickStart.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Setup Steps */}
              {section.content.setupSteps && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <StepIcon color="primary" />
                    Setup Steps
                  </Typography>
                  <List dense>
                    {section.content.setupSteps.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Adding Responders (On-Call specific) */}
              {section.content.addingResponders && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <StepIcon color="primary" />
                    How to Add Responders
                  </Typography>
                  <List dense>
                    {section.content.addingResponders.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Creating/Managing Incidents */}
              {section.content.creatingIncidents && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <StepIcon color="primary" />
                    Creating Incidents
                  </Typography>
                  <List dense>
                    {section.content.creatingIncidents.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {section.content.managingIncidents && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <SettingsIcon color="primary" />
                    Managing Incidents
                  </Typography>
                  <List dense>
                    {section.content.managingIncidents.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckIcon color="success" />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Key Features */}
              {section.content.keyFeatures && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <CheckIcon color="success" />
                    Key Features
                  </Typography>
                  <Grid container spacing={1}>
                    {section.content.keyFeatures.map((feature, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Chip
                          label={feature}
                          variant="outlined"
                          size="small"
                          sx={{ mb: 1, mr: 1 }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Best Practices */}
              {section.content.bestPractices && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <TipIcon color="warning" />
                    Best Practices
                  </Typography>
                  <List dense>
                    {section.content.bestPractices.map((practice, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <TipIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={practice} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Troubleshooting */}
              {section.content.troubleshooting && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <InfoIcon color="info" />
                    Troubleshooting
                  </Typography>
                  <List dense>
                    {section.content.troubleshooting.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <InfoIcon color="info" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Reference Information */}
              {section.content.severityLevels && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    📊 Severity Levels Reference
                  </Typography>
                  {Object.entries(section.content.severityLevels).map(
                    ([level, description]) => (
                      <Alert
                        severity={
                          level === 'Critical'
                            ? 'error'
                            : level === 'High'
                              ? 'warning'
                              : 'info'
                        }
                        sx={{ mb: 1 }}
                        key={level}
                      >
                        <Typography variant="body2">
                          <strong>{level}:</strong> {description}
                        </Typography>
                      </Alert>
                    )
                  )}
                </Box>
              )}

              {section.content.checkTypes && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    🔍 Check Types Reference
                  </Typography>
                  {Object.entries(section.content.checkTypes).map(
                    ([type, description]) => (
                      <Alert severity="info" sx={{ mb: 1 }} key={type}>
                        <Typography variant="body2">
                          <strong>{type}:</strong> {description}
                        </Typography>
                      </Alert>
                    )
                  )}
                </Box>
              )}

              {section.content.rotationTypes && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    🔄 Rotation Types Reference
                  </Typography>
                  {Object.entries(section.content.rotationTypes).map(
                    ([type, description]) => (
                      <Alert severity="info" sx={{ mb: 1 }} key={type}>
                        <Typography variant="body2">
                          <strong>{type}:</strong> {description}
                        </Typography>
                      </Alert>
                    )
                  )}
                </Box>
              )}

              {section.content.memberRoles && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    👤 Member Roles Reference
                  </Typography>
                  {Object.entries(section.content.memberRoles).map(
                    ([role, description]) => (
                      <Alert severity="info" sx={{ mb: 1 }} key={role}>
                        <Typography variant="body2">
                          <strong>{role}:</strong> {description}
                        </Typography>
                      </Alert>
                    )
                  )}
                </Box>
              )}

              {section.content.managingMembers && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <StepIcon color="primary" />
                    Managing Members
                  </Typography>
                  <List dense>
                    {section.content.managingMembers.map((step, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Footer */}
      <Box sx={{ mt: 6, p: 3, backgroundColor: 'grey.100', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          📞 Need More Help?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Can't find what you're looking for? Here are additional resources:
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                📧 Email Support
              </Typography>
              <Typography variant="body2" color="text.secondary">
                support@alert24.com
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                📖 Documentation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                docs.alert24.com
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                💬 Community
              </Typography>
              <Typography variant="body2" color="text.secondary">
                community.alert24.com
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

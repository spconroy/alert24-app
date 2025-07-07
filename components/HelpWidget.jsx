'use client';

import { useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert
} from '@mui/material';
import {
  Help as HelpIcon,
  Close as CloseIcon,
  PlayArrow as StepIcon,
  Lightbulb as TipIcon
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Contextual help based on current page
  const getContextualHelp = () => {
    if (pathname.includes('/incidents')) {
      return {
        title: '🚨 Incident Management Help',
        description: 'Learn how to manage incidents effectively',
        quickTips: [
          'Use clear, descriptive titles for incidents',
          'Update status regularly to keep stakeholders informed',
          'Escalate quickly if resolution time exceeds SLA',
          'Add timeline updates for post-incident reviews'
        ],
        guides: [
          { title: 'Creating Incidents', section: 'incidents' },
          { title: 'Escalation Policies', section: 'escalation' }
        ]
      };
    }
    
    if (pathname.includes('/monitoring')) {
      return {
        title: '📡 Monitoring Setup Help',
        description: 'Set up monitoring checks to detect issues early',
        quickTips: [
          'Monitor critical user journeys, not just infrastructure',
          'Use realistic response time thresholds',
          'Set up checks from multiple global locations',
          'Test your monitoring configuration regularly'
        ],
        guides: [
          { title: 'Monitoring Setup', section: 'monitoring' }
        ]
      };
    }
    
    if (pathname.includes('/on-call')) {
      return {
        title: '👥 On-Call Schedule Help',
        description: 'Manage team rotations and ensure 24/7 coverage',
        quickTips: [
          'Add team members to the rotation using the search dropdown',
          'The first person added will be on-call when schedule starts',
          'Remove and re-add people to change rotation order',
          'Make sure team members are in your organization first'
        ],
        guides: [
          { title: 'On-Call Schedules', section: 'on-call' }
        ]
      };
    }
    
    if (pathname.includes('/escalation-policies')) {
      return {
        title: '📈 Escalation Policy Help',
        description: 'Configure automated escalation rules',
        quickTips: [
          'Start with the on-call person, then escalate to managers',
          'Use realistic timeframes (don\'t escalate too quickly)',
          'Include multiple contact methods for critical alerts',
          'Test escalation paths regularly'
        ],
        guides: [
          { title: 'Escalation Policies', section: 'escalation' }
        ]
      };
    }
    
    // Default help for other pages
    return {
      title: '🚀 Getting Started Help',
      description: 'Welcome to Alert24! Here are some quick tips',
      quickTips: [
        'Create your first monitoring check to watch your services',
        'Set up an on-call schedule to ensure incident response',
        'Configure escalation policies for automatic notifications',
        'Build status pages to communicate with your users'
      ],
      guides: [
        { title: 'Getting Started', section: 'getting-started' },
        { title: 'Full Help Center', section: 'all' }
      ]
    };
  };

  const contextualHelp = getContextualHelp();

  return (
    <>
      {/* Floating Help Button */}
      <Fab
        color="primary"
        aria-label="help"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          '&:hover': {
            transform: 'scale(1.1)'
          }
        }}
      >
        <HelpIcon />
      </Fab>

      {/* Help Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: '400px'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {contextualHelp.title}
          </Typography>
          <Button
            onClick={() => setOpen(false)}
            color="inherit"
            size="small"
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <CloseIcon />
          </Button>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            {contextualHelp.description}
          </Alert>

          {/* Quick Tips */}
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <TipIcon color="warning" />
            Quick Tips for This Page
          </Typography>
          <List dense>
            {contextualHelp.quickTips.map((tip, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Chip label={index + 1} size="small" color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary={tip}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>

          {/* Related Guides */}
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
            <StepIcon color="primary" />
            Related Guides
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {contextualHelp.guides.map((guide, index) => (
              <Button
                key={index}
                variant="outlined"
                component={Link}
                href={guide.section === 'all' ? '/help' : `/help#${guide.section}`}
                onClick={() => setOpen(false)}
                sx={{ justifyContent: 'flex-start' }}
              >
                📖 {guide.title}
              </Button>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            component={Link}
            href="/help"
            onClick={() => setOpen(false)}
            fullWidth
          >
            📚 Open Full Help Center
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 
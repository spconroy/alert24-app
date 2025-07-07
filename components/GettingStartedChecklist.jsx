'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Button,
  Box,
  LinearProgress,
  Chip,
  Alert,
  Collapse
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as StartIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import Link from 'next/link';

export default function GettingStartedChecklist({ onClose, organizationData = null }) {
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isVisible, setIsVisible] = useState(true);

  const checklist = [
    {
      id: 'organization',
      title: 'Create or Join Organization',
      description: 'Set up your team workspace',
      link: '/organizations',
      completed: !!organizationData,
      priority: 'high'
    },
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add phone number and notification preferences',
      link: '/profile',
      completed: false, // We'd check this via API
      priority: 'high'
    },
    {
      id: 'monitoring',
      title: 'Set Up First Monitoring Check',
      description: 'Monitor your critical services',
      link: '/monitoring/new',
      completed: false, // We'd check this via API
      priority: 'high'
    },
    {
      id: 'on-call',
      title: 'Create On-Call Schedule',
      description: 'Ensure 24/7 incident response',
      link: '/on-call/new',
      completed: false,
      priority: 'high'
    },
    {
      id: 'team',
      title: 'Invite Team Members',
      description: 'Add colleagues to your organization',
      link: '/organizations',
      completed: organizationData?.members?.length > 1 || organizationData?.pendingInvitations > 0,
      priority: 'high'
    },
    {
      id: 'escalation',
      title: 'Configure Escalation Policy',
      description: 'Automate incident notifications',
      link: '/escalation-policies/new',
      completed: false,
      priority: 'medium'
    },
    {
      id: 'incident',
      title: 'Create Test Incident',
      description: 'Familiarize yourself with incident management',
      link: '/incidents/new',
      completed: false,
      priority: 'medium'
    },
    {
      id: 'status-page',
      title: 'Set Up Status Page',
      description: 'Communicate status to your users',
      link: '/organizations', // Would go to status page setup
      completed: false,
      priority: 'low'
    }
  ];

  const toggleStep = (stepId) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  const completedCount = checklist.filter(step => 
    step.completed || completedSteps.has(step.id)
  ).length;
  
  const progressPercentage = (completedCount / checklist.length) * 100;

  const highPriorityIncomplete = checklist.filter(step => 
    step.priority === 'high' && !step.completed && !completedSteps.has(step.id)
  ).length;

  if (!isVisible) return null;

  return (
    <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            🚀 Getting Started Checklist
            {completedCount === checklist.length && (
              <Chip label="Completed!" color="success" size="small" />
            )}
          </Typography>
          <Button
            onClick={() => setIsVisible(false)}
            size="small"
            color="inherit"
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            <CloseIcon />
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Complete these steps to set up your incident management platform
        </Typography>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Progress: {completedCount}/{checklist.length} steps
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progressPercentage)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progressPercentage} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* High Priority Alert */}
        {highPriorityIncomplete > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{highPriorityIncomplete} high-priority steps</strong> remaining. 
            These are essential for basic incident management.
          </Alert>
        )}

        {/* Checklist Items */}
        <List dense>
          {checklist.map((step, index) => {
            const isCompleted = step.completed || completedSteps.has(step.id);
            const priorityColor = {
              high: 'error',
              medium: 'warning', 
              low: 'info'
            }[step.priority];

            return (
              <ListItem 
                key={step.id}
                sx={{ 
                  pl: 0,
                  backgroundColor: isCompleted ? 'success.light' : 'transparent',
                  borderRadius: 1,
                  mb: 1,
                  opacity: isCompleted ? 0.8 : 1
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={isCompleted}
                    onChange={() => toggleStep(step.id)}
                    icon={<PendingIcon />}
                    checkedIcon={<CompletedIcon color="success" />}
                    disabled={step.completed} // Can't uncheck system-completed items
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          fontWeight: isCompleted ? 'normal' : 'bold'
                        }}
                      >
                        {step.title}
                      </Typography>
                      <Chip 
                        label={step.priority} 
                        size="small" 
                        color={priorityColor}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={step.description}
                />
                {!isCompleted && (
                  <Button
                    component={Link}
                    href={step.link}
                    variant="outlined"
                    size="small"
                    startIcon={<StartIcon />}
                  >
                    Start
                  </Button>
                )}
              </ListItem>
            );
          })}
        </List>

        {/* Completion Message */}
        {completedCount === checklist.length && (
          <Alert severity="success" sx={{ mt: 2 }}>
            🎉 <strong>Congratulations!</strong> You've completed the basic setup. 
            Your incident management platform is ready to use. 
            Check out the <Link href="/help">Help Center</Link> for advanced features.
          </Alert>
        )}

        {/* Action Buttons */}
        <Box display="flex" gap={2} mt={3}>
          <Button
            component={Link}
            href="/help"
            variant="outlined"
            size="small"
          >
            📚 View Full Help
          </Button>
          {highPriorityIncomplete > 0 && (
            <Button
              component={Link}
              href={checklist.find(s => s.priority === 'high' && !s.completed && !completedSteps.has(s.id))?.link}
              variant="contained"
              size="small"
            >
              Continue Setup
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
} 
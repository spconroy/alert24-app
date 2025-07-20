'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Divider,
  Tooltip,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import UserTeamSelector from './UserTeamSelector';

const DEFAULT_STEP = {
  id: `step_${Date.now()}`,
  level: 1,
  delay_minutes: 0,
  notification_channels: ['email'],
  targets: [],
  is_final: false,
  repeat_enabled: false,
  repeat_count: 1,
};

const NOTIFICATION_CHANNELS = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'sms', label: 'SMS', icon: '📱' },
  { value: 'voice', label: 'Voice Call', icon: '📞' },
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'webhook', label: 'Webhook', icon: '🔗' },
];

const EscalationStepsOrchestrator = ({
  initialSteps = [],
  onChange,
  organizationId,
  maxSteps = 10,
  disabled = false,
  repeatEscalation = false,
  maxRepeatCount = 3,
  onRepeatConfigChange,
}) => {
  const [steps, setSteps] = useState(() => {
    if (initialSteps.length === 0) {
      return [{ ...DEFAULT_STEP }];
    }
    return initialSteps.map((step, index) => ({
      id: step.id || `step_${index}_${Date.now()}`,
      level: step.level || index + 1,
      delay_minutes: step.delay_minutes || 0,
      notification_channels: step.notification_channels || ['email'],
      targets: step.targets || [],
      is_final: step.is_final || false,
      repeat_enabled: step.repeat_enabled || false,
      repeat_count: step.repeat_count || 1,
      ...step,
    }));
  });

  const [editingStep, setEditingStep] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Notify parent of changes - with loop prevention
  useEffect(() => {
    if (onChange) {
      const formattedSteps = steps.map((step, index) => ({
        ...step,
        level: index + 1,
      }));
      
      // Use a timeout to break the synchronous update cycle
      const timeoutId = setTimeout(() => {
        console.log('🔄 Notifying parent of step changes:', formattedSteps.length);
        onChange(formattedSteps);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [steps]); // Remove onChange from dependencies to prevent loop

  // Validation - moved inside useEffect to avoid recreation on every render
  useEffect(() => {
    const validateSteps = () => {
      const errors = {};
      
      steps.forEach((step, index) => {
        const stepErrors = [];
        
        if (!step.targets || step.targets.length === 0) {
          stepErrors.push('At least one target is required');
        }
        
        if (!step.notification_channels || step.notification_channels.length === 0) {
          stepErrors.push('At least one notification channel is required');
        }
        
        if (index > 0 && step.delay_minutes <= 0) {
          stepErrors.push('Escalation delay must be greater than 0 minutes');
        }
        
        if (stepErrors.length > 0) {
          errors[step.id] = stepErrors;
        }
      });
      
      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
    };

    validateSteps();
  }, [steps]);

  // Step management
  const addStep = () => {
    if (steps.length >= maxSteps) return;
    
    const newStep = {
      ...DEFAULT_STEP,
      id: `step_${Date.now()}`,
      level: steps.length + 1,
      delay_minutes: steps.length === 0 ? 0 : 15, // First step has no delay
    };
    
    setSteps(prev => [...prev, newStep]);
  };

  const removeStep = (stepId) => {
    if (steps.length <= 1) return; // Keep at least one step
    setSteps(prev => prev.filter(step => step.id !== stepId));
  };

  const updateStep = (stepId, updates) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const duplicateStep = (stepId) => {
    const stepToDuplicate = steps.find(step => step.id === stepId);
    if (!stepToDuplicate) return;
    
    const newStep = {
      ...stepToDuplicate,
      id: `step_${Date.now()}`,
      level: steps.length + 1,
    };
    
    setSteps(prev => [...prev, newStep]);
  };

  // Drag and drop
  const onDragEnd = (result) => {
    if (!result.destination || disabled) return;
    
    const items = Array.from(steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update levels after reordering
    const reorderedSteps = items.map((step, index) => ({
      ...step,
      level: index + 1,
      delay_minutes: index === 0 ? 0 : step.delay_minutes, // First step always has 0 delay
    }));
    
    setSteps(reorderedSteps);
  };

  // Step components
  const StepCard = ({ step, index, isDragging, dragHandleProps }) => {
    const hasErrors = validationErrors[step.id];
    const isFirstStep = index === 0;
    
    return (
      <Card
        sx={{
          mb: 2,
          border: hasErrors ? '2px solid #f44336' : '1px solid #e0e0e0',
          backgroundColor: isDragging ? '#f5f5f5' : 'white',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <CardContent>
          {/* Step Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              {!disabled && (
                <IconButton 
                  size="small" 
                  sx={{ 
                    cursor: 'grab',
                    pointerEvents: 'auto'
                  }}
                  {...dragHandleProps}
                  onClick={(e) => e.preventDefault()}
                >
                  <DragIcon />
                </IconButton>
              )}
              <Typography variant="h6" color="primary">
                Step {step.level}
              </Typography>
              {isFirstStep && (
                <Chip label="Initial Response" size="small" color="primary" />
              )}
              {step.is_final && (
                <Chip label="Final Escalation" size="small" color="error" />
              )}
            </Box>
          </Box>

          {/* Escalation Timing */}
          {!isFirstStep && (
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Escalates after {step.delay_minutes} minute{step.delay_minutes !== 1 ? 's' : ''}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {step.delay_minutes === 0 ? 'Immediate' : `${step.delay_minutes}m delay`}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Targets */}
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Notify ({step.targets?.length || 0} target{step.targets?.length !== 1 ? 's' : ''})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {step.targets?.map((target, idx) => (
                <Chip
                  key={idx}
                  label={target.name || target.email || 'Unknown'}
                  size="small"
                  icon={
                    target.type === 'user' ? <PersonIcon /> :
                    target.type === 'team' ? <GroupIcon /> :
                    <ScheduleIcon />
                  }
                  variant="outlined"
                />
              )) || (
                <Typography variant="body2" color="error">
                  No targets selected
                </Typography>
              )}
            </Box>
          </Box>

          {/* Notification Channels */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Channels
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {step.notification_channels?.map((channel) => {
                const channelInfo = NOTIFICATION_CHANNELS.find(c => c.value === channel);
                return (
                  <Chip
                    key={channel}
                    label={`${channelInfo?.icon || ''} ${channelInfo?.label || channel}`}
                    size="small"
                    color="primary"
                  />
                );
              }) || (
                <Typography variant="body2" color="error">
                  No channels selected
                </Typography>
              )}
            </Box>
          </Box>

          {/* Validation Errors */}
          {hasErrors && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validationErrors[step.id].map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  // Step Editor Dialog
  const StepEditor = ({ step, onSave, onCancel }) => {
    console.log('📝 StepEditor rendering for step:', step?.id);
    const [editData, setEditData] = useState(step);

    // Sync editData with step prop when it changes
    useEffect(() => {
      console.log('📝 StepEditor useEffect - updating editData for step:', step?.id);
      setEditData(step);
    }, [step]);

    const handleSave = () => {
      console.log('💾 StepEditor saving changes for step:', step.id);
      updateStep(step.id, editData);
      onSave();
    };

    return (
      <Dialog open maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Step {step.level}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Escalation Timing */}
            {step.level > 1 && (
              <TextField
                label="Escalation Delay (minutes)"
                type="number"
                value={editData.delay_minutes}
                onChange={(e) => setEditData(prev => ({
                  ...prev,
                  delay_minutes: Math.max(0, parseInt(e.target.value) || 0)
                }))}
                helperText="How long to wait before escalating to this step"
                fullWidth
              />
            )}

            {/* Targets Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Escalation Targets
              </Typography>
              <UserTeamSelector
                organizationId={organizationId}
                value={editData.targets || []}
                onChange={(targets) => setEditData(prev => ({ ...prev, targets }))}
                multiple
                showOnCallSchedules
              />
            </Box>

            {/* Notification Channels */}
            <FormControl fullWidth>
              <InputLabel>Notification Channels</InputLabel>
              <Select
                multiple
                value={editData.notification_channels || []}
                onChange={(e) => setEditData(prev => ({
                  ...prev,
                  notification_channels: e.target.value
                }))}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const channel = NOTIFICATION_CHANNELS.find(c => c.value === value);
                      return (
                        <Chip
                          key={value}
                          label={`${channel?.icon || ''} ${channel?.label || value}`}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <MenuItem key={channel.value} value={channel.value}>
                    {channel.icon} {channel.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Advanced Options */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Options
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={editData.is_final || false}
                    onChange={(e) => setEditData(prev => ({
                      ...prev,
                      is_final: e.target.checked
                    }))}
                  />
                }
                label="Mark as final escalation step"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editData.repeat_enabled || false}
                    onChange={(e) => setEditData(prev => ({
                      ...prev,
                      repeat_enabled: e.target.checked
                    }))}
                  />
                }
                label="Enable step repetition"
              />
              {editData.repeat_enabled && (
                <TextField
                  label="Repeat Count"
                  type="number"
                  value={editData.repeat_count || 1}
                  onChange={(e) => setEditData(prev => ({
                    ...prev,
                    repeat_count: Math.max(1, parseInt(e.target.value) || 1)
                  }))}
                  size="small"
                  sx={{ mt: 1, width: 120 }}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h6">Escalation Steps</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure the escalation flow for incidents. Drag to reorder steps.
        </Typography>
      </Box>

      {/* Flow Visualization */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Typography variant="subtitle2" gutterBottom>
          Escalation Flow Preview
        </Typography>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <Chip
                label={`Step ${step.level}`}
                color={index === 0 ? 'primary' : 'default'}
                size="small"
              />
              {index < steps.length - 1 && (
                <Box display="flex" alignItems="center" gap={1}>
                  <PlayIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {steps[index + 1].delay_minutes}m
                  </Typography>
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Paper>

      {/* Validation Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <WarningIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
            Please fix the validation errors in the steps below before saving.
          </Typography>
        </Alert>
      )}

      {/* Steps List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="escalation-steps" isDropDisabled={disabled}>
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {steps.map((step, index) => (
                <Draggable
                  key={step.id}
                  draggableId={step.id}
                  index={index}
                  isDragDisabled={disabled}
                >
                  {(provided, snapshot) => (
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <StepCard
                          step={step}
                          index={index}
                          isDragging={snapshot.isDragging}
                          dragHandleProps={provided.dragHandleProps}
                        />
                      </Box>
                      {/* Action buttons outside draggable area */}
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          right: 16, 
                          top: 16, 
                          zIndex: 1000,
                          display: 'flex',
                          gap: 1,
                          backgroundColor: 'white',
                          borderRadius: 1,
                          padding: 0.5,
                          boxShadow: 1
                        }}
                      >
                        <button
                          onClick={() => {
                            console.log('✏️ EDIT CLICKED:', step.id, step);
                            setEditingStep(step);
                          }}
                          style={{
                            border: 'none',
                            background: '#1976d2',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        {steps.length > 1 && (
                          <button
                            onClick={() => {
                              console.log('DELETE CLICKED:', step.id);
                              removeStep(step.id);
                            }}
                            style={{
                              border: 'none',
                              background: '#d32f2f',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </Box>
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Step Button */}
      <Box display="flex" justifyContent="center" mt={2} mb={3}>
        <Button
          startIcon={<AddIcon />}
          onClick={addStep}
          disabled={disabled || steps.length >= maxSteps}
          variant="outlined"
          size="large"
        >
          Add Step
        </Button>
      </Box>

      {/* Repeat Configuration */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Typography variant="h6" gutterBottom>
          Repeat Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure whether the escalation should repeat from the beginning if not acknowledged.
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={repeatEscalation}
              onChange={(e) => {
                if (onRepeatConfigChange) {
                  onRepeatConfigChange({
                    repeat_escalation: e.target.checked,
                    max_repeat_count: maxRepeatCount
                  });
                }
              }}
              disabled={disabled}
            />
          }
          label="Repeat escalation from beginning until acknowledged"
          sx={{ display: 'block', mb: 2 }}
        />

        {repeatEscalation && (
          <TextField
            label="Maximum Repeat Count"
            type="number"
            value={maxRepeatCount}
            onChange={(e) => {
              if (onRepeatConfigChange) {
                onRepeatConfigChange({
                  repeat_escalation: repeatEscalation,
                  max_repeat_count: parseInt(e.target.value) || 3
                });
              }
            }}
            helperText="Maximum number of times to repeat the escalation sequence (0 = infinite)"
            inputProps={{ min: 0, max: 20 }}
            disabled={disabled}
            sx={{ maxWidth: 300 }}
            size="small"
          />
        )}
      </Paper>

      {/* Step Editor Dialog */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          onSave={() => setEditingStep(null)}
          onCancel={() => setEditingStep(null)}
        />
      )}

      {/* Footer Info */}
      <Box mt={3}>
        <Typography variant="caption" color="text.secondary">
          {steps.length} of {maxSteps} steps configured
          {repeatEscalation && (
            <> • Repeat enabled ({maxRepeatCount === 0 ? 'infinite' : `${maxRepeatCount} times`})</>
          )}
          {Object.keys(validationErrors).length > 0 && (
            <> • {Object.keys(validationErrors).length} validation error{Object.keys(validationErrors).length !== 1 ? 's' : ''}</>
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default EscalationStepsOrchestrator;
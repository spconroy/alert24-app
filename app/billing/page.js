'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StarIcon from '@mui/icons-material/Star';
import BusinessIcon from '@mui/icons-material/Business';
import { useOrganization } from '@/contexts/OrganizationContext';
import BillingUsageCard from '@/components/BillingUsageCard';

const pricingPlans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billing: 'forever',
    description: 'Perfect for getting started',
    features: [
      'Up to 3 team members',
      'Basic incident management',
      'Email notifications',
      'Basic monitoring (5 checks)',
      'Community support',
      'Basic status page',
    ],
    limits: {
      teamMembers: 3,
      monitoringChecks: 5,
      incidents: 'Unlimited',
      statusPages: 1,
    },
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    billing: 'per month',
    description: 'Best for growing teams',
    features: [
      'Up to 15 team members',
      'Advanced incident management',
      'SMS & Phone notifications',
      'Advanced monitoring (50 checks)',
      'Priority support',
      'Custom branding',
      'Advanced analytics',
      'API access',
    ],
    limits: {
      teamMembers: 15,
      monitoringChecks: 50,
      incidents: 'Unlimited',
      statusPages: 5,
    },
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    billing: 'per month',
    description: 'For large organizations',
    features: [
      'Unlimited team members',
      'Enterprise incident management',
      'Advanced integrations',
      'Unlimited monitoring',
      'Dedicated support',
      'Custom domain',
      'Advanced security',
      'SLA guarantees',
      'On-premise options',
    ],
    limits: {
      teamMembers: 'Unlimited',
      monitoringChecks: 'Unlimited',
      incidents: 'Unlimited',
      statusPages: 'Unlimited',
    },
    popular: false,
  },
];

export default function BillingPage() {
  const { selectedOrganization, session } = useOrganization();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processingUpgrade, setProcessingUpgrade] = useState(false);

  useEffect(() => {
    if (selectedOrganization) {
      fetchBillingInfo();
    }
  }, [selectedOrganization]);

  const fetchBillingInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/billing?organization_id=${selectedOrganization.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.subscription);
        setUsage(data.usage);
      }
    } catch (error) {
      console.error('Error fetching billing info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = plan => {
    setSelectedPlan(plan);
    setUpgradeDialogOpen(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan || !selectedOrganization) return;

    setProcessingUpgrade(true);
    try {
      const response = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrganization.id,
          plan_id: selectedPlan.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkout_url) {
          // Redirect to Stripe checkout
          window.location.href = data.checkout_url;
        } else {
          // Plan changed successfully
          await fetchBillingInfo();
          setUpgradeDialogOpen(false);
        }
      } else {
        console.error('Failed to upgrade plan');
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
    } finally {
      setProcessingUpgrade(false);
    }
  };

  const getCurrentPlanInfo = () => {
    if (!currentPlan) return pricingPlans[0]; // Default to free
    return pricingPlans.find(p => p.id === currentPlan.plan) || pricingPlans[0];
  };

  const currentPlanInfo = getCurrentPlanInfo();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Billing & Subscription
      </Typography>

      {/* Current Plan Info */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">Current Plan</Typography>
            <Chip
              label={currentPlanInfo.name}
              color={currentPlanInfo.id === 'free' ? 'default' : 'primary'}
              icon={
                currentPlanInfo.id === 'enterprise' ? (
                  <BusinessIcon />
                ) : (
                  <StarIcon />
                )
              }
            />
          </Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {currentPlanInfo.description}
          </Typography>
          <Box display="flex" alignItems="center" gap={2} mt={2}>
            <Typography variant="h5" color="primary">
              ${currentPlanInfo.price}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentPlanInfo.billing}
            </Typography>
          </Box>
          {currentPlan && currentPlan.status && (
            <Box mt={2}>
              <Typography variant="body2">
                Status: <Chip size="small" label={currentPlan.status} />
              </Typography>
              {currentPlan.current_period_end && (
                <Typography variant="body2" color="text.secondary">
                  Current period ends:{' '}
                  {new Date(
                    currentPlan.current_period_end
                  ).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Box sx={{ mb: 4 }}>
        <BillingUsageCard
          organization={selectedOrganization}
          usage={usage}
          subscription={currentPlan}
          onUpgrade={() => setUpgradeDialogOpen(true)}
        />
      </Box>

      {/* Upgrade Options */}
      <Typography variant="h5" gutterBottom>
        Choose Your Plan
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {pricingPlans.map(plan => (
          <Grid item xs={12} md={4} key={plan.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: plan.popular ? '2px solid' : '1px solid',
                borderColor: plan.popular ? 'primary.main' : 'divider',
              }}
            >
              {plan.popular && (
                <Chip
                  label="Most Popular"
                  color="primary"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                  }}
                />
              )}
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {plan.name}
                </Typography>
                <Box display="flex" alignItems="baseline" mb={1}>
                  <Typography variant="h4" color="primary">
                    ${plan.price}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {plan.billing}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {plan.description}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <List dense>
                  {plan.features.map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={feature}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
              <CardActions sx={{ p: 2 }}>
                <Button
                  variant={
                    plan.id === currentPlanInfo.id ? 'outlined' : 'contained'
                  }
                  color="primary"
                  fullWidth
                  disabled={plan.id === currentPlanInfo.id}
                  onClick={() => handleUpgrade(plan)}
                  startIcon={<CreditCardIcon />}
                >
                  {plan.id === currentPlanInfo.id
                    ? 'Current Plan'
                    : plan.price === 0
                      ? 'Downgrade'
                      : 'Upgrade'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upgrade Confirmation Dialog */}
      <Dialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upgrade to {selectedPlan?.name}</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Are you sure you want to upgrade to the {selectedPlan?.name} plan?
          </Typography>
          {selectedPlan && (
            <Box>
              <Typography variant="h6" gutterBottom>
                ${selectedPlan.price} {selectedPlan.billing}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPlan.description}
              </Typography>
            </Box>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            You will be redirected to Stripe to complete your payment securely.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmUpgrade}
            variant="contained"
            disabled={processingUpgrade}
            startIcon={processingUpgrade && <CircularProgress size={20} />}
          >
            {processingUpgrade ? 'Processing...' : 'Confirm Upgrade'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

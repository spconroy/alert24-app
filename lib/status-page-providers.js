// Status Page Providers Configuration
// This file defines the major cloud providers' status pages and their services

export const STATUS_PAGE_PROVIDERS = {
  'azure': {
    id: 'azure',
    name: 'Microsoft Azure',
    description: 'Microsoft Azure cloud services status',
    url: 'https://status.azure.com/',
    api_url: 'https://status.azure.com/api/v2/status.json',
    services: [
      {
        id: 'azure-active-directory',
        name: 'Azure Active Directory',
        description: 'Identity and access management service',
        regions: [
          'global',
          'north-america',
          'europe',
          'asia-pacific',
          'south-america',
          'africa',
          'middle-east'
        ]
      },
      {
        id: 'azure-compute',
        name: 'Azure Compute',
        description: 'Virtual machines and compute services',
        regions: [
          'east-us',
          'west-us',
          'central-us',
          'north-central-us',
          'south-central-us',
          'east-us-2',
          'west-us-2',
          'west-us-3',
          'canada-central',
          'canada-east',
          'brazil-south',
          'north-europe',
          'west-europe',
          'france-central',
          'france-south',
          'germany-west-central',
          'germany-north',
          'norway-east',
          'norway-west',
          'sweden-central',
          'switzerland-north',
          'switzerland-west',
          'uk-south',
          'uk-west',
          'asia-east',
          'asia-southeast',
          'australia-central',
          'australia-central-2',
          'australia-east',
          'australia-southeast',
          'central-india',
          'south-india',
          'west-india',
          'japan-east',
          'japan-west',
          'korea-central',
          'korea-south'
        ]
      },
      {
        id: 'azure-storage',
        name: 'Azure Storage',
        description: 'Cloud storage services',
        regions: [
          'east-us',
          'west-us',
          'central-us',
          'north-central-us',
          'south-central-us',
          'east-us-2',
          'west-us-2',
          'west-us-3',
          'canada-central',
          'canada-east',
          'brazil-south',
          'north-europe',
          'west-europe',
          'france-central',
          'germany-west-central',
          'uk-south',
          'uk-west',
          'asia-east',
          'asia-southeast',
          'australia-central',
          'australia-east',
          'australia-southeast',
          'central-india',
          'south-india',
          'west-india',
          'japan-east',
          'japan-west',
          'korea-central'
        ]
      },
      {
        id: 'azure-app-service',
        name: 'Azure App Service',
        description: 'Web apps and API hosting',
        regions: [
          'east-us',
          'west-us',
          'central-us',
          'north-central-us',
          'south-central-us',
          'east-us-2',
          'west-us-2',
          'canada-central',
          'canada-east',
          'brazil-south',
          'north-europe',
          'west-europe',
          'france-central',
          'germany-west-central',
          'uk-south',
          'uk-west',
          'asia-east',
          'asia-southeast',
          'australia-central',
          'australia-east',
          'australia-southeast',
          'central-india',
          'south-india',
          'west-india',
          'japan-east',
          'japan-west',
          'korea-central'
        ]
      },
      {
        id: 'azure-sql-database',
        name: 'Azure SQL Database',
        description: 'Managed SQL database service',
        regions: [
          'east-us',
          'west-us',
          'central-us',
          'north-central-us',
          'south-central-us',
          'east-us-2',
          'west-us-2',
          'canada-central',
          'canada-east',
          'brazil-south',
          'north-europe',
          'west-europe',
          'france-central',
          'germany-west-central',
          'uk-south',
          'uk-west',
          'asia-east',
          'asia-southeast',
          'australia-central',
          'australia-east',
          'australia-southeast',
          'central-india',
          'south-india',
          'west-india',
          'japan-east',
          'japan-west',
          'korea-central'
        ]
      }
    ]
  },
  'aws': {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'Amazon Web Services cloud platform status',
    url: 'https://status.aws.amazon.com/',
    api_url: 'https://status.aws.amazon.com/api/v2/status.json',
    services: [
      {
        id: 'aws-ec2',
        name: 'Amazon EC2',
        description: 'Elastic Compute Cloud virtual servers',
        regions: [
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'ca-central-1',
          'sa-east-1',
          'eu-west-1',
          'eu-west-2',
          'eu-west-3',
          'eu-central-1',
          'eu-north-1',
          'eu-south-1',
          'ap-southeast-1',
          'ap-southeast-2',
          'ap-northeast-1',
          'ap-northeast-2',
          'ap-northeast-3',
          'ap-south-1',
          'ap-east-1',
          'me-south-1',
          'af-south-1'
        ]
      },
      {
        id: 'aws-s3',
        name: 'Amazon S3',
        description: 'Simple Storage Service object storage',
        regions: [
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'ca-central-1',
          'sa-east-1',
          'eu-west-1',
          'eu-west-2',
          'eu-west-3',
          'eu-central-1',
          'eu-north-1',
          'eu-south-1',
          'ap-southeast-1',
          'ap-southeast-2',
          'ap-northeast-1',
          'ap-northeast-2',
          'ap-northeast-3',
          'ap-south-1',
          'ap-east-1',
          'me-south-1',
          'af-south-1'
        ]
      },
      {
        id: 'aws-rds',
        name: 'Amazon RDS',
        description: 'Relational Database Service',
        regions: [
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'ca-central-1',
          'sa-east-1',
          'eu-west-1',
          'eu-west-2',
          'eu-west-3',
          'eu-central-1',
          'eu-north-1',
          'eu-south-1',
          'ap-southeast-1',
          'ap-southeast-2',
          'ap-northeast-1',
          'ap-northeast-2',
          'ap-northeast-3',
          'ap-south-1',
          'ap-east-1',
          'me-south-1',
          'af-south-1'
        ]
      },
      {
        id: 'aws-lambda',
        name: 'AWS Lambda',
        description: 'Serverless compute functions',
        regions: [
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'ca-central-1',
          'sa-east-1',
          'eu-west-1',
          'eu-west-2',
          'eu-west-3',
          'eu-central-1',
          'eu-north-1',
          'eu-south-1',
          'ap-southeast-1',
          'ap-southeast-2',
          'ap-northeast-1',
          'ap-northeast-2',
          'ap-northeast-3',
          'ap-south-1',
          'ap-east-1',
          'me-south-1',
          'af-south-1'
        ]
      },
      {
        id: 'aws-route53',
        name: 'Amazon Route 53',
        description: 'DNS and traffic management',
        regions: ['global']
      },
      {
        id: 'aws-cloudfront',
        name: 'Amazon CloudFront',
        description: 'Content delivery network',
        regions: ['global']
      }
    ]
  },
  'gcp': {
    id: 'gcp',
    name: 'Google Cloud Platform',
    description: 'Google Cloud Platform services status',
    url: 'https://status.cloud.google.com/',
    api_url: 'https://status.cloud.google.com/api/v2/status.json',
    services: [
      {
        id: 'gcp-compute-engine',
        name: 'Compute Engine',
        description: 'Virtual machine instances',
        regions: [
          'us-central1',
          'us-east1',
          'us-east4',
          'us-west1',
          'us-west2',
          'us-west3',
          'us-west4',
          'northamerica-northeast1',
          'northamerica-northeast2',
          'southamerica-east1',
          'southamerica-west1',
          'europe-west1',
          'europe-west2',
          'europe-west3',
          'europe-west4',
          'europe-west6',
          'europe-north1',
          'europe-central2',
          'asia-east1',
          'asia-east2',
          'asia-northeast1',
          'asia-northeast2',
          'asia-northeast3',
          'asia-south1',
          'asia-south2',
          'asia-southeast1',
          'asia-southeast2',
          'australia-southeast1',
          'australia-southeast2'
        ]
      },
      {
        id: 'gcp-cloud-storage',
        name: 'Cloud Storage',
        description: 'Object storage service',
        regions: [
          'us-central1',
          'us-east1',
          'us-east4',
          'us-west1',
          'us-west2',
          'us-west3',
          'us-west4',
          'northamerica-northeast1',
          'northamerica-northeast2',
          'southamerica-east1',
          'europe-west1',
          'europe-west2',
          'europe-west3',
          'europe-west4',
          'europe-west6',
          'europe-north1',
          'europe-central2',
          'asia-east1',
          'asia-east2',
          'asia-northeast1',
          'asia-northeast2',
          'asia-northeast3',
          'asia-south1',
          'asia-south2',
          'asia-southeast1',
          'asia-southeast2',
          'australia-southeast1',
          'australia-southeast2'
        ]
      },
      {
        id: 'gcp-app-engine',
        name: 'App Engine',
        description: 'Platform as a service application hosting',
        regions: [
          'us-central',
          'us-east1',
          'us-east4',
          'us-west1',
          'us-west2',
          'us-west3',
          'us-west4',
          'northamerica-northeast1',
          'southamerica-east1',
          'europe-west1',
          'europe-west2',
          'europe-west3',
          'europe-west6',
          'asia-east2',
          'asia-northeast1',
          'asia-northeast2',
          'asia-northeast3',
          'asia-south1',
          'asia-southeast2',
          'australia-southeast1'
        ]
      },
      {
        id: 'gcp-cloud-sql',
        name: 'Cloud SQL',
        description: 'Managed relational database service',
        regions: [
          'us-central1',
          'us-east1',
          'us-east4',
          'us-west1',
          'us-west2',
          'us-west3',
          'us-west4',
          'northamerica-northeast1',
          'northamerica-northeast2',
          'southamerica-east1',
          'europe-west1',
          'europe-west2',
          'europe-west3',
          'europe-west4',
          'europe-west6',
          'europe-north1',
          'europe-central2',
          'asia-east1',
          'asia-east2',
          'asia-northeast1',
          'asia-northeast2',
          'asia-northeast3',
          'asia-south1',
          'asia-south2',
          'asia-southeast1',
          'asia-southeast2',
          'australia-southeast1',
          'australia-southeast2'
        ]
      },
      {
        id: 'gcp-cloud-functions',
        name: 'Cloud Functions',
        description: 'Event-driven serverless functions',
        regions: [
          'us-central1',
          'us-east1',
          'us-east4',
          'us-west1',
          'us-west2',
          'us-west3',
          'us-west4',
          'northamerica-northeast1',
          'southamerica-east1',
          'europe-west1',
          'europe-west2',
          'europe-west3',
          'europe-west6',
          'europe-north1',
          'asia-east1',
          'asia-east2',
          'asia-northeast1',
          'asia-northeast2',
          'asia-northeast3',
          'asia-south1',
          'asia-southeast1',
          'asia-southeast2',
          'australia-southeast1'
        ]
      },
      {
        id: 'gcp-cloud-dns',
        name: 'Cloud DNS',
        description: 'Domain name system service',
        regions: ['global']
      }
    ]
  }
};

// Helper function to get all providers
export function getStatusPageProviders() {
  return Object.values(STATUS_PAGE_PROVIDERS);
}

// Helper function to get a specific provider
export function getStatusPageProvider(providerId) {
  return STATUS_PAGE_PROVIDERS[providerId];
}

// Helper function to get all services for a provider
export function getProviderServices(providerId) {
  const provider = STATUS_PAGE_PROVIDERS[providerId];
  return provider ? provider.services : [];
}

// Helper function to get regions for a specific service
export function getServiceRegions(providerId, serviceId) {
  const provider = STATUS_PAGE_PROVIDERS[providerId];
  if (!provider) return [];
  
  const service = provider.services.find(s => s.id === serviceId);
  return service ? service.regions : [];
}

// Helper function to format provider service for display
export function formatProviderService(providerId, serviceId, regions = []) {
  const provider = STATUS_PAGE_PROVIDERS[providerId];
  if (!provider) return null;
  
  const service = provider.services.find(s => s.id === serviceId);
  if (!service) return null;
  
  return {
    provider: provider.name,
    service: service.name,
    description: service.description,
    regions: regions.length > 0 ? regions : service.regions,
    url: provider.url
  };
}
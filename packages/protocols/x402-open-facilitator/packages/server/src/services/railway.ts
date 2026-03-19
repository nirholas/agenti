/**
 * Railway API client for managing custom domains
 * 
 * Railway uses a GraphQL API: https://docs.railway.app/reference/public-api
 */

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

interface RailwayConfig {
  apiToken: string;
  serviceId: string;
  environmentId: string;
  projectId: string;
}

interface CustomDomainResult {
  success: boolean;
  domain?: string;
  error?: string;
  status?: 'pending' | 'active' | 'error';
  dnsRecords?: {
    type: string;
    name: string;
    value: string;
  }[];
}

interface DomainStatus {
  domain: string;
  status: 'pending' | 'active' | 'error';
  dnsRecords?: {
    type: string;
    name: string;
    value: string;
  }[];
}

/**
 * Get Railway configuration from environment
 * Railway automatically provides RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID, and RAILWAY_PROJECT_ID
 * You need to set RAILWAY_TOKEN with an ACCOUNT token from railway.app/account/tokens
 * (Account tokens have more permissions than project tokens)
 */
function getConfig(): RailwayConfig {
  const apiToken = process.env.RAILWAY_TOKEN;
  const serviceId = process.env.RAILWAY_SERVICE_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const projectId = process.env.RAILWAY_PROJECT_ID;

  if (!apiToken || !serviceId || !environmentId || !projectId) {
    throw new Error('Missing Railway configuration. Set RAILWAY_TOKEN and ensure RAILWAY_PROJECT_ID is available');
  }

  return { apiToken, serviceId, environmentId, projectId };
}

/**
 * Execute a GraphQL query against Railway API
 */
async function railwayQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const config = getConfig();
  
  console.log('Railway API request:', {
    url: RAILWAY_API_URL,
    variables: JSON.stringify(variables, null, 2),
  });
  
  // Railway uses different headers based on token type:
  // - Project tokens: 'Project-Access-Token'
  // - Account tokens: 'Authorization: Bearer'
  // We'll use Authorization: Bearer for account tokens (more permissions)
  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json() as { data?: T; errors?: Array<{ message: string; extensions?: unknown; path?: string[] }> };
  
  console.log('Railway API response:', {
    status: response.status,
    data: result.data,
    errors: result.errors,
  });
  
  if (!response.ok) {
    console.error('Railway API HTTP error:', response.status, response.statusText);
    const errorMessage = result.errors?.[0]?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Railway API error: ${errorMessage}`);
  }
  
  if (result.errors && result.errors.length > 0) {
    console.error('Railway GraphQL errors:', JSON.stringify(result.errors, null, 2));
    throw new Error(`Railway API error: ${result.errors[0]?.message || 'Unknown error'}`);
  }

  return result.data as T;
}

/**
 * Add a custom domain to the Railway service
 */
export async function addCustomDomain(domain: string): Promise<CustomDomainResult> {
  try {
    const config = getConfig();
    
    const mutation = `
      mutation customDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status {
            dnsRecords {
              requiredValue
              currentValue
              status
              hostlabel
              zone
              recordType
            }
          }
        }
      }
    `;

    const result = await railwayQuery<{
      customDomainCreate: {
        id: string;
        domain: string;
        status: {
          dnsRecords: Array<{
            requiredValue: string;
            currentValue: string;
            status: string;
            hostlabel: string;
            zone: string;
            recordType: string;
          }>;
        };
      };
    }>(mutation, {
      input: {
        domain,
        environmentId: config.environmentId,
        serviceId: config.serviceId,
        projectId: config.projectId,
      },
    });

    const dnsRecords = result.customDomainCreate.status.dnsRecords.map((r) => ({
      type: r.recordType.replace('DNS_RECORD_TYPE_', ''),
      name: r.hostlabel || result.customDomainCreate.domain,
      value: r.requiredValue,
    }));

    return {
      success: true,
      domain: result.customDomainCreate.domain,
      status: 'pending',
      dnsRecords,
    };
  } catch (error) {
    console.error('Failed to add custom domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a custom domain from the Railway service
 */
export async function removeCustomDomain(domain: string): Promise<CustomDomainResult> {
  try {
    const config = getConfig();
    
    // First, get the domain ID using the domains query
    const domainsQuery = `
      query domains($projectId: String!, $serviceId: String!, $environmentId: String!) {
        domains(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId) {
          customDomains {
            id
            domain
          }
        }
      }
    `;

    const domainsResult = await railwayQuery<{
      domains: {
        customDomains: Array<{ id: string; domain: string }>;
      };
    }>(domainsQuery, {
      projectId: config.projectId,
      serviceId: config.serviceId,
      environmentId: config.environmentId,
    });

    const domainEntry = domainsResult.domains.customDomains.find(
      (d) => d.domain === domain
    );

    if (!domainEntry) {
      return {
        success: false,
        error: 'Domain not found',
      };
    }

    // Delete the domain
    const deleteMutation = `
      mutation customDomainDelete($id: String!) {
        customDomainDelete(id: $id)
      }
    `;

    await railwayQuery(deleteMutation, { id: domainEntry.id });

    return {
      success: true,
      domain,
    };
  } catch (error) {
    console.error('Failed to remove custom domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the status of a custom domain
 */
export async function getDomainStatus(domain: string): Promise<DomainStatus | null> {
  try {
    const config = getConfig();
    
    // Use the domains query with all three required IDs
    const query = `
      query domains($projectId: String!, $serviceId: String!, $environmentId: String!) {
        domains(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId) {
          customDomains {
            id
            domain
            status {
              dnsRecords {
                requiredValue
                currentValue
                status
                hostlabel
                zone
                recordType
              }
            }
          }
        }
      }
    `;

    const result = await railwayQuery<{
      domains: {
        customDomains: Array<{
          id: string;
          domain: string;
          status: {
            dnsRecords: Array<{
              requiredValue: string;
              currentValue: string;
              status: string;
              hostlabel: string;
              zone: string;
              recordType: string;
            }>;
          };
        }>;
      };
    }>(query, {
      projectId: config.projectId,
      serviceId: config.serviceId,
      environmentId: config.environmentId,
    });

    const domainEntry = result.domains.customDomains.find(
      (d) => d.domain === domain
    );

    if (!domainEntry) {
      return null;
    }

    // Determine overall status based on DNS records
    // Railway uses DNS_RECORD_STATUS_PROPAGATED for success
    const allValid = domainEntry.status.dnsRecords.every(
      (r) => r.status === 'DNS_RECORD_STATUS_PROPAGATED'
    );

    return {
      domain: domainEntry.domain,
      status: allValid ? 'active' : 'pending',
      dnsRecords: domainEntry.status.dnsRecords.map((r) => ({
        type: r.recordType.replace('DNS_RECORD_TYPE_', ''),
        name: r.hostlabel,
        value: r.requiredValue,
      })),
    };
  } catch (error) {
    console.error('Failed to get domain status:', error);
    return null;
  }
}

/**
 * Check if Railway integration is configured
 */
export function isRailwayConfigured(): boolean {
  return !!(
    process.env.RAILWAY_TOKEN &&
    process.env.RAILWAY_SERVICE_ID &&
    process.env.RAILWAY_ENVIRONMENT_ID &&
    process.env.RAILWAY_PROJECT_ID
  );
}


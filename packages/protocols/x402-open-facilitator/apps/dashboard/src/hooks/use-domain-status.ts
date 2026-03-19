import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDomainStatus(facilitatorId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ['domainStatus', facilitatorId],
    queryFn: () => api.getDomainStatus(facilitatorId!),
    enabled: !!facilitatorId && enabled,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 10000 : false),
  });

  const { data: domainStatus } = query;

  // Extract DNS record info from Railway
  const dnsRecord = domainStatus?.dnsRecords?.[0];
  const cnameValue = dnsRecord?.value || '';
  const cnameName = dnsRecord?.name?.split('.')[0] || '';
  const cnameType = dnsRecord?.type || 'CNAME';

  // Status helpers
  const isActive = domainStatus?.status === 'active';
  const isPending = domainStatus?.status === 'pending';
  const isNotConfigured = domainStatus?.status === 'not_added' || domainStatus?.status === 'unconfigured';

  return {
    ...query,
    domainStatus,
    dnsRecord,
    cnameValue,
    cnameName,
    cnameType,
    isActive,
    isPending,
    isNotConfigured,
  };
}

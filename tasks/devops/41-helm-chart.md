# Task: Create Kubernetes Helm Chart

## Priority: MEDIUM

## Context
Enterprise deployments typically run on Kubernetes. A Helm chart provides standardized, repeatable deployment with configurable values.

## Requirements
1. Create a Helm chart under `deploy/helm/agenti/` with:
   - Deployment with configurable replicas, resources, and node selectors
   - Service (ClusterIP) with configurable port
   - Ingress with TLS termination support
   - ConfigMap for non-sensitive configuration
   - Secret for sensitive values (API keys, private keys)
   - HorizontalPodAutoscaler (CPU/memory based)
   - PodDisruptionBudget (minAvailable: 1)
   - ServiceMonitor for Prometheus Operator
   - NetworkPolicy restricting ingress/egress
2. Values.yaml with sensible defaults:
   - 2 replicas minimum
   - 256Mi memory request, 512Mi limit
   - Readiness and liveness probes configured
   - Pod anti-affinity for HA
3. Support multiple environments via values overlays:
   - `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`
4. Add Helm chart tests (`helm test`)
5. Document deployment in `deploy/README.md`

## Acceptance Criteria
- [ ] `helm install` works from the chart
- [ ] All Kubernetes resources created correctly
- [ ] HPA scales based on load
- [ ] NetworkPolicy restricts traffic
- [ ] Chart passes `helm lint` and `helm test`

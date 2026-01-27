# Kubernetes Deployment

For Kubernetes deployment, use the Helm chart in `deploy/helm/`.

```bash
# Add the Helm repo (if published) or install from local
helm install mcp-notify ./deploy/helm/mcp-notify \
  --namespace mcp-notify \
  --create-namespace \
  --set postgresql.enabled=true \
  --set redis.enabled=true

# Or use raw manifests generated from Helm
helm template mcp-notify ./deploy/helm/mcp-notify > k8s-manifests.yaml
kubectl apply -f k8s-manifests.yaml
```

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) for full Kubernetes deployment instructions.

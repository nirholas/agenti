---
title: Kubernetes Deployment
description: Deploy MCP Notify to Kubernetes
icon: simple/kubernetes
---

# Kubernetes Deployment

Production Kubernetes deployment for MCP Notify.

## Prerequisites

- Kubernetes 1.25+
- kubectl configured
- Helm 3+ (optional)

## Quick Start with kubectl

### 1. Create Namespace

```bash
kubectl create namespace mcp-notify
```

### 2. Create Secrets

```bash
kubectl create secret generic mcp-notify-secrets \
  --namespace mcp-notify \
  --from-literal=database-url='postgres://user:pass@host:5432/db' \
  --from-literal=redis-url='redis://host:6379' \
  --from-literal=api-key='your-secure-api-key'
```

### 3. Apply Manifests

```bash
kubectl apply -f deploy/kubernetes/
```

## Manifest Files

### Deployment

```yaml
# deploy/kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-notify
  namespace: mcp-notify
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-notify
  template:
    metadata:
      labels:
        app: mcp-notify
    spec:
      containers:
        - name: mcp-notify
          image: ghcr.io/nirholas/mcp-notify:latest
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: mcp-notify-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: mcp-notify-secrets
                  key: redis-url
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: mcp-notify-secrets
                  key: api-key
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

### Service

```yaml
# deploy/kubernetes/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-notify
  namespace: mcp-notify
spec:
  selector:
    app: mcp-notify
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

### Ingress

```yaml
# deploy/kubernetes/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-notify
  namespace: mcp-notify
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.mcp-notify.example.com
      secretName: mcp-notify-tls
  rules:
    - host: api.mcp-notify.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mcp-notify
                port:
                  number: 80
```

### HorizontalPodAutoscaler

```yaml
# deploy/kubernetes/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-notify
  namespace: mcp-notify
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-notify
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### PodDisruptionBudget

```yaml
# deploy/kubernetes/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mcp-notify
  namespace: mcp-notify
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mcp-notify
```

## With Managed Databases

### AWS RDS + ElastiCache

```yaml
env:
  - name: DATABASE_URL
    value: postgres://user:pass@mydb.xxx.rds.amazonaws.com:5432/mcp_notify
  - name: REDIS_URL
    value: redis://mycluster.xxx.cache.amazonaws.com:6379
```

### GCP Cloud SQL + Memorystore

```yaml
env:
  - name: DATABASE_URL
    value: postgres://user:pass@/mcp_notify?host=/cloudsql/project:region:instance
  - name: REDIS_URL
    value: redis://10.0.0.1:6379
```

## Monitoring

### ServiceMonitor (Prometheus)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: mcp-notify
  namespace: mcp-notify
spec:
  selector:
    matchLabels:
      app: mcp-notify
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

## Helm Chart (Coming Soon)

```bash
helm repo add mcp-notify https://charts.mcp-notify.example.com
helm install mcp-notify mcp-notify/mcp-notify \
  --namespace mcp-notify \
  --set postgresql.enabled=true \
  --set redis.enabled=true
```

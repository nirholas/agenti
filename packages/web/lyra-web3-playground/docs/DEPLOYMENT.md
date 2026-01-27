<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Your work matters more than you know 💎
-->

# Deployment Guide

This guide covers deploying Lyra Web3 Playground to various hosting platforms.

## Prerequisites

- Git repository with your code
- Node.js 18+ installed locally
- Account on chosen hosting platform
- Environment variables configured

## Quick Deploy Options

### Deploy to Vercel (Recommended)

**Why Vercel?**
- Zero configuration
- Automatic HTTPS
- Global CDN
- Free for hobby projects
- Perfect for Vite/React apps

**Steps:**

1. **Push code to GitHub**

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Connect to Vercel**

```bash
npm install -g vercel
vercel login
vercel
```

Or use the web interface:
- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Vercel auto-detects Vite configuration
- Click "Deploy"

3. **Configure Environment Variables**

In Vercel Dashboard → Settings → Environment Variables:

```
VITE_INFURA_API_KEY=your_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_key_here
```

4. **Redeploy**

Changes pushed to main branch automatically trigger deployment.

**Custom Domain:**
- Add domain in Vercel dashboard
- Update DNS records as instructed
- HTTPS automatically configured

### Deploy to Netlify

**Steps:**

1. **Create netlify.toml**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

2. **Deploy**

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

Or use web interface:
- Go to [netlify.com](https://netlify.com)
- Drag and drop `dist` folder
- Or connect GitHub repository

3. **Environment Variables**

Add in Site Settings → Build & deploy → Environment variables

### Deploy to GitHub Pages

**Steps:**

1. **Install gh-pages**

```bash
npm install --save-dev gh-pages
```

2. **Update package.json**

```json
{
  "homepage": "https://yourusername.github.io/playground",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. **Update vite.config.ts**

```typescript
export default defineConfig({
  base: '/playground/',
  // ... rest of config
})
```

4. **Deploy**

```bash
npm run deploy
```

5. **Configure GitHub Pages**

- Go to repository Settings → Pages
- Source: gh-pages branch
- Save

### Deploy to AWS S3 + CloudFront

**For production-grade deployment with AWS**

1. **Build the project**

```bash
npm run build
```

2. **Create S3 bucket**

```bash
aws s3 mb s3://lyra-web3-playground
aws s3 website s3://lyra-web3-playground --index-document index.html --error-document index.html
```

3. **Upload files**

```bash
aws s3 sync dist/ s3://lyra-web3-playground --acl public-read
```

4. **Create CloudFront distribution**

```bash
aws cloudfront create-distribution \
  --origin-domain-name lyra-web3-playground.s3.amazonaws.com \
  --default-root-object index.html
```

5. **Configure DNS**

Point your domain to CloudFront distribution URL.

## Docker Deployment

### Create Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Create nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Build and run

```bash
docker build -t lyra-web3-playground .
docker run -p 80:80 lyra-web3-playground
```

### Push to Docker Hub

```bash
docker tag lyra-web3-playground yourusername/lyra-web3-playground:latest
docker push yourusername/lyra-web3-playground:latest
```

## Kubernetes Deployment

### Create k8s manifests

**deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lyra-web3-playground
  labels:
    app: lyra-web3-playground
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lyra-web3-playground
  template:
    metadata:
      labels:
        app: lyra-web3-playground
    spec:
      containers:
      - name: lyra-web3-playground
        image: yourusername/lyra-web3-playground:latest
        ports:
        - containerPort: 80
        env:
        - name: VITE_INFURA_API_KEY
          valueFrom:
            secretKeyRef:
              name: web3-secrets
              key: infura-api-key
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

**service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: lyra-web3-playground
spec:
  selector:
    app: lyra-web3-playground
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

**ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lyra-web3-playground
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - lyra-web3-playground.com
    secretName: lyra-tls
  rules:
  - host: lyra-web3-playground.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: lyra-web3-playground
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# Create secrets
kubectl create secret generic web3-secrets \
  --from-literal=infura-api-key=your_key_here

# Apply manifests
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods
kubectl get services
kubectl get ingress
```

## Environment Variables

### Required for Production

```bash
# Blockchain RPC (at least one)
VITE_INFURA_API_KEY=your_infura_key
VITE_ALCHEMY_API_KEY=your_alchemy_key

# Optional but recommended
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### Optional Features

```bash
# AI Features (if enabled)
VITE_OPENAI_API_KEY=your_openai_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key

# Analytics
VITE_PLAUSIBLE_DOMAIN=yourdomain.com

# Premium Features
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_PREMIUM_FEATURES=true
```

## Performance Optimization

### Build Optimizations

**1. Enable compression**

```bash
npm install --save-dev vite-plugin-compression
```

```typescript
// vite.config.ts
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
  ],
});
```

**2. Optimize images**

```bash
npm install --save-dev vite-plugin-imagemin
```

**3. Bundle analysis**

```bash
npm install --save-dev rollup-plugin-visualizer
```

### CDN Configuration

**Use CDN for static assets:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});
```

Then configure your CDN (CloudFlare, AWS CloudFront, etc.) to cache `/assets/*`

## Monitoring Setup

### Error Tracking with Sentry

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'your_sentry_dsn',
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

### Analytics with Plausible

```bash
npm install plausible-tracker
```

```typescript
// src/main.tsx
import Plausible from 'plausible-tracker';

const plausible = Plausible({
  domain: 'yourdomain.com',
});

plausible.trackPageview();
```

## CI/CD Pipeline

### GitHub Actions

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_INFURA_API_KEY: ${{ secrets.INFURA_API_KEY }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Security Checklist

Before deploying to production:

- [ ] Environment variables properly configured
- [ ] No secrets in code or git history
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Dependencies updated and audited
- [ ] CSP (Content Security Policy) configured
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all forms
- [ ] XSS protection enabled
- [ ] CORS properly configured

## Post-Deployment

### Verify Deployment

```bash
# Check if site is accessible
curl https://yourdomain.com

# Check SSL certificate
curl -vI https://yourdomain.com 2>&1 | grep -i ssl

# Test wallet connection
# Open browser and try connecting MetaMask
```

### Monitor Performance

- Set up uptime monitoring (UptimeRobot, Pingdom)
- Monitor Web Vitals
- Set up error alerts
- Monitor API rate limits

## Rollback Strategy

If deployment fails:

```bash
# Vercel
vercel rollback

# Kubernetes
kubectl rollout undo deployment/lyra-web3-playground

# Docker
docker stop lyra-web3-playground
docker run previous-version-tag
```

## Cost Estimation

### Free Tier Deployment
- **Vercel/Netlify**: Free
- **GitHub Pages**: Free
- **Total**: $0/month

### Low-Traffic Production
- **Vercel Pro**: $20/month
- **Infura**: Free tier (100k requests/day)
- **Supabase**: Free tier
- **Total**: ~$20/month

### High-Traffic Production
- **AWS/GCP/Azure**: $100-500/month
- **CloudFront CDN**: $50-200/month
- **Infura/Alchemy**: $50-200/month
- **Supabase Pro**: $25/month
- **Total**: $225-925/month

## Troubleshooting

### Build fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment variables not working

- Check they start with `VITE_`
- Verify they're set in hosting platform
- Restart build after adding new variables

### Routing issues (404 on refresh)

Add redirect rules to serve index.html for all routes.

### Performance issues

- Enable compression
- Use CDN
- Optimize images
- Code splitting
- Tree shaking

---

For deployment issues, create an issue on GitHub or check our troubleshooting guide.

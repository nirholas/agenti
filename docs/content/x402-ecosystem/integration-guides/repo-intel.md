# Repo Intel x402 Integration

> Analyze repos of any size - security scanning, code analysis, monorepo support.

## Overview

**Repository:** [nirholas/repo-intel](https://github.com/nirholas/repo-intel)  
**MCP Registry:** `io.github.nirholas/repo-intel`  
**x402 Use Case:** Premium deep scans, security audits, continuous monitoring

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/repo-intel
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { RepoIntel } from '@nirholas/repo-intel';

// Analysis depth pricing
const intelPricing = PricingStrategy.resourceBased({
  'quick-scan': 0,             // Free: basic overview
  'standard-scan': 0.05,       // $0.05: full analysis
  'deep-scan': 0.25,           // $0.25: dependencies + security
  'security-audit': 1.00,      // $1.00: full security audit
  'monorepo-scan': 0.50,       // $0.50: per package
  'continuous': 10.00,         // $10/month: continuous monitoring
  'custom-rules': 0.25         // $0.25: per custom rule set
});

const intel = new PaywallBuilder()
  .service('repo-intel')
  .pricing(intelPricing)
  .build();
```

## Scan Levels

```typescript
// Scan depth configurations
const scanLevels = {
  quick: {
    includes: ['structure', 'languages', 'readme'],
    timeout: '30s',
    cost: 0
  },
  standard: {
    includes: ['structure', 'languages', 'readme', 'dependencies', 'license'],
    timeout: '2m',
    cost: 0.05
  },
  deep: {
    includes: ['all', 'vulnerabilities', 'code-quality', 'complexity'],
    timeout: '10m',
    cost: 0.25
  },
  security: {
    includes: ['all', 'sast', 'secrets', 'supply-chain', 'sbom'],
    timeout: '30m',
    cost: 1.00
  }
};

// Analyze repository
async function analyzeRepo(repoUrl: string, level: keyof typeof scanLevels = 'standard') {
  const config = scanLevels[level];
  
  if (config.cost > 0) {
    await intel.charge(config.cost, { repo: repoUrl, level });
  }
  
  return RepoIntel.analyze(repoUrl, { depth: level });
}
```

## Security Audit

```typescript
// Premium security audit
async function securityAudit(repoUrl: string, options: AuditOptions = {}) {
  await intel.charge(1.00, { type: 'security-audit', repo: repoUrl });
  
  const audit = await RepoIntel.securityAudit(repoUrl, {
    sast: true,           // Static analysis
    secrets: true,        // Secret detection
    dependencies: true,   // Vulnerability scanning
    supplyChain: true,    // Supply chain risks
    generateSBOM: true    // Software bill of materials
  });
  
  return {
    summary: audit.summary,
    criticalIssues: audit.issues.filter(i => i.severity === 'critical'),
    highIssues: audit.issues.filter(i => i.severity === 'high'),
    recommendations: audit.recommendations,
    sbom: audit.sbom,
    score: audit.securityScore // 0-100
  };
}
```

## Monorepo Analysis

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['repo-intel'],
  dailyLimit: 25
});

// Analyze monorepo (per-package pricing)
async function analyzeMonorepo(repoUrl: string) {
  // First, detect packages
  const structure = await RepoIntel.detectPackages(repoUrl);
  const packageCount = structure.packages.length;
  
  const cost = packageCount * 0.50;
  
  await agent.pay({
    service: 'repo-intel',
    amount: cost,
    description: `Analyze monorepo with ${packageCount} packages`
  });
  
  return RepoIntel.analyzeMonorepo(repoUrl, {
    packages: structure.packages,
    crossDependencies: true,
    sharedCode: true
  });
}
```

## Continuous Monitoring

```typescript
// Premium continuous monitoring
async function enableContinuousMonitoring(repoUrl: string, config: MonitorConfig) {
  await intel.charge(10.00, { 
    type: 'continuous',
    period: 'monthly',
    repo: repoUrl 
  });
  
  return RepoIntel.monitor(repoUrl, {
    frequency: config.frequency || 'daily',
    alerts: {
      newVulnerabilities: true,
      dependencyUpdates: true,
      securityScoreChange: true,
      threshold: config.alertThreshold || 'high'
    },
    notifications: config.notifications
  });
}
```

## Analysis Output

```typescript
interface RepoAnalysis {
  // Basic info
  name: string;
  url: string;
  languages: { [lang: string]: number };
  
  // Structure
  structure: {
    files: number;
    directories: number;
    packages?: string[];
  };
  
  // Dependencies (standard+)
  dependencies?: {
    direct: Dependency[];
    transitive: number;
    outdated: Dependency[];
  };
  
  // Security (deep+)
  security?: {
    score: number;
    vulnerabilities: Vulnerability[];
    secrets: SecretFinding[];
    recommendations: string[];
  };
  
  // Quality metrics
  quality?: {
    complexity: number;
    maintainability: number;
    testCoverage?: number;
  };
}
```

## Feature Matrix

| Feature | Free | Standard | Deep | Security |
|---------|------|----------|------|----------|
| Structure analysis | ✅ | ✅ | ✅ | ✅ |
| Language detection | ✅ | ✅ | ✅ | ✅ |
| Dependency scan | ❌ | ✅ | ✅ | ✅ |
| License check | ❌ | ✅ | ✅ | ✅ |
| Vulnerability scan | ❌ | ❌ | ✅ | ✅ |
| Code quality | ❌ | ❌ | ✅ | ✅ |
| SAST | ❌ | ❌ | ❌ | ✅ |
| Secret detection | ❌ | ❌ | ❌ | ✅ |
| SBOM generation | ❌ | ❌ | ❌ | ✅ |
| Price | $0 | $0.05 | $0.25 | $1.00 |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.65,      // Repo Intel maintainer
  ecosystem: 0.25,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + security scan costs
};
```

## MCP Tool Registration

```typescript
server.tool('analyze_repository', {
  description: 'Analyze GitHub repository with optional premium features',
  inputSchema: z.object({
    repoUrl: z.string().url(),
    depth: z.enum(['quick', 'standard', 'deep', 'security']).default('standard'),
    includeSBOM: z.boolean().default(false)
  }),
  handler: async (params) => {
    if (params.depth === 'security') {
      return securityAudit(params.repoUrl, { sbom: params.includeSBOM });
    }
    return analyzeRepo(params.repoUrl, params.depth);
  }
});
```

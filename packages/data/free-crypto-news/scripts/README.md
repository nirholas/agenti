# Scripts

Utility scripts for development, testing, and maintenance of Free Crypto News.

## Directory Structure

```
scripts/
├── generate-changelog.sh      # Generate changelog from git history
├── analyze-commits.js         # Compare commits against CHANGELOG.md
├── commit-stats.js            # Git repository statistics
├── CHANGELOG-AUTOMATION.md    # Full documentation for changelog tools
├── a11y-audit.js              # Accessibility audit runner
├── contrast-audit.js          # Color contrast checker
├── generate-pwa-icons.js      # Generate PWA icons from source
├── load-test.js               # API load testing
├── compare-repos.sh           # Repository comparison
├── sync-repos.sh              # Sync between repositories
├── sync-from-cda.sh           # Sync from CDA source
├── archive/                   # News archive collection scripts
│   ├── collect.js             # Basic archive collector
│   ├── collect-enhanced.js    # Enhanced collector with social data
│   └── stats.js               # Archive statistics
└── i18n/                      # Internationalization scripts
    ├── translate.ts           # Auto-translate messages
    └── validate.ts            # Validate translations
```

## Changelog Automation

### Generate Changelog
```bash
# Generate from all commits
./scripts/generate-changelog.sh

# Generate unreleased changes only
./scripts/generate-changelog.sh --unreleased

# Generate since specific version
./scripts/generate-changelog.sh --since=v2.5.0

# Output as JSON
./scripts/generate-changelog.sh --format=json
```

### Analyze Commits
```bash
# Full analysis report
node scripts/analyze-commits.js

# CI check (exits 1 if entries missing)
node scripts/analyze-commits.js --check

# Auto-update CHANGELOG.md
node scripts/analyze-commits.js --update
```

### Commit Statistics
```bash
# Full repository stats
node scripts/commit-stats.js

# JSON output for tooling
node scripts/commit-stats.js --json
```

📚 **Full Documentation:** See [CHANGELOG-AUTOMATION.md](./CHANGELOG-AUTOMATION.md)

## Accessibility & Quality

### Accessibility Audit
```bash
# Run full a11y audit
node scripts/a11y-audit.js

# Audit specific pages
node scripts/a11y-audit.js --pages=/,/about
```

### Contrast Audit
```bash
# Check color contrast ratios
node scripts/contrast-audit.js
```

## PWA & Assets

### Generate PWA Icons
```bash
# Generate all PWA icon sizes
node scripts/generate-pwa-icons.js
```

## Testing

### Load Testing
```bash
# Run API load tests
node scripts/load-test.js

# Custom concurrent users
node scripts/load-test.js --users=100
```

## Internationalization

```bash
# Translate to specific locale
GROQ_API_KEY=your-key npx tsx scripts/i18n/translate.ts --locale es

# Validate translations
npx tsx scripts/i18n/validate.ts --locale zh-CN
```

## Archive Management

```bash
# Collect today's news to archive
node scripts/archive/collect.js

# Enhanced collection with social data
node scripts/archive/collect-enhanced.js

# View archive statistics
node scripts/archive/stats.js
node scripts/archive/stats.js 2026-01
```

## Repository Sync

```bash
# Compare with another repository
./scripts/compare-repos.sh

# Sync repositories
./scripts/sync-repos.sh
```

## Adding New Scripts

1. Create your script in the `scripts/` directory
2. Add usage documentation at the top of the file
3. Update this README with script description
4. If complex, create a dedicated `SCRIPT-NAME.md` documentation file

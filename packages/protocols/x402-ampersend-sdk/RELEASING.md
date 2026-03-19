# Release Guide

This document describes how to release new versions of the Ampersend SDK packages to npm and PyPI.

## Prerequisites

The release workflows are designed to trust CI validation. Ensure the following are configured:

### Branch Protection

The `main` branch must have protection rules requiring CI workflows to pass before merging:

- ✅ Require status checks: `typescript-ci`, `python-ci`, `markdown-ci`
- ✅ Require branches to be up to date before merging
- ✅ Require pull request reviews

**Why:** Release workflows do not re-run validation checks. They rely on branch protection to ensure only validated code
reaches main and can be tagged for release.

### Environment Protection (Recommended)

For additional security, configure required reviewers on the `npm` and `pypi` environments:

- Navigate to: Repository Settings → Environments → npm/pypi
- Add required reviewers (release managers)
- Enable "Prevent self-review"

**Why:** Adds a human approval gate before publishing to registries, preventing accidental releases.

## Release Process

### TypeScript SDK

1. **Update version** in `typescript/packages/ampersend-sdk/package.json`

   ```bash
   # Edit version field
   vim typescript/packages/ampersend-sdk/package.json
   ```

2. **Create PR and merge to main**

   ```bash
   # Create feature branch
   git checkout -b release/ts-vX.Y.Z

   # Commit version change
   git add typescript/packages/ampersend-sdk/package.json
   git commit -m "chore(ts): bump version to X.Y.Z"

   # Push branch
   git push origin release/ts-vX.Y.Z

   # Create PR via GitHub UI and merge after approval
   ```

3. **Create and push tag from main**

   ```bash
   # Pull latest main after PR merge
   git checkout main
   git pull origin main

   # Create tag
   # For stable release
   git tag ts-vX.Y.Z

   # For alpha release
   git tag ts-vX.Y.Z-alpha.N

   # For beta release
   git tag ts-vX.Y.Z-beta.N

   # Push tag to trigger release
   git push origin ts-vX.Y.Z
   ```

4. **Monitor release**
   - View workflow: <https://github.com/edgeandnode/ampersend-sdk/actions/workflows/typescript-release.yml>
   - Check npm: <https://www.npmjs.com/package/@ampersend_ai/ampersend-sdk>

### Python SDK

1. **Update version** in `python/ampersend-sdk/pyproject.toml`

   ```bash
   # Edit version field
   vim python/ampersend-sdk/pyproject.toml
   uv sync
   ```

2. **Create PR and merge to main**

   ```bash
   # Create feature branch
   git checkout -b release/py-vX.Y.Z

   # Commit version change
   git add python/ampersend-sdk/pyproject.toml
   git commit -m "chore(py): bump version to X.Y.Z"

   # Push branch
   git push origin release/py-vX.Y.Z

   # Create PR via GitHub UI and merge after approval
   ```

3. **Create and push tag from main**

   ```bash
   # Pull latest main after PR merge
   git checkout main
   git pull origin main

   # Create tag
   # For stable release
   git tag py-vX.Y.Z

   # For alpha release (PEP 440)
   git tag py-vX.Y.ZaN

   # For beta release (PEP 440)
   git tag py-vX.Y.ZbN

   # For release candidate (PEP 440)
   git tag py-vX.Y.ZrcN

   # Push tag to trigger release
   git push origin py-vX.Y.Z
   ```

4. **Monitor release**
   - View workflow: <https://github.com/edgeandnode/ampersend-sdk/actions/workflows/python-release.yml>
   - Check PyPI: <https://pypi.org/project/ampersend-sdk/>

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: New features, backwards compatible
- **Patch (0.0.X)**: Bug fixes, backwards compatible

### Pre-releases

**TypeScript (npm style)**:

- `0.1.0-alpha.1` - Early testing, unstable
- `0.1.0-beta.1` - Feature complete, stabilizing

**Python (PEP 440 style)**:

- `0.1.0a1` - Alpha release
- `0.1.0b1` - Beta release
- `0.1.0rc1` - Release candidate

## Troubleshooting

### Version mismatch error

If the workflow fails with "versions do not match":

- Ensure the tag version (without prefix) exactly matches the package version
- Example: `ts-v0.1.0` must match `"version": "0.1.0"` in package.json

### npm publish fails

- Verify Trusted Publishing is configured correctly on npmjs.com
- Check workflow name and environment name match exactly
- Ensure organization, repository, and workflow filename are correct in npm settings

### PyPI publish fails

- Verify Trusted Publishing is configured correctly on PyPI
- Check workflow name and environment name match exactly

## Security

### npm Trusted Publishing

All npm packages are published using OIDC-based trusted publishing:

- More secure than API tokens
- No long-lived credentials to manage
- Uses GitHub's OIDC for authentication
- Automatically generates provenance attestations

### npm Provenance

All npm packages include provenance attestations:

- Proves the package was built by this specific GitHub workflow
- Visible on the npm package page
- Provides transparency and supply chain security

### PyPI Trusted Publishing

All Python packages use PyPI's trusted publishing:

- More secure than API tokens
- No long-lived credentials to manage
- Uses GitHub's OIDC for authentication
- Recommended by PyPI for all projects

## Support

For issues with releases:

- Check GitHub Actions logs for detailed error messages
- Review this guide and ensure all prerequisites are met
- Open an issue at <https://github.com/edgeandnode/ampersend-sdk/issues>

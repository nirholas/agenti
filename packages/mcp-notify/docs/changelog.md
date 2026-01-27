---
title: Changelog
description: All notable changes to MCP Notify
icon: material/history
---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MCP Server component for AI assistant integration
- Go SDK for programmatic access
- Dashboard subscription editing
- Railway deployment support
- Terraform deployment manifests
- Kubernetes deployment manifests
- Comprehensive documentation site

### Changed

- Upgraded to Go 1.24
- Improved diff engine performance
- Enhanced notification formatting

### Fixed

- Server history navigation in dashboard
- Database connection pooling

## [0.1.0] - 2024-01-01

### Added

- Initial release
- Core polling and diff engine
- Subscription management
- Notification channels:
  - Slack
  - Discord
  - Email
  - Telegram
  - Microsoft Teams
  - Webhooks
  - RSS/Atom feeds
- REST API
- CLI tool
- Docker support
- PostgreSQL storage
- Redis caching

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2024-01-01 | Initial release |

## Upgrade Guide

### From 0.x to 1.0

When 1.0 is released, this section will contain upgrade instructions.

## Release Process

1. Update version in `VERSION` file
2. Update this changelog
3. Create git tag: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`
5. GitHub Actions builds and releases

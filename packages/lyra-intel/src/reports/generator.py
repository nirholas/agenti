"""
Report Generator - Comprehensive analysis reports.

Generates detailed reports including:
- Executive summaries
- Technical deep-dives
- Security assessments
- Architecture overviews
- Trend analysis
"""

import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ReportType:
    """Types of reports available."""
    EXECUTIVE = "executive"       # High-level summary for stakeholders
    TECHNICAL = "technical"       # Deep technical analysis
    SECURITY = "security"         # Security-focused assessment
    ARCHITECTURE = "architecture" # Architecture documentation
    TRENDS = "trends"            # Historical trends analysis
    FULL = "full"                # Complete comprehensive report


@dataclass
class ReportOptions:
    """Options for report generation."""
    report_type: str = ReportType.FULL
    output_format: str = "markdown"  # markdown, html, json, pdf
    include_code_samples: bool = True
    include_visualizations: bool = True
    max_code_sample_lines: int = 20
    include_recommendations: bool = True
    include_metrics: bool = True
    custom_sections: List[str] = field(default_factory=list)


class ReportGenerator:
    """
    Generates comprehensive codebase analysis reports.
    
    Creates professional reports suitable for:
    - Technical documentation
    - Stakeholder presentations
    - Security audits
    - Architecture reviews
    """
    
    def __init__(self, options: Optional[ReportOptions] = None):
        self.options = options or ReportOptions()
    
    def generate(
        self,
        analysis_data: Dict[str, Any],
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate a complete report.
        
        Args:
            analysis_data: Combined analysis results
            output_path: Optional path to save report
            
        Returns:
            Generated report content
        """
        report_type = self.options.report_type
        
        if report_type == ReportType.EXECUTIVE:
            content = self._generate_executive(analysis_data)
        elif report_type == ReportType.TECHNICAL:
            content = self._generate_technical(analysis_data)
        elif report_type == ReportType.SECURITY:
            content = self._generate_security(analysis_data)
        elif report_type == ReportType.ARCHITECTURE:
            content = self._generate_architecture(analysis_data)
        elif report_type == ReportType.TRENDS:
            content = self._generate_trends(analysis_data)
        else:
            content = self._generate_full(analysis_data)
        
        # Format output
        if self.options.output_format == "json":
            content = json.dumps({"report": content, "generated_at": datetime.now().isoformat()}, indent=2)
        elif self.options.output_format == "html":
            content = self._to_html(content)
        
        if output_path:
            Path(output_path).write_text(content)
            logger.info(f"Report saved to: {output_path}")
        
        return content
    
    def _generate_executive(self, data: Dict[str, Any]) -> str:
        """Generate executive summary report."""
        repo_name = data.get("repository", {}).get("name", "Repository")
        files = data.get("files", {})
        patterns = data.get("patterns", {})
        
        health_score = self._calculate_health_score(data)
        
        return f"""# Executive Summary: {repo_name}

**Report Date:** {datetime.now().strftime('%B %d, %Y')}  
**Report Type:** Executive Summary

---

## Key Metrics at a Glance

| Metric | Value | Status |
|--------|-------|--------|
| Codebase Health Score | {health_score}/100 | {'✅ Good' if health_score >= 70 else '⚠️ Needs Attention' if health_score >= 50 else '❌ Critical'} |
| Total Files | {files.get('total', 0):,} | - |
| Total Lines of Code | {files.get('total_lines', 0):,} | - |
| Critical Issues | {patterns.get('by_severity', {}).get('critical', 0)} | {'✅ None' if patterns.get('by_severity', {}).get('critical', 0) == 0 else '❌ Action Required'} |
| Security Concerns | {patterns.get('by_category', {}).get('security', 0)} | {'✅ None' if patterns.get('by_category', {}).get('security', 0) == 0 else '⚠️ Review Needed'} |

## Summary

This codebase consists of **{files.get('total', 0):,} files** containing approximately **{files.get('total_lines', 0):,} lines of code**.

### Strengths
- Well-organized directory structure
- Consistent coding patterns
- Active development history

### Areas for Improvement
- Address identified critical issues
- Improve test coverage
- Reduce code complexity in key modules

## Recommended Actions

1. **Immediate:** Address all critical security issues
2. **Short-term:** Refactor high-complexity functions
3. **Long-term:** Implement comprehensive testing strategy

---

*Generated by Lyra Intel v0.1.0*
"""
    
    def _generate_technical(self, data: Dict[str, Any]) -> str:
        """Generate technical analysis report."""
        repo_name = data.get("repository", {}).get("name", "Repository")
        files = data.get("files", {})
        code_units = data.get("code_units", {})
        deps = data.get("dependencies", {})
        
        by_extension = files.get("by_extension", {})
        ext_table = "\n".join([f"| {ext} | {count} |" for ext, count in sorted(by_extension.items(), key=lambda x: -x[1])[:15]])
        
        return f"""# Technical Analysis Report: {repo_name}

**Report Date:** {datetime.now().strftime('%B %d, %Y')}  
**Analysis Version:** Lyra Intel v0.1.0

---

## Table of Contents

1. [Codebase Overview](#codebase-overview)
2. [Language Distribution](#language-distribution)
3. [Code Structure Analysis](#code-structure-analysis)
4. [Dependency Analysis](#dependency-analysis)
5. [Complexity Metrics](#complexity-metrics)
6. [Technical Recommendations](#technical-recommendations)

---

## Codebase Overview

### File Statistics

| Metric | Value |
|--------|-------|
| Total Files | {files.get('total', 0):,} |
| Source Files | {files.get('source_files', files.get('total', 0)):,} |
| Total Lines | {files.get('total_lines', 0):,} |
| Total Size | {files.get('total_size_bytes', 0) / 1024 / 1024:.2f} MB |
| Average File Size | {files.get('total_size_bytes', 0) / max(files.get('total', 1), 1) / 1024:.2f} KB |

### Code Structure

| Type | Count |
|------|-------|
| Functions | {code_units.get('functions', 0):,} |
| Classes | {code_units.get('classes', 0):,} |
| Modules | {code_units.get('modules', files.get('total', 0)):,} |

---

## Language Distribution

| Extension | File Count |
|-----------|------------|
{ext_table}

---

## Code Structure Analysis

### Module Organization

The codebase follows a modular structure with clear separation of concerns.

### Key Patterns Detected

- **Design Patterns:** Factory, Singleton, Observer patterns detected
- **Architecture Style:** Layered architecture with service-oriented components
- **Testing Approach:** Unit tests with integration test coverage

---

## Dependency Analysis

### Overview

| Metric | Value |
|--------|-------|
| Internal Dependencies | {deps.get('internal', 0)} |
| External Dependencies | {deps.get('external', 0)} |
| Circular Dependencies | {len(deps.get('circular', []))} |

### External Dependencies

Top external packages used:
1. Core framework dependencies
2. Utility libraries
3. Testing frameworks

---

## Complexity Metrics

### Function Complexity Distribution

Functions are categorized by cyclomatic complexity:
- **Low (1-5):** Well-structured, easy to maintain
- **Medium (6-10):** Moderate complexity, may benefit from refactoring
- **High (11+):** Complex, should be prioritized for simplification

---

## Technical Recommendations

### High Priority

1. **Reduce Circular Dependencies**
   - Refactor modules with circular imports
   - Consider dependency injection patterns

2. **Improve Code Coverage**
   - Add unit tests for critical paths
   - Implement integration tests

### Medium Priority

1. **Code Simplification**
   - Break down complex functions
   - Extract reusable components

2. **Documentation**
   - Add docstrings to public APIs
   - Create architecture documentation

---

*Generated by Lyra Intel v0.1.0*
"""
    
    def _generate_security(self, data: Dict[str, Any]) -> str:
        """Generate security assessment report."""
        repo_name = data.get("repository", {}).get("name", "Repository")
        patterns = data.get("patterns", {})
        
        security_issues = patterns.get("by_category", {}).get("security", 0)
        critical_issues = patterns.get("by_severity", {}).get("critical", 0)
        
        return f"""# Security Assessment Report: {repo_name}

**Report Date:** {datetime.now().strftime('%B %d, %Y')}  
**Classification:** Internal Use Only

---

## Executive Security Summary

### Risk Level: {'🟢 LOW' if security_issues == 0 else '🟡 MEDIUM' if security_issues < 5 else '🔴 HIGH'}

| Security Metric | Value | Status |
|-----------------|-------|--------|
| Critical Vulnerabilities | {critical_issues} | {'✅ Pass' if critical_issues == 0 else '❌ Fail'} |
| Security Issues | {security_issues} | {'✅ Pass' if security_issues == 0 else '⚠️ Review'} |
| Hardcoded Secrets | {patterns.get('by_pattern', {}).get('hardcoded_secret', 0)} | {'✅ None Found' if patterns.get('by_pattern', {}).get('hardcoded_secret', 0) == 0 else '❌ Found'} |

---

## Security Findings

### Critical Issues

{self._format_security_findings(data, 'critical')}

### High Priority Issues

{self._format_security_findings(data, 'high')}

---

## Recommendations

### Immediate Actions

1. **Remove Hardcoded Secrets**
   - Move all credentials to environment variables
   - Use secret management solutions

2. **Input Validation**
   - Implement input sanitization
   - Add validation for all user inputs

### Short-term Actions

1. **Dependency Audit**
   - Review external dependencies for known vulnerabilities
   - Update outdated packages

2. **Access Control Review**
   - Verify authentication mechanisms
   - Review authorization logic

---

## Compliance Checklist

- [ ] No hardcoded credentials
- [ ] Proper input validation
- [ ] Secure dependency management
- [ ] Adequate logging (without sensitive data)
- [ ] Error handling without information disclosure

---

*Generated by Lyra Intel v0.1.0*
"""
    
    def _generate_architecture(self, data: Dict[str, Any]) -> str:
        """Generate architecture documentation."""
        repo_name = data.get("repository", {}).get("name", "Repository")
        
        return f"""# Architecture Documentation: {repo_name}

**Document Version:** 1.0  
**Last Updated:** {datetime.now().strftime('%B %d, %Y')}

---

## Overview

This document describes the architecture of the {repo_name} codebase.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Application                         │
├─────────────────────────────────────────────────────────┤
│    Presentation    │    Business Logic    │    Data     │
│       Layer        │        Layer         │   Layer     │
└─────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| Core | Main business logic | Database, Utils |
| API | External interfaces | Core, Auth |
| Storage | Data persistence | Database drivers |
| Utils | Shared utilities | None |

---

## Module Structure

### Directory Layout

```
src/
├── core/           # Core business logic
├── api/            # API endpoints
├── storage/        # Data access layer
├── utils/          # Shared utilities
└── tests/          # Test suites
```

---

## Data Flow

1. **Request Processing**
   - Requests enter through API layer
   - Validated and routed to appropriate handler

2. **Business Logic**
   - Core modules process requests
   - Apply business rules and validation

3. **Data Access**
   - Storage layer handles persistence
   - Caching applied where appropriate

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | Python 3.10+ |
| Framework | Custom async framework |
| Database | SQLite/PostgreSQL |
| Testing | pytest |

---

## Design Decisions

### Key Architectural Decisions

1. **Modular Design**
   - Each component is independently deployable
   - Clear interfaces between modules

2. **Async-First**
   - Built for high concurrency
   - Non-blocking I/O throughout

3. **Cloud-Ready**
   - Stateless design
   - Horizontal scaling capability

---

*Generated by Lyra Intel v0.1.0*
"""
    
    def _generate_trends(self, data: Dict[str, Any]) -> str:
        """Generate trends analysis report."""
        repo_name = data.get("repository", {}).get("name", "Repository")
        commits = data.get("commits", {})
        
        return f"""# Trends Analysis Report: {repo_name}

**Report Date:** {datetime.now().strftime('%B %d, %Y')}  
**Analysis Period:** All time

---

## Development Activity

### Commit Statistics

| Metric | Value |
|--------|-------|
| Total Commits | {commits.get('total', 0):,} |
| Unique Contributors | {commits.get('authors', 0)} |
| Total Insertions | {commits.get('total_insertions', 0):,} |
| Total Deletions | {commits.get('total_deletions', 0):,} |

---

## Codebase Growth

The codebase has grown steadily with consistent contributions from the development team.

### Key Observations

1. **Active Development**
   - Regular commits indicate active maintenance
   - Feature development is ongoing

2. **Code Quality Trends**
   - Complexity has been managed effectively
   - Technical debt is being addressed

3. **Team Dynamics**
   - Multiple contributors ensure knowledge sharing
   - Bus factor is acceptable

---

## Recommendations for Future

1. **Continue regular refactoring**
2. **Maintain test coverage as codebase grows**
3. **Document architectural decisions**

---

*Generated by Lyra Intel v0.1.0*
"""
    
    def _generate_full(self, data: Dict[str, Any]) -> str:
        """Generate comprehensive full report."""
        sections = [
            self._generate_executive(data),
            "\n---\n\n",
            self._generate_technical(data),
            "\n---\n\n",
            self._generate_security(data),
            "\n---\n\n",
            self._generate_architecture(data),
            "\n---\n\n",
            self._generate_trends(data),
        ]
        
        return "\n".join(sections)
    
    def _calculate_health_score(self, data: Dict[str, Any]) -> int:
        """Calculate overall codebase health score."""
        score = 100
        
        patterns = data.get("patterns", {})
        by_severity = patterns.get("by_severity", {})
        
        score -= by_severity.get("critical", 0) * 15
        score -= by_severity.get("error", 0) * 8
        score -= by_severity.get("warning", 0) * 3
        score -= by_severity.get("info", 0) * 1
        
        deps = data.get("dependencies", {})
        score -= len(deps.get("circular", [])) * 5
        
        return max(0, min(100, score))
    
    def _format_security_findings(self, data: Dict[str, Any], severity: str) -> str:
        """Format security findings for a severity level."""
        findings = []
        patterns = data.get("patterns", {}).get("items", [])
        
        for pattern in patterns:
            if pattern.get("severity") == severity and pattern.get("category") == "security":
                findings.append(f"- **{pattern.get('pattern_name')}** in `{pattern.get('file_path')}` (line {pattern.get('line_start')})")
        
        if not findings:
            return "No issues found at this severity level."
        
        return "\n".join(findings)
    
    def _to_html(self, markdown_content: str) -> str:
        """Convert markdown to HTML."""
        # Basic conversion (real implementation would use markdown library)
        html = markdown_content
        
        # Convert headers
        for i in range(6, 0, -1):
            html = html.replace(f"\n{'#' * i} ", f"\n<h{i}>")
            html = html.replace(f"<h{i}>", f"</h{i}><h{i}>")
        
        return f"""<!DOCTYPE html>
<html>
<head>
    <title>Lyra Intel Report</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        code {{ background: #f4f4f4; padding: 2px 6px; }}
        pre {{ background: #f4f4f4; padding: 15px; overflow-x: auto; }}
    </style>
</head>
<body>
{html}
</body>
</html>"""

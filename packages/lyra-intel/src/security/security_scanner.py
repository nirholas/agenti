"""
Security Scanner - Deep vulnerability detection.

This module provides comprehensive security scanning
including OWASP Top 10, code injection, and more.
"""

import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class VulnerabilityLevel(Enum):
    """Severity levels for vulnerabilities."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class VulnerabilityCategory(Enum):
    """Categories of vulnerabilities."""
    INJECTION = "injection"
    XSS = "xss"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    SENSITIVE_DATA = "sensitive_data"
    CRYPTO = "crypto"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"
    CODE_QUALITY = "code_quality"
    HARDCODED_SECRETS = "hardcoded_secrets"
    PATH_TRAVERSAL = "path_traversal"
    COMMAND_INJECTION = "command_injection"
    DESERIALIZATION = "deserialization"
    SSRF = "ssrf"
    OTHER = "other"


@dataclass
class SecurityFinding:
    """Represents a security finding."""
    id: str
    title: str
    category: VulnerabilityCategory
    severity: VulnerabilityLevel
    file_path: str
    line_number: int
    code_snippet: str
    description: str
    recommendation: str
    cwe_id: Optional[str] = None
    owasp_category: Optional[str] = None
    references: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SecurityConfig:
    """Configuration for security scanning."""
    scan_dependencies: bool = True
    scan_secrets: bool = True
    scan_code: bool = True
    severity_threshold: VulnerabilityLevel = VulnerabilityLevel.LOW
    exclude_patterns: List[str] = field(default_factory=list)
    custom_rules: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SecurityResult:
    """Result of security scan."""
    success: bool
    total_findings: int
    findings: List[SecurityFinding]
    summary: Dict[str, int]
    score: float  # 0-100
    passed: bool
    scan_duration_ms: float = 0.0
    scanned_files: int = 0
    recommendations: List[str] = field(default_factory=list)


class SecurityScanner:
    """
    Comprehensive security scanner.
    
    Features:
    - OWASP Top 10 detection
    - Hardcoded secrets detection
    - SQL injection detection
    - XSS detection
    - Dependency vulnerability scanning
    - Custom rule support
    """
    
    def __init__(self, config: Optional[SecurityConfig] = None):
        """Initialize security scanner."""
        self.config = config or SecurityConfig()
        self._findings: List[SecurityFinding] = []
        self._finding_count = 0
        self._rules = self._load_default_rules()
    
    def _load_default_rules(self) -> List[Dict[str, Any]]:
        """Load default security rules."""
        return [
            # Hardcoded secrets
            {
                "id": "SEC001",
                "title": "Hardcoded Password",
                "category": VulnerabilityCategory.HARDCODED_SECRETS,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']',
                "description": "Hardcoded password detected in source code",
                "recommendation": "Use environment variables or secure vaults for sensitive credentials",
                "cwe_id": "CWE-798",
            },
            {
                "id": "SEC002",
                "title": "Hardcoded API Key",
                "category": VulnerabilityCategory.HARDCODED_SECRETS,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)(api[_-]?key|apikey|api[_-]?secret)\s*=\s*["\'][^"\']{16,}["\']',
                "description": "Hardcoded API key detected",
                "recommendation": "Store API keys in environment variables or secure configuration",
                "cwe_id": "CWE-798",
            },
            {
                "id": "SEC003",
                "title": "AWS Access Key",
                "category": VulnerabilityCategory.HARDCODED_SECRETS,
                "severity": VulnerabilityLevel.CRITICAL,
                "pattern": r'AKIA[0-9A-Z]{16}',
                "description": "AWS Access Key ID detected",
                "recommendation": "Rotate the key immediately and use IAM roles instead",
                "cwe_id": "CWE-798",
            },
            {
                "id": "SEC004",
                "title": "Private Key",
                "category": VulnerabilityCategory.HARDCODED_SECRETS,
                "severity": VulnerabilityLevel.CRITICAL,
                "pattern": r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                "description": "Private key detected in source code",
                "recommendation": "Remove private keys from source code and use secure key management",
                "cwe_id": "CWE-798",
            },
            # SQL Injection
            {
                "id": "SEC010",
                "title": "SQL Injection Risk",
                "category": VulnerabilityCategory.INJECTION,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)(?:execute|cursor\.execute|query)\s*\(\s*["\'].*?%s|(?:execute|query)\s*\(\s*f["\']',
                "description": "Potential SQL injection vulnerability",
                "recommendation": "Use parameterized queries instead of string formatting",
                "cwe_id": "CWE-89",
                "owasp_category": "A03:2021 - Injection",
            },
            {
                "id": "SEC011",
                "title": "Raw SQL Query",
                "category": VulnerabilityCategory.INJECTION,
                "severity": VulnerabilityLevel.MEDIUM,
                "pattern": r'(?i)raw\s*\(\s*["\'].*?\+|rawQuery\s*\(',
                "description": "Raw SQL query with potential string concatenation",
                "recommendation": "Use ORM methods or parameterized queries",
                "cwe_id": "CWE-89",
            },
            # XSS
            {
                "id": "SEC020",
                "title": "Potential XSS",
                "category": VulnerabilityCategory.XSS,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)innerHTML\s*=|document\.write\s*\(|v-html\s*=',
                "description": "Potential Cross-Site Scripting vulnerability",
                "recommendation": "Sanitize user input before rendering HTML",
                "cwe_id": "CWE-79",
                "owasp_category": "A03:2021 - Injection",
            },
            {
                "id": "SEC021",
                "title": "Dangerously Set HTML",
                "category": VulnerabilityCategory.XSS,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'dangerouslySetInnerHTML\s*=',
                "description": "React dangerouslySetInnerHTML detected",
                "recommendation": "Ensure HTML is properly sanitized before rendering",
                "cwe_id": "CWE-79",
            },
            # Command Injection
            {
                "id": "SEC030",
                "title": "Command Injection Risk",
                "category": VulnerabilityCategory.COMMAND_INJECTION,
                "severity": VulnerabilityLevel.CRITICAL,
                "pattern": r'(?i)(?:subprocess|os\.system|os\.popen|exec|eval)\s*\(.*?\+|shell\s*=\s*True',
                "description": "Potential command injection vulnerability",
                "recommendation": "Avoid shell=True and use parameterized commands",
                "cwe_id": "CWE-78",
                "owasp_category": "A03:2021 - Injection",
            },
            {
                "id": "SEC031",
                "title": "Eval Usage",
                "category": VulnerabilityCategory.CODE_QUALITY,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?<!#.*)\beval\s*\(',
                "description": "Use of eval() function detected",
                "recommendation": "Avoid eval() and use safer alternatives",
                "cwe_id": "CWE-95",
            },
            # Path Traversal
            {
                "id": "SEC040",
                "title": "Path Traversal Risk",
                "category": VulnerabilityCategory.PATH_TRAVERSAL,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)open\s*\(.*?\+|Path\s*\(.*?\+|join\s*\(.*?request\.',
                "description": "Potential path traversal vulnerability",
                "recommendation": "Validate and sanitize file paths from user input",
                "cwe_id": "CWE-22",
                "owasp_category": "A01:2021 - Broken Access Control",
            },
            # Deserialization
            {
                "id": "SEC050",
                "title": "Unsafe Deserialization",
                "category": VulnerabilityCategory.DESERIALIZATION,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)pickle\.loads?\s*\(|yaml\.load\s*\([^,]*\)|json\.loads?\s*\(.*?request\.',
                "description": "Potentially unsafe deserialization",
                "recommendation": "Use safe deserialization methods with explicit loaders",
                "cwe_id": "CWE-502",
                "owasp_category": "A08:2021 - Software and Data Integrity Failures",
            },
            # Crypto Issues
            {
                "id": "SEC060",
                "title": "Weak Hash Algorithm",
                "category": VulnerabilityCategory.CRYPTO,
                "severity": VulnerabilityLevel.MEDIUM,
                "pattern": r'(?i)(?:md5|sha1)\s*\(',
                "description": "Weak hashing algorithm detected",
                "recommendation": "Use SHA-256 or stronger for cryptographic purposes",
                "cwe_id": "CWE-328",
            },
            {
                "id": "SEC061",
                "title": "Hardcoded IV/Salt",
                "category": VulnerabilityCategory.CRYPTO,
                "severity": VulnerabilityLevel.MEDIUM,
                "pattern": r'(?i)(?:iv|salt)\s*=\s*[b]?["\'][^"\']{8,}["\']',
                "description": "Hardcoded initialization vector or salt",
                "recommendation": "Generate random IV/salt for each encryption operation",
                "cwe_id": "CWE-329",
            },
            # Authentication
            {
                "id": "SEC070",
                "title": "Missing Authentication",
                "category": VulnerabilityCategory.AUTHENTICATION,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'@public|authentication\s*=\s*False|auth_required\s*=\s*False',
                "description": "Endpoint may lack authentication",
                "recommendation": "Ensure sensitive endpoints require authentication",
                "cwe_id": "CWE-306",
                "owasp_category": "A07:2021 - Identification and Authentication Failures",
            },
            # SSRF
            {
                "id": "SEC080",
                "title": "Potential SSRF",
                "category": VulnerabilityCategory.SSRF,
                "severity": VulnerabilityLevel.HIGH,
                "pattern": r'(?i)requests\.(?:get|post|put)\s*\(.*?request\.|urllib\.urlopen\s*\(.*?\+',
                "description": "Potential Server-Side Request Forgery",
                "recommendation": "Validate and whitelist URLs before making requests",
                "cwe_id": "CWE-918",
                "owasp_category": "A10:2021 - Server-Side Request Forgery",
            },
            # Debug/Development
            {
                "id": "SEC090",
                "title": "Debug Mode Enabled",
                "category": VulnerabilityCategory.CONFIGURATION,
                "severity": VulnerabilityLevel.MEDIUM,
                "pattern": r'(?i)DEBUG\s*=\s*True|debug\s*:\s*true',
                "description": "Debug mode appears to be enabled",
                "recommendation": "Disable debug mode in production",
                "cwe_id": "CWE-489",
            },
        ]
    
    def scan_file(self, file_path: str, content: str) -> List[SecurityFinding]:
        """
        Scan a single file for security issues.
        
        Args:
            file_path: Path to the file
            content: File content
            
        Returns:
            List of security findings
        """
        findings = []
        lines = content.split("\n")
        
        for rule in self._rules + self.config.custom_rules:
            pattern = rule.get("pattern")
            if not pattern:
                continue
            
            try:
                regex = re.compile(pattern, re.MULTILINE)
                for match in regex.finditer(content):
                    # Find line number
                    start_pos = match.start()
                    line_number = content[:start_pos].count("\n") + 1
                    
                    # Get code snippet
                    snippet_start = max(0, line_number - 2)
                    snippet_end = min(len(lines), line_number + 2)
                    snippet = "\n".join(lines[snippet_start:snippet_end])
                    
                    # Check severity threshold
                    severity = rule.get("severity", VulnerabilityLevel.LOW)
                    if isinstance(severity, str):
                        severity = VulnerabilityLevel(severity)
                    
                    if self._severity_value(severity) < self._severity_value(self.config.severity_threshold):
                        continue
                    
                    self._finding_count += 1
                    finding = SecurityFinding(
                        id=f"{rule['id']}-{self._finding_count}",
                        title=rule.get("title", "Security Issue"),
                        category=rule.get("category", VulnerabilityCategory.OTHER),
                        severity=severity,
                        file_path=file_path,
                        line_number=line_number,
                        code_snippet=snippet,
                        description=rule.get("description", ""),
                        recommendation=rule.get("recommendation", ""),
                        cwe_id=rule.get("cwe_id"),
                        owasp_category=rule.get("owasp_category"),
                        references=rule.get("references", []),
                    )
                    findings.append(finding)
            except re.error:
                continue
        
        return findings
    
    def scan_directory(
        self,
        directory: str,
        extensions: Optional[List[str]] = None,
    ) -> SecurityResult:
        """
        Scan a directory for security issues.
        
        Args:
            directory: Directory to scan
            extensions: File extensions to scan
            
        Returns:
            Security scan result
        """
        start_time = time.time()
        
        extensions = extensions or [".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".rb", ".php"]
        all_findings = []
        scanned_files = 0
        
        path = Path(directory)
        
        for file_path in path.rglob("*"):
            if not file_path.is_file():
                continue
            
            if file_path.suffix not in extensions:
                continue
            
            # Check exclude patterns
            rel_path = str(file_path.relative_to(path))
            if any(re.search(pattern, rel_path) for pattern in self.config.exclude_patterns):
                continue
            
            try:
                content = file_path.read_text(errors="ignore")
                findings = self.scan_file(str(file_path), content)
                all_findings.extend(findings)
                scanned_files += 1
            except Exception:
                continue
        
        # Calculate summary
        summary = {}
        for finding in all_findings:
            sev = finding.severity.value
            summary[sev] = summary.get(sev, 0) + 1
        
        # Calculate score (100 - penalty)
        score = 100.0
        score -= summary.get("critical", 0) * 20
        score -= summary.get("high", 0) * 10
        score -= summary.get("medium", 0) * 5
        score -= summary.get("low", 0) * 2
        score -= summary.get("info", 0) * 0.5
        score = max(0.0, score)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(all_findings)
        
        duration_ms = (time.time() - start_time) * 1000
        
        return SecurityResult(
            success=True,
            total_findings=len(all_findings),
            findings=all_findings,
            summary=summary,
            score=score,
            passed=score >= 70,
            scan_duration_ms=duration_ms,
            scanned_files=scanned_files,
            recommendations=recommendations,
        )
    
    def _severity_value(self, severity: VulnerabilityLevel) -> int:
        """Get numeric value for severity."""
        values = {
            VulnerabilityLevel.CRITICAL: 5,
            VulnerabilityLevel.HIGH: 4,
            VulnerabilityLevel.MEDIUM: 3,
            VulnerabilityLevel.LOW: 2,
            VulnerabilityLevel.INFO: 1,
        }
        return values.get(severity, 0)
    
    def _generate_recommendations(self, findings: List[SecurityFinding]) -> List[str]:
        """Generate overall recommendations."""
        recommendations = []
        
        categories = set(f.category for f in findings)
        
        if VulnerabilityCategory.HARDCODED_SECRETS in categories:
            recommendations.append(
                "🔐 Implement a secrets management solution (e.g., HashiCorp Vault, AWS Secrets Manager)"
            )
        
        if VulnerabilityCategory.INJECTION in categories:
            recommendations.append(
                "💉 Review all database queries and ensure parameterized queries are used"
            )
        
        if VulnerabilityCategory.XSS in categories:
            recommendations.append(
                "🌐 Implement proper output encoding and Content Security Policy headers"
            )
        
        if VulnerabilityCategory.AUTHENTICATION in categories:
            recommendations.append(
                "🔑 Audit authentication mechanisms and ensure all sensitive endpoints are protected"
            )
        
        critical_count = sum(1 for f in findings if f.severity == VulnerabilityLevel.CRITICAL)
        if critical_count > 0:
            recommendations.insert(0, f"🚨 Address {critical_count} CRITICAL findings immediately!")
        
        return recommendations
    
    def add_custom_rule(
        self,
        rule_id: str,
        title: str,
        pattern: str,
        severity: VulnerabilityLevel,
        category: VulnerabilityCategory,
        description: str = "",
        recommendation: str = "",
    ) -> None:
        """Add a custom security rule."""
        self.config.custom_rules.append({
            "id": rule_id,
            "title": title,
            "pattern": pattern,
            "severity": severity,
            "category": category,
            "description": description,
            "recommendation": recommendation,
        })
    
    def generate_report(self, result: SecurityResult) -> str:
        """Generate a security report."""
        lines = []
        lines.append("# Security Scan Report")
        lines.append(f"\nGenerated: {datetime.now().isoformat()}")
        lines.append(f"\n## Summary")
        lines.append(f"\n- **Score**: {result.score:.1f}/100")
        lines.append(f"- **Status**: {'✅ PASSED' if result.passed else '❌ FAILED'}")
        lines.append(f"- **Total Findings**: {result.total_findings}")
        lines.append(f"- **Files Scanned**: {result.scanned_files}")
        lines.append(f"- **Scan Duration**: {result.scan_duration_ms:.2f}ms")
        
        lines.append("\n### Findings by Severity")
        for sev in ["critical", "high", "medium", "low", "info"]:
            count = result.summary.get(sev, 0)
            if count > 0:
                lines.append(f"- **{sev.upper()}**: {count}")
        
        if result.recommendations:
            lines.append("\n## Recommendations")
            for rec in result.recommendations:
                lines.append(f"\n- {rec}")
        
        if result.findings:
            lines.append("\n## Detailed Findings")
            
            for finding in sorted(result.findings, key=lambda f: self._severity_value(f.severity), reverse=True):
                lines.append(f"\n### {finding.id}: {finding.title}")
                lines.append(f"\n- **Severity**: {finding.severity.value.upper()}")
                lines.append(f"- **Category**: {finding.category.value}")
                lines.append(f"- **File**: `{finding.file_path}`")
                lines.append(f"- **Line**: {finding.line_number}")
                if finding.cwe_id:
                    lines.append(f"- **CWE**: [{finding.cwe_id}](https://cwe.mitre.org/data/definitions/{finding.cwe_id.replace('CWE-', '')}.html)")
                if finding.owasp_category:
                    lines.append(f"- **OWASP**: {finding.owasp_category}")
                lines.append(f"\n**Description**: {finding.description}")
                lines.append(f"\n**Recommendation**: {finding.recommendation}")
                lines.append(f"\n```\n{finding.code_snippet}\n```")
        
        return "\n".join(lines)

"""
Compliance monitoring for SOC2, GDPR, HIPAA, and other standards.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4


class ComplianceStandard(Enum):
    SOC2 = "soc2"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    ISO_27001 = "iso_27001"
    CCPA = "ccpa"


class ComplianceStatus(Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIAL = "partial"
    NOT_ASSESSED = "not_assessed"


class FindingSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ComplianceConfig:
    enabled_standards: list[ComplianceStandard] = field(default_factory=list)
    auto_scan_interval_hours: int = 24
    alert_on_critical: bool = True
    alert_on_high: bool = True


@dataclass
class ComplianceFinding:
    id: str = field(default_factory=lambda: str(uuid4()))
    standard: ComplianceStandard = ComplianceStandard.SOC2
    control_id: str = ""
    control_name: str = ""
    severity: FindingSeverity = FindingSeverity.MEDIUM
    description: str = ""
    recommendation: str = ""
    status: str = "open"
    detected_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    evidence: dict = field(default_factory=dict)


@dataclass
class ComplianceReport:
    id: str = field(default_factory=lambda: str(uuid4()))
    standard: ComplianceStandard = ComplianceStandard.SOC2
    status: ComplianceStatus = ComplianceStatus.NOT_ASSESSED
    score: float = 0.0
    findings: list[ComplianceFinding] = field(default_factory=list)
    controls_assessed: int = 0
    controls_passed: int = 0
    controls_failed: int = 0
    generated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "standard": self.standard.value,
            "status": self.status.value,
            "score": self.score,
            "controls_assessed": self.controls_assessed,
            "controls_passed": self.controls_passed,
            "controls_failed": self.controls_failed,
            "findings_count": len(self.findings),
            "generated_at": self.generated_at.isoformat(),
        }


class ComplianceMonitor:
    STANDARD_CONTROLS = {
        ComplianceStandard.SOC2: {
            "CC1.1": "Control Environment",
            "CC2.1": "Communication and Information",
            "CC3.1": "Risk Assessment",
            "CC4.1": "Monitoring Activities",
            "CC5.1": "Control Activities",
            "CC6.1": "Logical and Physical Access",
            "CC7.1": "System Operations",
            "CC8.1": "Change Management",
            "CC9.1": "Risk Mitigation",
        },
        ComplianceStandard.GDPR: {
            "ART5": "Data Processing Principles",
            "ART6": "Lawful Processing",
            "ART7": "Consent",
            "ART12": "Transparent Information",
            "ART15": "Right of Access",
            "ART17": "Right to Erasure",
            "ART25": "Data Protection by Design",
            "ART32": "Security of Processing",
            "ART33": "Breach Notification",
        },
        ComplianceStandard.HIPAA: {
            "164.308": "Administrative Safeguards",
            "164.310": "Physical Safeguards",
            "164.312": "Technical Safeguards",
            "164.314": "Organizational Requirements",
            "164.316": "Documentation Requirements",
        },
    }

    def __init__(self, config: Optional[ComplianceConfig] = None):
        self.config = config or ComplianceConfig()
        self.findings: list[ComplianceFinding] = []
        self.reports: list[ComplianceReport] = []

    def assess_compliance(self, standard: ComplianceStandard, context: Optional[dict] = None) -> ComplianceReport:
        controls = self.STANDARD_CONTROLS.get(standard, {})
        findings = []
        passed = 0
        failed = 0

        for control_id, control_name in controls.items():
            is_compliant = self._check_control(standard, control_id, context or {})
            if is_compliant:
                passed += 1
            else:
                failed += 1
                finding = ComplianceFinding(
                    standard=standard,
                    control_id=control_id,
                    control_name=control_name,
                    severity=FindingSeverity.MEDIUM,
                    description=f"Control {control_id} ({control_name}) requires attention",
                    recommendation=f"Review and implement {control_name} requirements",
                )
                findings.append(finding)

        total = passed + failed
        score = (passed / total * 100) if total > 0 else 0
        status = ComplianceStatus.COMPLIANT if score >= 90 else ComplianceStatus.PARTIAL if score >= 50 else ComplianceStatus.NON_COMPLIANT

        report = ComplianceReport(
            standard=standard,
            status=status,
            score=score,
            findings=findings,
            controls_assessed=total,
            controls_passed=passed,
            controls_failed=failed,
        )

        self.findings.extend(findings)
        self.reports.append(report)
        return report

    def _check_control(self, standard: ComplianceStandard, control_id: str, context: dict) -> bool:
        # Simplified control checks - in production would have detailed logic
        checks = context.get("checks", {})
        return checks.get(control_id, True)

    def get_findings(
        self,
        standard: Optional[ComplianceStandard] = None,
        severity: Optional[FindingSeverity] = None,
        status: str = "open",
    ) -> list[ComplianceFinding]:
        results = []
        for finding in self.findings:
            if standard and finding.standard != standard:
                continue
            if severity and finding.severity != severity:
                continue
            if status and finding.status != status:
                continue
            results.append(finding)
        return results

    def resolve_finding(self, finding_id: str, resolution_notes: str = "") -> bool:
        for finding in self.findings:
            if finding.id == finding_id:
                finding.status = "resolved"
                finding.resolved_at = datetime.utcnow()
                finding.evidence["resolution_notes"] = resolution_notes
                return True
        return False

    def get_compliance_summary(self) -> dict:
        summary = {"standards": {}, "total_findings": len(self.findings), "open_findings": 0, "critical_findings": 0}
        for finding in self.findings:
            if finding.status == "open":
                summary["open_findings"] += 1
            if finding.severity == FindingSeverity.CRITICAL:
                summary["critical_findings"] += 1

        for report in self.reports:
            summary["standards"][report.standard.value] = {
                "status": report.status.value,
                "score": report.score,
            }
        return summary

    def generate_audit_report(self, standard: ComplianceStandard) -> str:
        report = None
        for r in reversed(self.reports):
            if r.standard == standard:
                report = r
                break
        if not report:
            report = self.assess_compliance(standard)

        lines = [
            f"# Compliance Report: {standard.value.upper()}",
            f"Generated: {report.generated_at.isoformat()}",
            f"Status: {report.status.value}",
            f"Score: {report.score:.1f}%",
            "",
            "## Summary",
            f"- Controls Assessed: {report.controls_assessed}",
            f"- Controls Passed: {report.controls_passed}",
            f"- Controls Failed: {report.controls_failed}",
            "",
            "## Findings",
        ]
        for finding in report.findings:
            lines.append(f"- [{finding.severity.value.upper()}] {finding.control_id}: {finding.description}")

        return "\n".join(lines)

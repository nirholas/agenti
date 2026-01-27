"""
Migration Planner - Automated migration planning and execution.

This module helps plan and execute code migrations including:
- Framework upgrades
- Language version upgrades
- API migrations
- Dependency updates
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class MigrationStatus(Enum):
    """Status of a migration."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class MigrationRisk(Enum):
    """Risk level of a migration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class MigrationStep:
    """Represents a single migration step."""
    id: str
    name: str
    description: str
    file_path: Optional[str] = None
    changes: List[Dict[str, Any]] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    status: MigrationStatus = MigrationStatus.PLANNED
    risk: MigrationRisk = MigrationRisk.LOW
    rollback_commands: List[str] = field(default_factory=list)
    validation_commands: List[str] = field(default_factory=list)


@dataclass
class MigrationPlan:
    """Represents a complete migration plan."""
    id: str
    name: str
    description: str
    source_version: str
    target_version: str
    steps: List[MigrationStep] = field(default_factory=list)
    status: MigrationStatus = MigrationStatus.PLANNED
    overall_risk: MigrationRisk = MigrationRisk.LOW
    estimated_hours: float = 0.0
    affected_files: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


class MigrationPlanner:
    """
    Plans and assists with code migrations.
    
    Features:
    - Analyze migration requirements
    - Generate migration steps
    - Estimate effort and risk
    - Track migration progress
    """
    
    def __init__(self):
        """Initialize migration planner."""
        self._migration_patterns: Dict[str, List[Dict[str, Any]]] = {}
        self._load_default_patterns()
    
    def _load_default_patterns(self) -> None:
        """Load default migration patterns."""
        self._migration_patterns = {
            "python_2_to_3": [
                {
                    "name": "Print Statement",
                    "find": r"print\s+[^(]",
                    "replace": r"print()",
                    "description": "Convert print statements to print function",
                },
                {
                    "name": "Unicode Strings",
                    "find": r"u\"",
                    "replace": "\"",
                    "description": "Remove u prefix from strings (default in Python 3)",
                },
            ],
            "react_class_to_hooks": [
                {
                    "name": "componentDidMount",
                    "find": r"componentDidMount\(\)",
                    "replace": "useEffect(() => { }, [])",
                    "description": "Convert componentDidMount to useEffect",
                },
                {
                    "name": "State",
                    "find": r"this\.state\.",
                    "replace": "// useState hook",
                    "description": "Convert state to useState",
                },
            ],
            "express_4_to_5": [
                {
                    "name": "Router",
                    "find": r"express\.Router\(\)",
                    "replace": "express.Router()",
                    "description": "Update router syntax",
                },
            ],
        }
    
    def create_plan(
        self,
        name: str,
        source_version: str,
        target_version: str,
        files: List[str],
        migration_type: str,
    ) -> MigrationPlan:
        """
        Create a migration plan.
        
        Args:
            name: Name of the migration
            source_version: Current version
            target_version: Target version
            files: Files to migrate
            migration_type: Type of migration
            
        Returns:
            Migration plan
        """
        plan_id = f"mig-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        steps = []
        patterns = self._migration_patterns.get(migration_type, [])
        
        for i, pattern in enumerate(patterns):
            step = MigrationStep(
                id=f"{plan_id}-step-{i+1}",
                name=pattern["name"],
                description=pattern["description"],
                changes=[{
                    "find": pattern["find"],
                    "replace": pattern["replace"],
                }],
                risk=MigrationRisk.LOW,
            )
            steps.append(step)
        
        # Estimate effort
        estimated_hours = len(files) * 0.1 + len(steps) * 0.5
        
        # Calculate overall risk
        if len(files) > 100:
            overall_risk = MigrationRisk.HIGH
        elif len(files) > 50:
            overall_risk = MigrationRisk.MEDIUM
        else:
            overall_risk = MigrationRisk.LOW
        
        return MigrationPlan(
            id=plan_id,
            name=name,
            description=f"Migration from {source_version} to {target_version}",
            source_version=source_version,
            target_version=target_version,
            steps=steps,
            overall_risk=overall_risk,
            estimated_hours=estimated_hours,
            affected_files=len(files),
        )
    
    def analyze_dependencies(
        self,
        dependencies: Dict[str, str],
        target_dependencies: Dict[str, str],
    ) -> List[MigrationStep]:
        """
        Analyze dependency migrations needed.
        
        Args:
            dependencies: Current dependencies
            target_dependencies: Target dependencies
            
        Returns:
            List of migration steps
        """
        steps = []
        
        for package, current_version in dependencies.items():
            target_version = target_dependencies.get(package)
            
            if target_version and current_version != target_version:
                steps.append(MigrationStep(
                    id=f"dep-{package}",
                    name=f"Update {package}",
                    description=f"Update {package} from {current_version} to {target_version}",
                    changes=[{
                        "type": "dependency_update",
                        "package": package,
                        "from": current_version,
                        "to": target_version,
                    }],
                    risk=self._assess_dependency_risk(package, current_version, target_version),
                ))
        
        return steps
    
    def _assess_dependency_risk(
        self,
        package: str,
        from_version: str,
        to_version: str,
    ) -> MigrationRisk:
        """Assess risk of a dependency update."""
        # Simple heuristic based on version difference
        try:
            from_parts = [int(x) for x in from_version.split(".") if x.isdigit()]
            to_parts = [int(x) for x in to_version.split(".") if x.isdigit()]
            
            if from_parts and to_parts:
                # Major version change
                if from_parts[0] != to_parts[0]:
                    return MigrationRisk.HIGH
                # Minor version change
                elif len(from_parts) > 1 and len(to_parts) > 1 and from_parts[1] != to_parts[1]:
                    return MigrationRisk.MEDIUM
        except Exception:
            pass
        
        return MigrationRisk.LOW
    
    def generate_report(self, plan: MigrationPlan) -> str:
        """Generate a migration report."""
        lines = []
        lines.append(f"# Migration Plan: {plan.name}")
        lines.append(f"\nID: {plan.id}")
        lines.append(f"Created: {plan.created_at.isoformat()}")
        lines.append(f"\n## Overview")
        lines.append(f"\n- **Source Version**: {plan.source_version}")
        lines.append(f"- **Target Version**: {plan.target_version}")
        lines.append(f"- **Status**: {plan.status.value}")
        lines.append(f"- **Risk Level**: {plan.overall_risk.value.upper()}")
        lines.append(f"- **Estimated Hours**: {plan.estimated_hours:.1f}")
        lines.append(f"- **Affected Files**: {plan.affected_files}")
        
        lines.append(f"\n## Steps ({len(plan.steps)})")
        for step in plan.steps:
            status_icon = "✅" if step.status == MigrationStatus.COMPLETED else "⏳"
            lines.append(f"\n### {status_icon} {step.name}")
            lines.append(f"\n{step.description}")
            lines.append(f"\n- **Risk**: {step.risk.value}")
            if step.file_path:
                lines.append(f"- **File**: {step.file_path}")
        
        return "\n".join(lines)

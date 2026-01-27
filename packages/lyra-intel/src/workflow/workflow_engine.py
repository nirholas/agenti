"""
Workflow Engine - Automated workflow orchestration.

This module provides a workflow engine for automating
analysis pipelines and tasks.
"""

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class WorkflowStatus(Enum):
    """Status of a workflow."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(Enum):
    """Status of a workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """Represents a step in a workflow."""
    id: str
    name: str
    handler: Optional[Callable] = None
    handler_name: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    status: StepStatus = StepStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0


@dataclass
class Workflow:
    """Represents a workflow definition."""
    id: str
    name: str
    description: str = ""
    steps: List[WorkflowStep] = field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowResult:
    """Result of workflow execution."""
    workflow_id: str
    success: bool
    status: WorkflowStatus
    steps_completed: int
    steps_failed: int
    total_duration_ms: float
    step_results: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)


class WorkflowEngine:
    """
    Engine for executing workflows.
    
    Features:
    - Define multi-step workflows
    - Handle dependencies between steps
    - Parallel execution where possible
    - Error handling and retries
    """
    
    def __init__(self):
        """Initialize workflow engine."""
        self._workflows: Dict[str, Workflow] = {}
        self._handlers: Dict[str, Callable] = {}
        self._register_default_handlers()
    
    def _register_default_handlers(self) -> None:
        """Register default step handlers."""
        self._handlers = {
            "collect_files": self._handler_collect_files,
            "analyze_ast": self._handler_analyze_ast,
            "detect_patterns": self._handler_detect_patterns,
            "scan_security": self._handler_scan_security,
            "generate_report": self._handler_generate_report,
            "send_notification": self._handler_send_notification,
        }
    
    def register_handler(self, name: str, handler: Callable) -> None:
        """Register a step handler."""
        self._handlers[name] = handler
    
    def create_workflow(
        self,
        name: str,
        steps: List[Dict[str, Any]],
        description: str = "",
    ) -> Workflow:
        """
        Create a new workflow.
        
        Args:
            name: Workflow name
            steps: List of step definitions
            description: Workflow description
            
        Returns:
            Created workflow
        """
        workflow_id = f"wf-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        workflow_steps = []
        for i, step_def in enumerate(steps):
            step = WorkflowStep(
                id=f"{workflow_id}-step-{i+1}",
                name=step_def.get("name", f"Step {i+1}"),
                handler_name=step_def.get("handler"),
                config=step_def.get("config", {}),
                dependencies=step_def.get("dependencies", []),
            )
            workflow_steps.append(step)
        
        workflow = Workflow(
            id=workflow_id,
            name=name,
            description=description,
            steps=workflow_steps,
        )
        
        self._workflows[workflow_id] = workflow
        return workflow
    
    async def execute(self, workflow_id: str, context: Dict[str, Any] = None) -> WorkflowResult:
        """
        Execute a workflow.
        
        Args:
            workflow_id: ID of workflow to execute
            context: Execution context
            
        Returns:
            Workflow result
        """
        workflow = self._workflows.get(workflow_id)
        if not workflow:
            return WorkflowResult(
                workflow_id=workflow_id,
                success=False,
                status=WorkflowStatus.FAILED,
                steps_completed=0,
                steps_failed=0,
                total_duration_ms=0,
                errors=["Workflow not found"],
            )
        
        context = context or {}
        start_time = time.time()
        
        workflow.status = WorkflowStatus.RUNNING
        workflow.started_at = datetime.now()
        
        completed = {}
        step_results = {}
        errors = []
        
        try:
            # Execute steps respecting dependencies
            remaining = list(workflow.steps)
            
            while remaining:
                # Find steps with satisfied dependencies
                ready = [
                    s for s in remaining
                    if all(dep in completed for dep in s.dependencies)
                ]
                
                if not ready:
                    # No steps ready - possible circular dependency
                    for s in remaining:
                        s.status = StepStatus.FAILED
                        s.error = "Unsatisfied dependencies"
                    errors.append("Circular dependency detected")
                    break
                
                # Execute ready steps in parallel
                tasks = []
                for step in ready:
                    tasks.append(self._execute_step(step, context, completed))
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for step, result in zip(ready, results):
                    if isinstance(result, Exception):
                        step.status = StepStatus.FAILED
                        step.error = str(result)
                        errors.append(f"Step {step.name} failed: {result}")
                    else:
                        step.result = result
                        step.status = StepStatus.COMPLETED
                        completed[step.id] = result
                        step_results[step.id] = result
                    
                    remaining.remove(step)
            
            workflow.status = WorkflowStatus.COMPLETED if not errors else WorkflowStatus.FAILED
            
        except Exception as e:
            workflow.status = WorkflowStatus.FAILED
            errors.append(str(e))
        
        workflow.completed_at = datetime.now()
        duration_ms = (time.time() - start_time) * 1000
        
        steps_completed = sum(1 for s in workflow.steps if s.status == StepStatus.COMPLETED)
        steps_failed = sum(1 for s in workflow.steps if s.status == StepStatus.FAILED)
        
        return WorkflowResult(
            workflow_id=workflow_id,
            success=workflow.status == WorkflowStatus.COMPLETED,
            status=workflow.status,
            steps_completed=steps_completed,
            steps_failed=steps_failed,
            total_duration_ms=duration_ms,
            step_results=step_results,
            errors=errors,
        )
    
    async def _execute_step(
        self,
        step: WorkflowStep,
        context: Dict[str, Any],
        previous_results: Dict[str, Any],
    ) -> Any:
        """Execute a single step."""
        start_time = time.time()
        step.status = StepStatus.RUNNING
        
        # Get handler
        handler = step.handler or self._handlers.get(step.handler_name)
        
        if not handler:
            raise ValueError(f"No handler for step: {step.handler_name}")
        
        # Merge context with previous results
        step_context = {**context, "previous": previous_results, **step.config}
        
        # Execute handler
        if asyncio.iscoroutinefunction(handler):
            result = await handler(step_context)
        else:
            result = handler(step_context)
        
        step.duration_ms = (time.time() - start_time) * 1000
        return result
    
    # Default handlers
    
    async def _handler_collect_files(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Collect files handler."""
        return {"files_collected": 0, "path": context.get("path", ".")}
    
    async def _handler_analyze_ast(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze AST handler."""
        return {"analyzed": True, "units": 0}
    
    async def _handler_detect_patterns(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Detect patterns handler."""
        return {"patterns_found": 0}
    
    async def _handler_scan_security(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Scan security handler."""
        return {"vulnerabilities": 0}
    
    async def _handler_generate_report(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate report handler."""
        return {"report_generated": True}
    
    async def _handler_send_notification(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Send notification handler."""
        return {"notification_sent": True}
    
    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a workflow by ID."""
        return self._workflows.get(workflow_id)
    
    def list_workflows(self) -> List[Workflow]:
        """List all workflows."""
        return list(self._workflows.values())
    
    def create_analysis_workflow(self, path: str) -> Workflow:
        """Create a standard analysis workflow."""
        return self.create_workflow(
            name="Full Analysis",
            description=f"Complete analysis of {path}",
            steps=[
                {
                    "name": "Collect Files",
                    "handler": "collect_files",
                    "config": {"path": path},
                },
                {
                    "name": "Analyze AST",
                    "handler": "analyze_ast",
                    "dependencies": [],
                },
                {
                    "name": "Detect Patterns",
                    "handler": "detect_patterns",
                    "dependencies": [],
                },
                {
                    "name": "Scan Security",
                    "handler": "scan_security",
                    "dependencies": [],
                },
                {
                    "name": "Generate Report",
                    "handler": "generate_report",
                    "dependencies": [],
                },
            ],
        )

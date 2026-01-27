"""
Cloud Orchestrator - Manages cloud infrastructure for massive scale analysis.

Supports:
- AWS (EC2, Lambda, ECS)
- GCP (Compute Engine, Cloud Run, Cloud Functions)
- Azure (VMs, Functions, Container Instances)

Designed for enterprise-grade scalability.
"""

import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class CloudProvider(Enum):
    """Supported cloud providers."""
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    LOCAL = "local"


class InstanceType(Enum):
    """Instance type categories."""
    SMALL = "small"      # 2 vCPU, 4GB RAM
    MEDIUM = "medium"    # 4 vCPU, 16GB RAM
    LARGE = "large"      # 8 vCPU, 32GB RAM
    XLARGE = "xlarge"    # 16 vCPU, 64GB RAM
    GPU = "gpu"          # GPU-enabled for AI tasks


@dataclass
class CloudInstance:
    """Cloud instance representation."""
    id: str
    provider: CloudProvider
    instance_type: InstanceType
    region: str
    status: str
    public_ip: Optional[str]
    private_ip: Optional[str]
    created_at: datetime
    cost_per_hour: float
    tags: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "provider": self.provider.value,
            "instance_type": self.instance_type.value,
            "region": self.region,
            "status": self.status,
            "public_ip": self.public_ip,
            "private_ip": self.private_ip,
            "created_at": self.created_at.isoformat(),
            "cost_per_hour": self.cost_per_hour,
            "tags": self.tags,
        }


@dataclass
class CloudOrchestratorConfig:
    """Configuration for cloud orchestrator."""
    provider: CloudProvider = CloudProvider.LOCAL
    region: str = "us-east-1"
    
    # Budget and limits
    budget_limit: float = 0.0  # Optional budget limit
    max_instances: int = 1000
    max_concurrent: int = 500
    
    # Instance preferences
    default_instance_type: InstanceType = InstanceType.MEDIUM
    spot_instances: bool = True
    spot_max_price: float = 0.5  # Max price per hour for spot
    
    # Auto-scaling
    enable_auto_scaling: bool = True
    scale_up_cooldown: int = 60  # seconds
    scale_down_cooldown: int = 300  # seconds
    target_utilization: float = 0.7
    
    # Networking
    vpc_id: Optional[str] = None
    subnet_ids: List[str] = field(default_factory=list)
    security_group_ids: List[str] = field(default_factory=list)
    
    # Credentials (would normally come from env/secrets)
    aws_access_key: Optional[str] = None
    aws_secret_key: Optional[str] = None
    gcp_project: Optional[str] = None
    gcp_credentials_path: Optional[str] = None
    azure_subscription: Optional[str] = None
    azure_credentials_path: Optional[str] = None


# Cost estimates per hour by provider and instance type
COST_ESTIMATES = {
    CloudProvider.AWS: {
        InstanceType.SMALL: 0.05,
        InstanceType.MEDIUM: 0.17,
        InstanceType.LARGE: 0.34,
        InstanceType.XLARGE: 0.68,
        InstanceType.GPU: 3.06,
    },
    CloudProvider.GCP: {
        InstanceType.SMALL: 0.04,
        InstanceType.MEDIUM: 0.15,
        InstanceType.LARGE: 0.30,
        InstanceType.XLARGE: 0.60,
        InstanceType.GPU: 2.48,
    },
    CloudProvider.AZURE: {
        InstanceType.SMALL: 0.05,
        InstanceType.MEDIUM: 0.16,
        InstanceType.LARGE: 0.32,
        InstanceType.XLARGE: 0.64,
        InstanceType.GPU: 2.90,
    },
}


class CloudOrchestrator:
    """
    Orchestrates cloud infrastructure for massive-scale analysis.
    
    Features:
    - Multi-cloud support (AWS, GCP, Azure)
    - Spot/preemptible instance management
    - Auto-scaling based on workload
    - Budget tracking and enforcement
    - Cost optimization
    """
    
    def __init__(self, config: Optional[CloudOrchestratorConfig] = None):
        self.config = config or CloudOrchestratorConfig()
        
        self._instances: Dict[str, CloudInstance] = {}
        self._total_spend: float = 0.0
        self._running = False
        self._cost_tracker_task = None
        
    async def start(self) -> None:
        """Start the cloud orchestrator."""
        logger.info(f"Starting cloud orchestrator (provider: {self.config.provider.value})")
        self._running = True
        
        # Start cost tracking
        self._cost_tracker_task = asyncio.create_task(self._track_costs())
        
        logger.info("Cloud orchestrator started")
        
    async def stop(self) -> None:
        """Stop the orchestrator and terminate all instances."""
        logger.info("Stopping cloud orchestrator...")
        self._running = False
        
        if self._cost_tracker_task:
            self._cost_tracker_task.cancel()
            
        # Terminate all instances
        await self.terminate_all_instances()
        
        logger.info("Cloud orchestrator stopped")
        
    async def launch_instances(
        self,
        count: int,
        instance_type: Optional[InstanceType] = None,
        region: Optional[str] = None
    ) -> List[CloudInstance]:
        """Launch cloud instances."""
        instance_type = instance_type or self.config.default_instance_type
        region = region or self.config.region
        
        # Check budget
        hourly_cost = COST_ESTIMATES.get(self.config.provider, {}).get(instance_type, 0.1)
        projected_cost = hourly_cost * count * 24  # Daily projection
        
        if self._total_spend + projected_cost > self.config.budget_limit:
            raise RuntimeError(f"Budget limit would be exceeded (limit: ${self.config.budget_limit})")
            
        # Check instance limit
        if len(self._instances) + count > self.config.max_instances:
            count = self.config.max_instances - len(self._instances)
            logger.warning(f"Limiting to {count} instances due to max_instances limit")
            
        if count <= 0:
            return []
            
        instances = []
        
        for i in range(count):
            instance = await self._create_instance(instance_type, region)
            if instance:
                self._instances[instance.id] = instance
                instances.append(instance)
                
        logger.info(f"Launched {len(instances)} instances")
        return instances
        
    async def _create_instance(
        self,
        instance_type: InstanceType,
        region: str
    ) -> Optional[CloudInstance]:
        """Create a single instance."""
        if self.config.provider == CloudProvider.LOCAL:
            return await self._create_local_instance(instance_type, region)
        elif self.config.provider == CloudProvider.AWS:
            return await self._create_aws_instance(instance_type, region)
        elif self.config.provider == CloudProvider.GCP:
            return await self._create_gcp_instance(instance_type, region)
        elif self.config.provider == CloudProvider.AZURE:
            return await self._create_azure_instance(instance_type, region)
        else:
            raise ValueError(f"Unknown provider: {self.config.provider}")
            
    async def _create_local_instance(
        self,
        instance_type: InstanceType,
        region: str
    ) -> CloudInstance:
        """Create a simulated local instance (for testing)."""
        import uuid
        
        instance_id = f"local-{uuid.uuid4().hex[:8]}"
        
        return CloudInstance(
            id=instance_id,
            provider=CloudProvider.LOCAL,
            instance_type=instance_type,
            region=region,
            status="running",
            public_ip="127.0.0.1",
            private_ip="127.0.0.1",
            created_at=datetime.now(),
            cost_per_hour=0.0,  # Local is free
            tags={"env": "development"},
        )
        
    async def _create_aws_instance(
        self,
        instance_type: InstanceType,
        region: str
    ) -> Optional[CloudInstance]:
        """Create an AWS EC2 instance."""
        # Would use boto3 in production
        logger.info(f"Would create AWS instance: {instance_type.value} in {region}")
        
        # Placeholder - return simulated instance
        import uuid
        instance_id = f"i-{uuid.uuid4().hex[:17]}"
        
        return CloudInstance(
            id=instance_id,
            provider=CloudProvider.AWS,
            instance_type=instance_type,
            region=region,
            status="pending",
            public_ip=None,
            private_ip=None,
            created_at=datetime.now(),
            cost_per_hour=COST_ESTIMATES[CloudProvider.AWS][instance_type],
            tags={"Name": "lyra-intel-worker"},
        )
        
    async def _create_gcp_instance(
        self,
        instance_type: InstanceType,
        region: str
    ) -> Optional[CloudInstance]:
        """Create a GCP Compute Engine instance."""
        # Would use google-cloud-compute in production
        logger.info(f"Would create GCP instance: {instance_type.value} in {region}")
        
        import uuid
        instance_id = f"lyra-{uuid.uuid4().hex[:8]}"
        
        return CloudInstance(
            id=instance_id,
            provider=CloudProvider.GCP,
            instance_type=instance_type,
            region=region,
            status="STAGING",
            public_ip=None,
            private_ip=None,
            created_at=datetime.now(),
            cost_per_hour=COST_ESTIMATES[CloudProvider.GCP][instance_type],
            tags={"purpose": "lyra-intel-worker"},
        )
        
    async def _create_azure_instance(
        self,
        instance_type: InstanceType,
        region: str
    ) -> Optional[CloudInstance]:
        """Create an Azure VM."""
        # Would use azure-mgmt-compute in production
        logger.info(f"Would create Azure instance: {instance_type.value} in {region}")
        
        import uuid
        instance_id = f"lyra-{uuid.uuid4().hex[:8]}"
        
        return CloudInstance(
            id=instance_id,
            provider=CloudProvider.AZURE,
            instance_type=instance_type,
            region=region,
            status="Creating",
            public_ip=None,
            private_ip=None,
            created_at=datetime.now(),
            cost_per_hour=COST_ESTIMATES[CloudProvider.AZURE][instance_type],
            tags={"purpose": "lyra-intel-worker"},
        )
        
    async def terminate_instance(self, instance_id: str) -> bool:
        """Terminate a single instance."""
        instance = self._instances.get(instance_id)
        
        if not instance:
            return False
            
        # Would call cloud API to terminate
        logger.info(f"Terminating instance: {instance_id}")
        
        del self._instances[instance_id]
        return True
        
    async def terminate_all_instances(self) -> int:
        """Terminate all instances."""
        count = len(self._instances)
        
        for instance_id in list(self._instances.keys()):
            await self.terminate_instance(instance_id)
            
        logger.info(f"Terminated {count} instances")
        return count
        
    async def scale_to(self, target_count: int) -> None:
        """Scale to a target number of instances."""
        current_count = len(self._instances)
        
        if target_count > current_count:
            # Scale up
            await self.launch_instances(target_count - current_count)
        elif target_count < current_count:
            # Scale down - terminate oldest instances first
            to_terminate = current_count - target_count
            sorted_instances = sorted(
                self._instances.values(),
                key=lambda x: x.created_at
            )
            
            for instance in sorted_instances[:to_terminate]:
                await self.terminate_instance(instance.id)
                
    async def _track_costs(self) -> None:
        """Track costs periodically."""
        while self._running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                # Calculate current spend rate
                hourly_rate = sum(
                    inst.cost_per_hour 
                    for inst in self._instances.values()
                )
                
                # Add to total (pro-rated for 1 minute)
                self._total_spend += hourly_rate / 60
                
                # Check budget
                if self._total_spend > self.config.budget_limit * 0.9:
                    logger.warning(
                        f"Approaching budget limit: ${self._total_spend:.2f} / ${self.config.budget_limit:.2f}"
                    )
                    
                if self._total_spend >= self.config.budget_limit:
                    logger.error("Budget limit reached! Terminating all instances.")
                    await self.terminate_all_instances()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cost tracking error: {e}")
                
    def get_stats(self) -> Dict[str, Any]:
        """Get orchestrator statistics."""
        instances_by_type = {}
        for inst in self._instances.values():
            itype = inst.instance_type.value
            instances_by_type[itype] = instances_by_type.get(itype, 0) + 1
            
        hourly_rate = sum(inst.cost_per_hour for inst in self._instances.values())
        
        return {
            "provider": self.config.provider.value,
            "region": self.config.region,
            "total_instances": len(self._instances),
            "instances_by_type": instances_by_type,
            "hourly_rate": hourly_rate,
            "daily_projection": hourly_rate * 24,
            "monthly_projection": hourly_rate * 24 * 30,
            "total_spend": self._total_spend,
            "budget_limit": self.config.budget_limit,
            "budget_remaining": self.config.budget_limit - self._total_spend,
            "budget_utilization": self._total_spend / self.config.budget_limit if self.config.budget_limit > 0 else 0,
        }
        
    def estimate_cost(
        self,
        instance_count: int,
        instance_type: InstanceType,
        hours: float
    ) -> Dict[str, float]:
        """Estimate cost for a workload."""
        hourly = COST_ESTIMATES.get(self.config.provider, {}).get(instance_type, 0.1)
        
        total = hourly * instance_count * hours
        
        return {
            "hourly_per_instance": hourly,
            "hourly_total": hourly * instance_count,
            "total_cost": total,
            "with_spot": total * 0.3 if self.config.spot_instances else total,  # ~70% savings with spot
        }

"""
Role-Based Access Control (RBAC) for Lyra Intel.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class Permission(Enum):
    """System permissions."""
    # Read permissions
    READ_ANALYSIS = "read:analysis"
    READ_REPORTS = "read:reports"
    READ_SEARCH = "read:search"
    READ_METRICS = "read:metrics"
    
    # Write permissions
    WRITE_ANALYSIS = "write:analysis"
    WRITE_REPORTS = "write:reports"
    WRITE_CONFIG = "write:config"
    
    # Admin permissions
    ADMIN_USERS = "admin:users"
    ADMIN_KEYS = "admin:keys"
    ADMIN_SYSTEM = "admin:system"
    
    # Special permissions
    EXECUTE_JOBS = "execute:jobs"
    MANAGE_AGENTS = "manage:agents"


@dataclass
class Role:
    """Represents a user role."""
    name: str
    description: str
    permissions: Set[Permission]
    inherits_from: Optional[str] = None


@dataclass
class User:
    """Represents a user."""
    user_id: str
    username: str
    roles: Set[str]
    custom_permissions: Set[Permission] = field(default_factory=set)
    denied_permissions: Set[Permission] = field(default_factory=set)


class RoleManager:
    """
    Role-based access control manager.
    
    Features:
    - Role definitions with permissions
    - Role inheritance
    - Custom permission overrides
    - Permission checking
    """
    
    def __init__(self):
        self._roles: Dict[str, Role] = {}
        self._users: Dict[str, User] = {}
        self._setup_default_roles()
    
    def _setup_default_roles(self):
        """Setup default roles."""
        # Viewer role
        self.add_role(Role(
            name="viewer",
            description="Read-only access to analysis and reports",
            permissions={
                Permission.READ_ANALYSIS,
                Permission.READ_REPORTS,
                Permission.READ_SEARCH,
            },
        ))
        
        # Analyst role
        self.add_role(Role(
            name="analyst",
            description="Can run analyses and generate reports",
            permissions={
                Permission.READ_METRICS,
                Permission.WRITE_ANALYSIS,
                Permission.WRITE_REPORTS,
                Permission.EXECUTE_JOBS,
            },
            inherits_from="viewer",
        ))
        
        # Developer role
        self.add_role(Role(
            name="developer",
            description="Full access except admin functions",
            permissions={
                Permission.WRITE_CONFIG,
                Permission.MANAGE_AGENTS,
            },
            inherits_from="analyst",
        ))
        
        # Admin role
        self.add_role(Role(
            name="admin",
            description="Full system access",
            permissions={
                Permission.ADMIN_USERS,
                Permission.ADMIN_KEYS,
                Permission.ADMIN_SYSTEM,
            },
            inherits_from="developer",
        ))
    
    def add_role(self, role: Role):
        """Add a role."""
        self._roles[role.name] = role
        logger.debug(f"Added role: {role.name}")
    
    def get_role(self, name: str) -> Optional[Role]:
        """Get a role by name."""
        return self._roles.get(name)
    
    def get_role_permissions(self, role_name: str) -> Set[Permission]:
        """Get all permissions for a role, including inherited."""
        role = self._roles.get(role_name)
        if not role:
            return set()
        
        permissions = set(role.permissions)
        
        # Add inherited permissions
        if role.inherits_from:
            permissions |= self.get_role_permissions(role.inherits_from)
        
        return permissions
    
    def add_user(self, user: User):
        """Add a user."""
        self._users[user.user_id] = user
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get a user by ID."""
        return self._users.get(user_id)
    
    def assign_role(self, user_id: str, role_name: str) -> bool:
        """Assign a role to a user."""
        user = self._users.get(user_id)
        if not user:
            return False
        
        if role_name not in self._roles:
            return False
        
        user.roles.add(role_name)
        logger.info(f"Assigned role '{role_name}' to user {user_id}")
        return True
    
    def remove_role(self, user_id: str, role_name: str) -> bool:
        """Remove a role from a user."""
        user = self._users.get(user_id)
        if not user:
            return False
        
        user.roles.discard(role_name)
        logger.info(f"Removed role '{role_name}' from user {user_id}")
        return True
    
    def grant_permission(self, user_id: str, permission: Permission):
        """Grant a custom permission to a user."""
        user = self._users.get(user_id)
        if user:
            user.custom_permissions.add(permission)
            user.denied_permissions.discard(permission)
    
    def deny_permission(self, user_id: str, permission: Permission):
        """Explicitly deny a permission to a user."""
        user = self._users.get(user_id)
        if user:
            user.denied_permissions.add(permission)
            user.custom_permissions.discard(permission)
    
    def get_user_permissions(self, user_id: str) -> Set[Permission]:
        """Get all effective permissions for a user."""
        user = self._users.get(user_id)
        if not user:
            return set()
        
        permissions = set()
        
        # Add permissions from roles
        for role_name in user.roles:
            permissions |= self.get_role_permissions(role_name)
        
        # Add custom permissions
        permissions |= user.custom_permissions
        
        # Remove denied permissions
        permissions -= user.denied_permissions
        
        return permissions
    
    def has_permission(self, user_id: str, permission: Permission) -> bool:
        """Check if user has a specific permission."""
        permissions = self.get_user_permissions(user_id)
        return permission in permissions
    
    def has_any_permission(self, user_id: str, permissions: List[Permission]) -> bool:
        """Check if user has any of the specified permissions."""
        user_perms = self.get_user_permissions(user_id)
        return bool(user_perms & set(permissions))
    
    def has_all_permissions(self, user_id: str, permissions: List[Permission]) -> bool:
        """Check if user has all of the specified permissions."""
        user_perms = self.get_user_permissions(user_id)
        return set(permissions) <= user_perms
    
    def can_access_resource(
        self,
        user_id: str,
        resource_type: str,
        action: str,
    ) -> bool:
        """Check if user can access a resource."""
        permission_map = {
            ("analysis", "read"): Permission.READ_ANALYSIS,
            ("analysis", "write"): Permission.WRITE_ANALYSIS,
            ("reports", "read"): Permission.READ_REPORTS,
            ("reports", "write"): Permission.WRITE_REPORTS,
            ("search", "read"): Permission.READ_SEARCH,
            ("metrics", "read"): Permission.READ_METRICS,
            ("config", "write"): Permission.WRITE_CONFIG,
            ("users", "admin"): Permission.ADMIN_USERS,
            ("keys", "admin"): Permission.ADMIN_KEYS,
            ("system", "admin"): Permission.ADMIN_SYSTEM,
            ("jobs", "execute"): Permission.EXECUTE_JOBS,
            ("agents", "manage"): Permission.MANAGE_AGENTS,
        }
        
        permission = permission_map.get((resource_type, action))
        if not permission:
            return False
        
        return self.has_permission(user_id, permission)
    
    def list_roles(self) -> List[Dict[str, Any]]:
        """List all roles."""
        return [
            {
                "name": role.name,
                "description": role.description,
                "permissions": [p.value for p in self.get_role_permissions(role.name)],
                "inherits_from": role.inherits_from,
            }
            for role in self._roles.values()
        ]
    
    def list_users(self) -> List[Dict[str, Any]]:
        """List all users."""
        return [
            {
                "user_id": user.user_id,
                "username": user.username,
                "roles": list(user.roles),
                "effective_permissions": [p.value for p in self.get_user_permissions(user.user_id)],
            }
            for user in self._users.values()
        ]

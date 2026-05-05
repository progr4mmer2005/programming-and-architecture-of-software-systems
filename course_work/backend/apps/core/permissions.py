"""Role-based permission classes for the API."""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.accounts.models import User


class IsOwner(BasePermission):
    """Owner has full access to everything."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.OWNER


class IsOwnerOrDirector(BasePermission):
    """Owner and Director can read data but not manage users."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [User.Role.OWNER, User.Role.DIRECTOR]


class IsOwnerOrAdmin(BasePermission):
    """Owner and Admin can manage users and settings."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [User.Role.OWNER, User.Role.ADMIN]


class CanManageContracts(BasePermission):
    """Manager can create/edit contracts."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [
            User.Role.OWNER, User.Role.DIRECTOR,
            User.Role.MANAGER, User.Role.ADMIN,
        ]


class CanApproveContracts(BasePermission):
    """Director/Owner can approve contracts."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [User.Role.OWNER, User.Role.DIRECTOR]


class CanLegalReview(BasePermission):
    """Lawyer can perform legal review."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [User.Role.OWNER, User.Role.LAWYER]


class CanManagePayments(BasePermission):
    """Finance can manage payments."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [User.Role.OWNER, User.Role.FINANCE]


class IsInOrganization(BasePermission):
    """User must belong to an organization."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.organization is not None


def get_role_permissions(role: str) -> dict:
    """Get permission summary for a given role."""
    permissions = {
        'can_manage_users': role in [User.Role.OWNER, User.Role.ADMIN],
        'can_view_dashboard': True,
        'can_create_contracts': role in [User.Role.OWNER, User.Role.MANAGER, User.Role.ADMIN],
        'can_approve_contracts': role in [User.Role.OWNER, User.Role.DIRECTOR],
        'can_legal_review': role in [User.Role.OWNER, User.Role.LAWYER],
        'can_manage_payments': role in [User.Role.OWNER, User.Role.FINANCE],
        'can_manage_templates': role in [User.Role.OWNER, User.Role.MANAGER, User.Role.ADMIN],
        'can_manage_organization': role == User.Role.OWNER,
    }
    return permissions
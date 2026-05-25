"""Role matrix, queryset scoping and permission helpers for the API."""
from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import BasePermission

from apps.accounts.models import User, build_default_user_permissions, build_permission_map


LEGACY_ROLE_PERMISSIONS = {
    User.Role.SUPER_ADMIN: build_permission_map(True),
    User.Role.USER: build_default_user_permissions(),
    User.Role.OWNER: {
        **build_permission_map(True),
        'scoped_to_assigned_contracts': False,
    },
    User.Role.DIRECTOR: {
        **build_permission_map(False),
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_launch_approval': True,
        'can_view_contractors': True,
        'can_view_estimates': True,
        'can_view_approvals': True,
        'can_process_approval_tasks': True,
        'can_view_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_audit': True,
    },
    User.Role.MANAGER: {
        **build_permission_map(False),
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_manage_contracts': True,
        'can_launch_approval': True,
        'can_view_contractors': True,
        'can_manage_contractors': True,
        'can_view_templates': True,
        'can_manage_templates': True,
        'can_view_estimates': True,
        'can_manage_estimates': True,
        'can_view_approvals': True,
        'can_manage_approval_routes': True,
        'can_view_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_audit': True,
    },
    User.Role.APPROVER: {
        **build_permission_map(False),
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_view_estimates': True,
        'can_view_approvals': True,
        'can_process_approval_tasks': True,
        'can_view_payments': True,
        'can_manage_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_audit': True,
    },
}


def _membership_role(user: User):
    if not getattr(user, 'is_authenticated', False):
        return None
    try:
        return user.get_active_membership().role  # type: ignore[union-attr]
    except Exception:
        return None


def get_role_permissions(user_or_role) -> dict:
    """Return permission flags for a role string or user object."""
    if isinstance(user_or_role, str):
        return LEGACY_ROLE_PERMISSIONS.get(user_or_role, build_permission_map(False)).copy()

    user = user_or_role
    if not getattr(user, 'is_authenticated', False):
        return build_permission_map(False)

    role = _membership_role(user)
    if role is not None:
        return role.normalize_permissions()

    return LEGACY_ROLE_PERMISSIONS.get(getattr(user, 'role', User.Role.USER), build_permission_map(False)).copy()


def role_has_permission(user: User, permission_name: str) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    return bool(get_role_permissions(user).get(permission_name, False))


def user_is_scoped_to_assigned_contracts(user: User) -> bool:
    return bool(get_role_permissions(user).get('scoped_to_assigned_contracts', False))


def scope_contract_queryset(queryset, user: User):
    """Restrict contract visibility according to the role matrix."""
    if role_has_permission(user, 'can_manage_contracts'):
        return queryset
    if user_is_scoped_to_assigned_contracts(user):
        return queryset.filter(
            Q(approval_tasks__assigned_to=user)
            | Q(responsible=user)
            | Q(created_by=user),
        ).distinct()
    if role_has_permission(user, 'can_view_contracts'):
        return queryset
    return queryset.none()


def scope_related_to_contract_queryset(queryset, user: User, relation: str = 'contract'):
    """Restrict visibility for entities linked to contracts."""
    if role_has_permission(user, 'can_manage_contracts'):
        return queryset
    if user_is_scoped_to_assigned_contracts(user):
        return queryset.filter(
            Q(**{f'{relation}__approval_tasks__assigned_to': user})
            | Q(**{f'{relation}__responsible': user})
            | Q(**{f'{relation}__created_by': user}),
        ).distinct()
    if role_has_permission(user, 'can_view_contracts'):
        return queryset
    return queryset.none()


def scope_approval_tasks_queryset(queryset, user: User):
    """All authenticated users can see approval tasks by current org visibility."""
    if role_has_permission(user, 'can_view_approvals'):
        return queryset
    return queryset.none()


def scope_audit_queryset(queryset, user: User):
    """Restrict audit visibility for reviewers to their assigned contracts."""
    if role_has_permission(user, 'can_view_audit') and not user_is_scoped_to_assigned_contracts(user):
        return queryset
    if user_is_scoped_to_assigned_contracts(user):
        assigned_contract_ids = _assigned_contract_ids(user)
        return queryset.filter(entity_type='Contract', entity_id__in=assigned_contract_ids)
    return queryset.none()


def _assigned_contract_ids(user: User):
    from apps.approvals.models import ApprovalTask

    return ApprovalTask.objects.filter(
        Q(assigned_to=user) | Q(assigned_to__isnull=True, role=user.role),
    ).values_list('contract_id', flat=True)


class IsOwner(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return role_has_permission(request.user, 'can_manage_organization')


class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return role_has_permission(request.user, 'can_manage_organization')


class IsInOrganization(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.organization is not None


class RoleFlagPermission(BasePermission):
    required_permission = ''

    def has_permission(self, request, view):
        return role_has_permission(request.user, self.required_permission)


class CanViewDashboard(RoleFlagPermission):
    required_permission = 'can_view_dashboard'


class CanViewContracts(RoleFlagPermission):
    required_permission = 'can_view_contracts'


class CanManageContracts(RoleFlagPermission):
    required_permission = 'can_manage_contracts'


class CanLaunchApproval(RoleFlagPermission):
    required_permission = 'can_launch_approval'


class CanViewContractors(RoleFlagPermission):
    required_permission = 'can_view_contractors'


class CanManageContractors(RoleFlagPermission):
    required_permission = 'can_manage_contractors'


class CanViewTemplates(RoleFlagPermission):
    required_permission = 'can_view_templates'


class CanManageTemplates(RoleFlagPermission):
    required_permission = 'can_manage_templates'


class CanViewEstimates(RoleFlagPermission):
    required_permission = 'can_view_estimates'


class CanManageEstimates(RoleFlagPermission):
    required_permission = 'can_manage_estimates'


class CanViewApprovals(RoleFlagPermission):
    required_permission = 'can_view_approvals'


class CanManageApprovalRoutes(RoleFlagPermission):
    required_permission = 'can_manage_approval_routes'


class CanProcessApprovalTasks(RoleFlagPermission):
    required_permission = 'can_process_approval_tasks'


class CanViewPayments(RoleFlagPermission):
    required_permission = 'can_view_payments'


class CanManagePayments(RoleFlagPermission):
    required_permission = 'can_manage_payments'


class CanViewCalendar(RoleFlagPermission):
    required_permission = 'can_view_calendar'


class CanViewReports(RoleFlagPermission):
    required_permission = 'can_view_reports'


class CanViewOrganization(RoleFlagPermission):
    required_permission = 'can_view_organization'


class CanManageOrganization(RoleFlagPermission):
    required_permission = 'can_manage_organization'


class CanManageUsers(RoleFlagPermission):
    required_permission = 'can_manage_users'


class CanManageReferences(RoleFlagPermission):
    required_permission = 'can_manage_references'


class CanViewAudit(RoleFlagPermission):
    required_permission = 'can_view_audit'

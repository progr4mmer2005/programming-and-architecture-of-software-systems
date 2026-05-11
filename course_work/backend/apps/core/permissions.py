"""Role matrix, queryset scoping and permission helpers for the API."""
from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import BasePermission

from apps.accounts.models import User


ROLE_PERMISSIONS = {
    User.Role.OWNER: {
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
        'can_process_approval_tasks': True,
        'can_view_payments': True,
        'can_manage_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_organization': True,
        'can_manage_organization': True,
        'can_manage_users': True,
        'can_manage_references': True,
        'can_view_audit': True,
        'scoped_to_assigned_contracts': False,
    },
    User.Role.DIRECTOR: {
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_manage_contracts': False,
        'can_launch_approval': True,
        'can_view_contractors': True,
        'can_manage_contractors': False,
        'can_view_templates': False,
        'can_manage_templates': False,
        'can_view_estimates': True,
        'can_manage_estimates': False,
        'can_view_approvals': True,
        'can_manage_approval_routes': False,
        'can_process_approval_tasks': True,
        'can_view_payments': True,
        'can_manage_payments': False,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_organization': False,
        'can_manage_organization': False,
        'can_manage_users': False,
        'can_manage_references': False,
        'can_view_audit': True,
        'scoped_to_assigned_contracts': False,
    },
    User.Role.MANAGER: {
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
        'can_process_approval_tasks': False,
        'can_view_payments': True,
        'can_manage_payments': False,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_organization': False,
        'can_manage_organization': False,
        'can_manage_users': False,
        'can_manage_references': False,
        'can_view_audit': True,
        'scoped_to_assigned_contracts': False,
    },
    User.Role.APPROVER: {
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_manage_contracts': False,
        'can_launch_approval': False,
        'can_view_contractors': False,
        'can_manage_contractors': False,
        'can_view_templates': False,
        'can_manage_templates': False,
        'can_view_estimates': True,
        'can_manage_estimates': False,
        'can_view_approvals': True,
        'can_manage_approval_routes': False,
        'can_process_approval_tasks': True,
        'can_view_payments': True,
        'can_manage_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_organization': False,
        'can_manage_organization': False,
        'can_manage_users': False,
        'can_manage_references': False,
        'can_view_audit': True,
        'scoped_to_assigned_contracts': False,
    },
    User.Role.ADMIN: {
        'can_view_dashboard': False,
        'can_view_contracts': False,
        'can_manage_contracts': False,
        'can_launch_approval': False,
        'can_view_contractors': True,
        'can_manage_contractors': True,
        'can_view_templates': True,
        'can_manage_templates': True,
        'can_view_estimates': False,
        'can_manage_estimates': False,
        'can_view_approvals': True,
        'can_manage_approval_routes': True,
        'can_process_approval_tasks': False,
        'can_view_payments': False,
        'can_manage_payments': False,
        'can_view_calendar': True,
        'can_view_reports': False,
        'can_view_organization': True,
        'can_manage_organization': True,
        'can_manage_users': True,
        'can_manage_references': True,
        'can_view_audit': True,
        'scoped_to_assigned_contracts': False,
    },
}


def get_role_permissions(role: str) -> dict:
    """Return permission flags for the current role."""
    return ROLE_PERMISSIONS.get(role, {}).copy()


def role_has_permission(user: User, permission_name: str) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    return bool(get_role_permissions(user.role).get(permission_name, False))


def user_is_scoped_to_assigned_contracts(user: User) -> bool:
    return bool(get_role_permissions(user.role).get('scoped_to_assigned_contracts', False))


def scope_contract_queryset(queryset, user: User):
    """Restrict contract visibility according to the role matrix."""
    if role_has_permission(user, 'can_manage_contracts') or user.role in [User.Role.OWNER, User.Role.DIRECTOR]:
        return queryset
    if user_is_scoped_to_assigned_contracts(user):
        return queryset.filter(approval_tasks__assigned_to=user).distinct()
    if role_has_permission(user, 'can_view_contracts'):
        return queryset
    return queryset.none()


def scope_related_to_contract_queryset(queryset, user: User, relation: str = 'contract'):
    """Restrict visibility for entities linked to contracts."""
    if role_has_permission(user, 'can_manage_contracts') or user.role in [User.Role.OWNER, User.Role.DIRECTOR]:
        return queryset
    if user_is_scoped_to_assigned_contracts(user):
        return queryset.filter(**{f'{relation}__approval_tasks__assigned_to': user}).distinct()
    if role_has_permission(user, 'can_view_contracts'):
        return queryset
    return queryset.none()


def scope_approval_tasks_queryset(queryset, user: User):
    """All authenticated users see all approval tasks.
    Individual task actions (approve/reject) are protected by _ensure_task_is_mine."""
    return queryset


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
        return request.user.is_authenticated and request.user.role == User.Role.OWNER


class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [User.Role.OWNER, User.Role.ADMIN]


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

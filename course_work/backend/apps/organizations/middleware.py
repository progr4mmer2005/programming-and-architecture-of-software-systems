"""Multi-tenant middleware that attaches active organization to the request."""
from django.utils.deprecation import MiddlewareMixin


class OrganizationMiddleware(MiddlewareMixin):
    """Attaches the active organization context to the request."""

    def process_request(self, request):
        if not request.user.is_authenticated:
            request.organization = None
            return

        request.organization = getattr(request.user, 'organization', None)
        if request.organization is not None:
            return

        membership = request.user.memberships.select_related('organization', 'role').filter(is_active=True).first()
        if membership is None:
            return

        request.user.organization = membership.organization
        request.user.role = membership.role.code
        request.user.save(update_fields=['organization', 'role'])
        request.organization = membership.organization

"""Multi-tenant middleware that attaches organization to the request."""
from django.utils.deprecation import MiddlewareMixin


class OrganizationMiddleware(MiddlewareMixin):
    """Attaches the user's organization to the request for multi-tenant filtering."""

    def process_request(self, request):
        """Set organization on request from authenticated user."""
        if request.user.is_authenticated:
            request.organization = getattr(request.user, 'organization', None)
        else:
            request.organization = None
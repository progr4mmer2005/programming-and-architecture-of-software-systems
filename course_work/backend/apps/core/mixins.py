class OrganizationContextMixin:
    """Populate request.organization after DRF authentication has resolved request.user."""

    def initial(self, request, *args, **kwargs):
        response = super().initial(request, *args, **kwargs)
        if getattr(request, 'organization', None) is None and getattr(request.user, 'is_authenticated', False):
            request.organization = getattr(request.user, 'organization', None)
        return response

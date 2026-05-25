class OrganizationContextMixin:
    """Populate request.organization after DRF authentication has resolved request.user."""

    def initial(self, request, *args, **kwargs):
        response = super().initial(request, *args, **kwargs)
        if getattr(request, 'organization', None) is None and getattr(request.user, 'is_authenticated', False):
            request.organization = getattr(request.user, 'organization', None)
            if request.organization is None:
                membership = request.user.memberships.select_related('organization', 'role').filter(is_active=True).first()
                if membership is not None:
                    request.user.organization = membership.organization
                    request.user.role = membership.role.code
                    request.user.save(update_fields=['organization', 'role'])
                    request.organization = membership.organization
        return response

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuthViewSet, InvitationViewSet, OrganizationRoleViewSet, UserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'roles', OrganizationRoleViewSet, basename='roles')
router.register(r'invitations', InvitationViewSet, basename='invitations')
router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApprovalRouteViewSet, ApprovalTaskViewSet

router = DefaultRouter()
router.register(r'approval-routes', ApprovalRouteViewSet)
router.register(r'approval-tasks', ApprovalTaskViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
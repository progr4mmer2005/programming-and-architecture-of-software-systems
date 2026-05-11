from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApprovalRouteViewSet, ApprovalTaskViewSet

router = DefaultRouter()
router.register(r'approval-routes', ApprovalRouteViewSet, basename='approval-routes')
router.register(r'approval-tasks', ApprovalTaskViewSet, basename='approval-tasks')

urlpatterns = [
    path('', include(router.urls)),
]

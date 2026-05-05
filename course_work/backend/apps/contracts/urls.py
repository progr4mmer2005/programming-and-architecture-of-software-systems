from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractViewSet, ContractVersionViewSet

router = DefaultRouter()
router.register(r'contracts', ContractViewSet)
router.register(r'contract-versions', ContractVersionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
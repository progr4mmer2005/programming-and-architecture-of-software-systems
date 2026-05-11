from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractViewSet, ContractVersionViewSet, ContractAttachmentViewSet

router = DefaultRouter()
router.register(r'contracts', ContractViewSet, basename='contracts')
router.register(r'contract-versions', ContractVersionViewSet, basename='contract-versions')
router.register(r'contract-attachments', ContractAttachmentViewSet, basename='contract-attachments')

urlpatterns = [
    path('', include(router.urls)),
]

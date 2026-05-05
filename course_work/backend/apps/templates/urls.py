from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractTemplateViewSet

router = DefaultRouter()
router.register(r'templates', ContractTemplateViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
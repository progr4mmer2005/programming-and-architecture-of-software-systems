from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractStageViewSet

router = DefaultRouter()
router.register(r'stages', ContractStageViewSet, basename='stages')

urlpatterns = [
    path('', include(router.urls)),
]

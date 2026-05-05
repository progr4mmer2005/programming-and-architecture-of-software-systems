from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractorViewSet

router = DefaultRouter()
router.register(r'contractors', ContractorViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
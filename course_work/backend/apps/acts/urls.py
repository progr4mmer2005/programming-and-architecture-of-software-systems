from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ActViewSet

router = DefaultRouter()
router.register(r'acts', ActViewSet, basename='acts')

urlpatterns = [
    path('', include(router.urls)),
]

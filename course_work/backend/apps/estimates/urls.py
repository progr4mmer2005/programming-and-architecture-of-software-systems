from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EstimateItemViewSet, EstimateViewSet

router = DefaultRouter()
router.register(r'estimates', EstimateViewSet, basename='estimates')
router.register(r'estimate-items', EstimateItemViewSet, basename='estimate-items')

urlpatterns = [
    path('', include(router.urls)),
]

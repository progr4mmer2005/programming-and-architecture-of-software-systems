from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ReferenceEntryViewSet

router = DefaultRouter()
router.register(r'reference-entries', ReferenceEntryViewSet, basename='reference-entries')

urlpatterns = [
    path('', include(router.urls)),
]

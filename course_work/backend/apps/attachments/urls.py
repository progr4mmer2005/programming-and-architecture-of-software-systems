from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FileAttachmentViewSet

router = DefaultRouter()
router.register(r'file-attachments', FileAttachmentViewSet, basename='file-attachments')

urlpatterns = [
    path('', include(router.urls)),
]

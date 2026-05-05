"""Main URL configuration."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # JWT Auth
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API Modules
    path('api/', include('apps.organizations.urls')),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.contractors.urls')),
    path('api/', include('apps.contracts.urls')),
    path('api/', include('apps.templates.urls')),
    path('api/', include('apps.estimates.urls')),
    path('api/', include('apps.stages.urls')),
    path('api/', include('apps.payments.urls')),
    path('api/', include('apps.approvals.urls')),
    path('api/', include('apps.comments.urls')),
    path('api/', include('apps.audit.urls')),
    path('api/', include('apps.dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, PaymentCalendarViewSet

router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'payment-calendar', PaymentCalendarViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
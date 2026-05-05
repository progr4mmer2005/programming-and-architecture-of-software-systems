from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from datetime import datetime
from .models import Payment, PaymentCalendar
from .serializers import PaymentSerializer, PaymentCalendarSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    """CRUD for planned and actual payments."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'contract__title']
    filterset_fields = ['type', 'status', 'contract']

    def get_queryset(self):
        return Payment.objects.filter(contract__organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PaymentCalendarViewSet(viewsets.ReadOnlyModelViewSet):
    """View payment calendar with plan/fact summaries per month."""
    serializer_class = PaymentCalendarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PaymentCalendar.objects.filter(organization=self.request.organization)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current month's payment calendar."""
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        calendar, _ = PaymentCalendar.objects.get_or_create(
            organization=request.organization,
            month=month_start,
        )
        # Recalculate
        planned = Payment.objects.filter(
            contract__organization=request.organization,
            type='planned',
            planned_date__year=now.year,
            planned_date__month=now.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        actual = Payment.objects.filter(
            contract__organization=request.organization,
            type='actual',
            actual_date__year=now.year,
            actual_date__month=now.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        calendar.total_planned = planned
        calendar.total_actual = actual
        calendar.debt = planned - actual
        calendar.save()

        return Response(PaymentCalendarSerializer(calendar).data)
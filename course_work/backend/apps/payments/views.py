from django.db.models import Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManagePayments, CanViewPayments, scope_related_to_contract_queryset

from .models import Payment, PaymentCalendar
from .serializers import PaymentCalendarSerializer, PaymentSerializer


def sync_payment_status(payment: Payment) -> None:
    if payment.type == Payment.Type.PLANNED and payment.status == Payment.Status.PENDING and payment.planned_date:
        if payment.planned_date < timezone.now().date():
            payment.status = Payment.Status.OVERDUE
            payment.save(update_fields=['status', 'updated_at'])
    if payment.status == Payment.Status.PAID and payment.type != Payment.Type.ACTUAL:
        payment.type = Payment.Type.ACTUAL
        payment.save(update_fields=['type', 'updated_at'])


class PaymentViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'contract__title', 'contract__number', 'act__number']
    filterset_fields = ['type', 'status', 'contract', 'stage', 'act']
    ordering_fields = ['planned_date', 'paid_date', 'amount', 'created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewPayments]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManagePayments]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Payment.objects.filter(contract__organization=self.request.organization).select_related('contract', 'stage', 'act')
        queryset = scope_related_to_contract_queryset(queryset, self.request.user)
        for payment in queryset.filter(status='pending'):
            sync_payment_status(payment)
        return queryset

    def perform_create(self, serializer):
        payment = serializer.save(created_by=self.request.user)
        sync_payment_status(payment)

    def perform_update(self, serializer):
        payment = serializer.save()
        sync_payment_status(payment)


class PaymentCalendarViewSet(OrganizationContextMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentCalendarSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewPayments]

    def get_queryset(self):
        return PaymentCalendar.objects.filter(organization=self.request.organization)

    @action(detail=False, methods=['get'])
    def current(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        calendar, _ = PaymentCalendar.objects.get_or_create(organization=request.organization, month=month_start)
        planned = Payment.objects.filter(
            contract__organization=request.organization,
            type='planned',
            planned_date__year=now.year,
            planned_date__month=now.month,
        ).aggregate(total=Sum('amount'))['total'] or 0
        actual = Payment.objects.filter(
            contract__organization=request.organization,
            status='paid',
            paid_date__year=now.year,
            paid_date__month=now.month,
        ).aggregate(total=Sum('amount'))['total'] or 0
        calendar.total_planned = planned
        calendar.total_actual = actual
        calendar.debt = planned - actual
        calendar.save()
        return Response(PaymentCalendarSerializer(calendar).data)

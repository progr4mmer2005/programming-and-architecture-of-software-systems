"""Dashboard analytics views for executives."""
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from apps.contracts.models import Contract
from apps.payments.models import Payment


class DashboardViewSet(viewsets.ViewSet):
    """Executive dashboard with analytics."""
    permission_classes = [permissions.IsAuthenticated]

    def _org(self, request):
        return request.organization

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """General summary statistics."""
        org = self._org(request)
        now = timezone.now()
        data = {
            'total_contracts': Contract.objects.filter(organization=org).count(),
            'active_contracts': Contract.objects.filter(organization=org, status='active').count(),
            'draft_contracts': Contract.objects.filter(organization=org, status='draft').count(),
            'approval_pending': Contract.objects.filter(organization=org, status='approval').count(),
            'total_contractors': org.contractors.count(),
            'total_amount': Contract.objects.filter(organization=org).aggregate(Sum('amount'))['amount__sum'] or 0,
            'upcoming_payments_count': Payment.objects.filter(
                contract__organization=org,
                type='planned',
                status='pending',
                planned_date__gte=now.date(),
            ).count(),
        }
        return Response(data)

    @action(detail=False, methods=['get'])
    def contracts_by_status(self, request):
        """Contracts grouped by status for charts."""
        org = self._org(request)
        statuses = Contract.Status.choices
        data = []
        for status_key, status_label in statuses:
            count = Contract.objects.filter(organization=org, status=status_key).count()
            if count > 0:
                data.append({'status': status_label, 'value': count})
        return Response(data)

    @action(detail=False, methods=['get'])
    def contracts_by_type(self, request):
        """Contracts grouped by type."""
        org = self._org(request)
        types = Contract.Type.choices
        data = []
        for type_key, type_label in types:
            count = Contract.objects.filter(organization=org, contract_type=type_key).count()
            if count > 0:
                data.append({'type': type_label, 'value': count})
        return Response(data)

    @action(detail=False, methods=['get'])
    def payments_chart(self, request):
        """Monthly payment plan vs actual for the last 6 months."""
        org = self._org(request)
        now = timezone.now()
        data = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            planned = Payment.objects.filter(
                contract__organization=org,
                type='planned',
                planned_date__gte=month_start,
                planned_date__lt=month_end,
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            actual = Payment.objects.filter(
                contract__organization=org,
                type='actual',
                actual_date__gte=month_start,
                actual_date__lt=month_end,
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            data.append({
                'month': month_start.strftime('%Y-%m'),
                'planned': float(planned),
                'actual': float(actual),
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def upcoming_payments(self, request):
        """Upcoming payments for the next 30 days."""
        org = self._org(request)
        now = timezone.now()
        payments = Payment.objects.filter(
            contract__organization=org,
            type='planned',
            status='pending',
            planned_date__gte=now.date(),
            planned_date__lte=now.date() + timedelta(days=30),
        ).select_related('contract')[:10]

        data = [{
            'id': p.id,
            'contract': p.contract.title,
            'amount': float(p.amount),
            'planned_date': p.planned_date,
            'status': p.status,
        } for p in payments]
        return Response(data)
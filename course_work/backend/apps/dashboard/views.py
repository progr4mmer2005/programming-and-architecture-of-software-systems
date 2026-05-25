"""Dashboard analytics and unified calendar views."""
from datetime import date, datetime, timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.approvals.models import ApprovalTask
from apps.contracts.models import Contract
from apps.contracts.services import calculateContractActualAmount, calculateContractDebt, calculateContractPaidAmount, calculateContractPlannedAmount
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanViewCalendar, CanViewDashboard, CanViewReports, scope_approval_tasks_queryset, scope_contract_queryset, scope_related_to_contract_queryset
from apps.payments.models import Payment
from apps.stages.models import ContractStage
from apps.stages.services import calculateStageActualAmount, calculateStagePlannedAmount


class DashboardViewSet(OrganizationContextMixin, viewsets.ViewSet):
    role_labels = {'super_admin': 'Главный админ', 'user': 'Пользователь'}

    def get_permissions(self):
        if self.action == 'execution_report':
            permission_classes = [permissions.IsAuthenticated, CanViewReports]
        elif self.action == 'calendar_events':
            permission_classes = [permissions.IsAuthenticated, CanViewCalendar]
        else:
            permission_classes = [permissions.IsAuthenticated, CanViewDashboard]
        return [permission() for permission in permission_classes]

    def _parse_date(self, raw_value: str | None, fallback: date) -> date:
        if not raw_value:
            return fallback
        return datetime.strptime(raw_value, '%Y-%m-%d').date()

    def _approval_assignee_label(self, task: ApprovalTask) -> str:
        if task.assigned_to:
            return task.assigned_to.get_full_name() or task.assigned_to.role or task.assigned_to.username
        return self.role_labels.get(task.role, task.role)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        org = request.organization
        now = timezone.now()
        contracts = scope_contract_queryset(Contract.objects.filter(organization=org), request.user)
        payments = scope_related_to_contract_queryset(Payment.objects.filter(contract__organization=org), request.user)
        total_amount = sum((calculateContractPlannedAmount(contract, estimates=contract.estimates.all()) or 0 for contract in contracts), 0)
        return Response({
            'total_contracts': contracts.count(),
            'active_contracts': contracts.filter(status__in=[Contract.Status.ACTIVE, Contract.Status.SIGNED]).count(),
            'draft_contracts': contracts.filter(status=Contract.Status.DRAFT).count(),
            'approval_pending': contracts.filter(status=Contract.Status.ON_APPROVAL).count(),
            'total_contractors': org.contractor_links.filter(is_active=True).count(),
            'total_amount': total_amount,
            'upcoming_payments_count': payments.filter(type='planned', status='pending', planned_date__gte=now.date()).count(),
        })

    @action(detail=False, methods=['get'])
    def contracts_by_status(self, request):
        contracts = scope_contract_queryset(Contract.objects.filter(organization=request.organization), request.user)
        return Response([
            {'status': label, 'value': count}
            for status_key, label in Contract.Status.choices
            if (count := contracts.filter(status=status_key).count()) > 0
        ])

    @action(detail=False, methods=['get'])
    def payments_chart(self, request):
        now = timezone.now()
        payments = scope_related_to_contract_queryset(Payment.objects.filter(contract__organization=request.organization), request.user)
        data = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            planned = payments.filter(type='planned', planned_date__gte=month_start, planned_date__lt=month_end).aggregate(Sum('amount'))['amount__sum'] or 0
            actual = payments.filter(status='paid', paid_date__gte=month_start, paid_date__lt=month_end).aggregate(Sum('amount'))['amount__sum'] or 0
            data.append({'month': month_start.strftime('%Y-%m'), 'planned': float(planned), 'actual': float(actual)})
        return Response(data)

    @action(detail=False, methods=['get'])
    def upcoming_payments(self, request):
        now = timezone.now()
        payments = scope_related_to_contract_queryset(Payment.objects.filter(
            contract__organization=request.organization,
            type='planned',
            status='pending',
            planned_date__gte=now.date(),
            planned_date__lte=now.date() + timedelta(days=30),
        ), request.user).select_related('contract')[:10]
        return Response([{
            'id': payment.id,
            'contract': payment.contract.title,
            'amount': float(payment.amount),
            'planned_date': payment.planned_date,
            'status': payment.get_status_display(),
        } for payment in payments])

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        today = timezone.now().date()
        warning_horizon = today + timedelta(days=14)
        expiring_contracts = scope_contract_queryset(Contract.objects.filter(
            organization=request.organization,
            end_date__isnull=False,
            end_date__lte=warning_horizon,
        ), request.user).exclude(status__in=[Contract.Status.COMPLETED, Contract.Status.TERMINATED])[:8]
        overdue_payments = scope_related_to_contract_queryset(Payment.objects.filter(
            contract__organization=request.organization,
            type='planned',
            planned_date__lt=today,
        ), request.user).exclude(status__in=['paid', 'cancelled'])[:8]
        pending_approvals = scope_approval_tasks_queryset(ApprovalTask.objects.filter(
            contract__organization=request.organization,
            status='pending',
        ), request.user).select_related('contract', 'assigned_to')[:8]
        due_stages = scope_related_to_contract_queryset(ContractStage.objects.filter(
            contract__organization=request.organization,
            status__in=[ContractStage.Status.PLANNED, ContractStage.Status.IN_PROGRESS, ContractStage.Status.DELAYED],
            end_date__isnull=False,
            end_date__lte=warning_horizon,
        ), request.user).select_related('contract')[:8]
        items = []
        for contract in expiring_contracts:
            items.append({'kind': 'contract_deadline', 'level': 'warning' if contract.end_date >= today else 'danger', 'title': contract.title, 'subtitle': contract.number, 'date': contract.end_date, 'description': 'Срок действия договора требует внимания.', 'contract_id': contract.id})
        for payment in overdue_payments:
            items.append({'kind': 'payment_overdue', 'level': 'danger', 'title': payment.contract.title, 'subtitle': payment.description or 'Плановый платёж', 'date': payment.planned_date, 'amount': float(payment.amount), 'description': 'Плановый платёж просрочен.', 'contract_id': payment.contract_id})
        for task in pending_approvals:
            items.append({'kind': 'approval_pending', 'level': 'accent', 'title': task.contract.title, 'subtitle': self._approval_assignee_label(task), 'date': task.deadline or task.assigned_at.date(), 'description': 'Ожидается решение по задаче согласования.', 'contract_id': task.contract_id})
        for stage in due_stages:
            amount = calculateStagePlannedAmount(stage)
            items.append({'kind': 'stage_deadline', 'level': 'warning' if stage.end_date >= today else 'danger', 'title': stage.contract.title, 'subtitle': stage.name, 'date': stage.end_date, 'amount': float(amount or 0), 'description': 'Приближается срок исполнения этапа.', 'contract_id': stage.contract_id})
        items.sort(key=lambda item: (item.get('date') or today, item['title']))
        return Response(items[:20])

    @action(detail=False, methods=['get'])
    def execution_report(self, request):
        contracts = scope_contract_queryset(Contract.objects.filter(organization=request.organization).select_related('contractor'), request.user)
        report = []
        for contract in contracts:
            planned = calculateContractPlannedAmount(contract, estimates=contract.estimates.all()) or 0
            actual = calculateContractActualAmount(contract, contract.acts.all())
            paid = calculateContractPaidAmount(contract, contract.payments.all())
            stages_total = contract.stages.count()
            stages_completed = contract.stages.filter(status=ContractStage.Status.COMPLETED).count()
            next_stage = contract.stages.exclude(status=ContractStage.Status.COMPLETED).filter(end_date__isnull=False).order_by('end_date').first()
            report.append({
                'id': contract.id,
                'number': contract.number,
                'title': contract.title,
                'contractor': contract.contractor.name if contract.contractor else '',
                'status': contract.get_status_display(),
                'amount': float(planned or 0),
                'planned_payments': float(planned or 0),
                'actual_payments': float(paid),
                'debt': float(actual - paid),
                'stages_total': stages_total,
                'stages_completed': stages_completed,
                'next_deadline': next_stage.end_date if next_stage else contract.end_date,
            })
        return Response(report)

    @action(detail=False, methods=['get'])
    def calendar_events(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        date_from = self._parse_date(request.query_params.get('date_from'), month_start)
        date_to = self._parse_date(request.query_params.get('date_to'), month_end)
        kinds = [item.strip() for item in request.query_params.get('kinds', '').split(',') if item.strip()]
        kind_filter = set(kinds) if kinds else None
        events = []

        def include(kind):
            return kind_filter is None or kind in kind_filter

        if include('payment'):
            payments = scope_related_to_contract_queryset(Payment.objects.filter(contract__organization=request.organization), request.user).select_related('contract')
            for payment in payments:
                event_date = payment.paid_date or payment.planned_date
                if event_date and date_from <= event_date <= date_to:
                    events.append({'id': f'payment-{payment.id}', 'kind': 'payment', 'tone': 'danger' if payment.status == 'overdue' else 'accent' if payment.type == 'planned' else 'brand', 'date': event_date, 'title': payment.contract.title, 'subtitle': payment.description or payment.get_type_display(), 'amount': float(payment.amount), 'status': payment.get_status_display(), 'contract_id': payment.contract_id})
        if include('contract'):
            contracts = scope_contract_queryset(Contract.objects.filter(organization=request.organization), request.user)
            for contract in contracts:
                for label, event_date, event_id in [('Дата начала договора', contract.start_date, 'start'), ('Окончание срока договора', contract.end_date, 'end'), ('Дата подписания', contract.signing_date, 'signing')]:
                    if event_date and date_from <= event_date <= date_to:
                        events.append({'id': f'contract-{event_id}-{contract.id}', 'kind': 'contract', 'tone': 'neutral', 'date': event_date, 'title': contract.title, 'subtitle': label, 'status': contract.get_status_display(), 'contract_id': contract.id})
        if include('stage'):
            stages = scope_related_to_contract_queryset(ContractStage.objects.filter(contract__organization=request.organization, end_date__isnull=False, end_date__gte=date_from, end_date__lte=date_to), request.user).select_related('contract')
            for stage in stages:
                amount = calculateStagePlannedAmount(stage)
                events.append({'id': f'stage-{stage.id}', 'kind': 'stage', 'tone': 'success' if stage.status == ContractStage.Status.COMPLETED else 'warning', 'date': stage.end_date, 'title': stage.contract.title, 'subtitle': stage.name, 'amount': float(amount or 0), 'status': stage.get_status_display(), 'contract_id': stage.contract_id})
        if include('approval'):
            approvals = scope_approval_tasks_queryset(ApprovalTask.objects.filter(contract__organization=request.organization), request.user).select_related('contract', 'assigned_to')
            for task in approvals:
                event_date = task.deadline or task.assigned_at.date()
                if date_from <= event_date <= date_to:
                    events.append({'id': f'approval-{task.id}', 'kind': 'approval', 'tone': 'success' if task.status == 'approved' else 'danger' if task.status == 'rejected' else 'accent', 'date': event_date, 'title': task.contract.title, 'subtitle': self._approval_assignee_label(task), 'status': task.get_status_display(), 'stage_order': task.stage_order, 'contract_id': task.contract_id})
        events.sort(key=lambda item: (item['date'], item['kind'], item['title']))
        counts = {kind: sum(1 for item in events if item['kind'] == kind) for kind in ['payment', 'contract', 'stage', 'approval']}
        return Response({'date_from': date_from, 'date_to': date_to, 'counts': counts, 'events': events})

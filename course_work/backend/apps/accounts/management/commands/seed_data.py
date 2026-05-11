"""Management command to populate the database with demo data."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.acts.models import Act
from apps.approvals.models import ApprovalRoute, ApprovalTask
from apps.contractors.models import Contractor, OrganizationContractor
from apps.contracts.models import Contract
from apps.contracts.services import create_contract_version
from apps.estimates.models import Estimate, EstimateItem
from apps.estimates.services import create_estimate_version
from apps.organizations.models import Organization
from apps.payments.models import Payment, PaymentCalendar
from apps.stages.models import ContractStage

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with demo data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating demo data...')

        org, _ = Organization.objects.get_or_create(
            inn='7701234567',
            defaults={
                'name': 'ООО "ТехноСервис"',
                'legal_name': 'Общество с ограниченной ответственностью "ТехноСервис"',
                'kpp': '770101001',
                'ogrn': '1027700132195',
                'address': 'г. Москва, ул. Ленина, д. 10',
            },
        )
        self.stdout.write(f'  Organization: {org.name}')

        users_data = [
            {'username': 'owner', 'password': 'owner123', 'role': User.Role.OWNER, 'email': 'owner@techservice.ru', 'first_name': 'Алексей'},
            {'username': 'director', 'password': 'dir123', 'role': User.Role.DIRECTOR, 'email': 'director@techservice.ru', 'first_name': 'Марина'},
            {'username': 'manager', 'password': 'manager123', 'role': User.Role.MANAGER, 'email': 'manager@techservice.ru', 'first_name': 'Илья'},
            {'username': 'approver', 'password': 'approver123', 'role': User.Role.APPROVER, 'email': 'approver@techservice.ru', 'first_name': 'Елена'},
        ]
        users = {}
        for data in users_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'organization': org,
                    'role': data['role'],
                    'email': data['email'],
                    'first_name': data['first_name'],
                },
            )
            user.organization = org
            user.role = data['role']
            user.email = data['email']
            user.first_name = data['first_name']
            if created:
                user.set_password(data['password'])
            user.save()
            users[data['username']] = user
            self.stdout.write(f'  User: {user.username} ({user.role})')

        contractors_data = [
            {
                'name': 'ООО "СтройИнвест"',
                'inn': '7702345678',
                'full_name': 'Общество с ограниченной ответственностью "СтройИнвест"',
                'address': 'г. Москва, Пресненская наб., д. 12',
                'phone': '+7 (495) 111-10-10',
                'email': 'office@stroyinvest.ru',
                'contact_person': 'Петров Сергей',
            },
            {
                'name': 'АО "Поставщик"',
                'inn': '7703456789',
                'full_name': 'Акционерное общество "Поставщик"',
                'address': 'г. Казань, ул. Техническая, д. 7',
                'phone': '+7 (843) 555-10-10',
                'email': 'sales@supplier.ru',
                'contact_person': 'Сидорова Анна',
            },
            {
                'name': 'ИП Иванов',
                'inn': '770456789012',
                'full_name': 'Индивидуальный предприниматель Иванов Иван Иванович',
                'address': 'г. Санкт-Петербург, Невский пр., д. 25',
                'phone': '+7 (812) 700-10-10',
                'email': 'ivanov@example.ru',
                'contact_person': 'Иванов Иван',
            },
        ]
        contractors = []
        for data in contractors_data:
            contractor, _ = Contractor.objects.get_or_create(
                inn=data['inn'],
                defaults={'organization': org, **data},
            )
            for field, value in data.items():
                setattr(contractor, field, value)
            contractor.organization = org
            contractor.save()
            OrganizationContractor.objects.get_or_create(organization=org, contractor=contractor)
            contractors.append(contractor)

        route, _ = ApprovalRoute.objects.get_or_create(
            organization=org,
            name='Стандартный маршрут согласования',
            defaults={
                'stages': [
                    {'role': User.Role.APPROVER, 'order': 1, 'name': 'Юридическая проверка'},
                    {'role': User.Role.APPROVER, 'order': 2, 'name': 'Финансовая проверка'},
                    {'role': User.Role.DIRECTOR, 'order': 3, 'name': 'Утверждение руководителем'},
                ],
                'created_by': users['owner'],
            },
        )

        contracts_plan = [
            (Contract.Status.DRAFT, Contract.PriceType.NOT_SPECIFIED, None, 'Договор на обследование объекта'),
            (Contract.Status.ON_APPROVAL, Contract.PriceType.FIXED, Decimal('850000'), 'Договор на проектирование системы'),
            (Contract.Status.READY_TO_SIGN, Contract.PriceType.BY_RATES, None, 'Договор сервисного обслуживания'),
            (Contract.Status.SIGNED, Contract.PriceType.FREE, Decimal('0'), 'Безвозмездное соглашение о сотрудничестве'),
            (Contract.Status.ACTIVE, Contract.PriceType.ESTIMATE_BASED, None, 'Договор на поставку и монтаж оборудования'),
            (Contract.Status.ACTIVE, Contract.PriceType.FIXED, Decimal('2450000'), 'Договор на модернизацию инфраструктуры'),
            (Contract.Status.COMPLETED, Contract.PriceType.ESTIMATE_BASED, None, 'Договор на пусконаладочные работы'),
            (Contract.Status.TERMINATED, Contract.PriceType.FIXED, Decimal('390000'), 'Договор на консультационные услуги'),
        ]

        today = date.today()
        for index, (status, price_type, amount, title) in enumerate(contracts_plan, start=1):
            start_date = today - timedelta(days=20 * index)
            end_date = start_date + timedelta(days=120 + index * 10)
            contractor = contractors[index % len(contractors)]
            contract, _ = Contract.objects.get_or_create(
                organization=org,
                number=f'Д-{today.year}/{index:03d}',
                defaults={
                    'title': title,
                    'description': 'Демонстрационный договор для проверки договорной и сметной деятельности.',
                    'contractor': contractor,
                    'price_type': price_type,
                    'amount': amount,
                    'currency': 'RUB' if amount is not None else None,
                    'status': status,
                    'start_date': start_date,
                    'end_date': end_date,
                    'signing_date': start_date if status in [Contract.Status.SIGNED, Contract.Status.ACTIVE, Contract.Status.COMPLETED] else None,
                    'payment_terms': 'Оплата по актам выполненных работ в течение 10 рабочих дней.',
                    'created_by': users['manager'],
                    'responsible': users['manager'],
                },
            )
            for field, value in {
                'title': title,
                'description': 'Демонстрационный договор для проверки договорной и сметной деятельности.',
                'contractor': contractor,
                'price_type': price_type,
                'amount': amount,
                'currency': 'RUB' if amount is not None else None,
                'status': status,
                'start_date': start_date,
                'end_date': end_date,
                'signing_date': start_date if status in [Contract.Status.SIGNED, Contract.Status.ACTIVE, Contract.Status.COMPLETED] else None,
                'termination_date': today - timedelta(days=3) if status == Contract.Status.TERMINATED else None,
                'payment_terms': 'Оплата по актам выполненных работ в течение 10 рабочих дней.',
                'created_by': users['manager'],
                'responsible': users['manager'],
            }.items():
                setattr(contract, field, value)
            contract.save()
            if not contract.versions.exists():
                create_contract_version(contract, users['manager'], 'Начальная версия договора')

            stage_specs = [
                ('Поставка', Decimal('0.45'), 0),
                ('Монтаж', Decimal('0.35'), 35),
                ('Пусконаладка', Decimal('0.20'), 70),
            ]
            stages = []
            base_amount = amount or Decimal('1200000')
            for order, (name, ratio, offset) in enumerate(stage_specs, start=1):
                stage_status = ContractStage.Status.PLANNED
                if status == Contract.Status.COMPLETED:
                    stage_status = ContractStage.Status.COMPLETED
                elif status == Contract.Status.ACTIVE and order == 1:
                    stage_status = ContractStage.Status.COMPLETED
                elif status == Contract.Status.ACTIVE and order == 2:
                    stage_status = ContractStage.Status.IN_PROGRESS
                elif status == Contract.Status.TERMINATED:
                    stage_status = ContractStage.Status.CANCELLED
                stage, _ = ContractStage.objects.get_or_create(
                    contract=contract,
                    order=order,
                    defaults={'name': name},
                )
                stage.name = name
                stage.description = f'{name} по договору {contract.number}'
                stage.status = stage_status
                stage.planned_amount = (base_amount * ratio).quantize(Decimal('0.01'))
                stage.start_date = start_date + timedelta(days=offset)
                stage.end_date = start_date + timedelta(days=offset + 30)
                stage.actual_start_date = stage.start_date if stage_status in [ContractStage.Status.IN_PROGRESS, ContractStage.Status.COMPLETED] else None
                stage.actual_end_date = stage.end_date if stage_status == ContractStage.Status.COMPLETED else None
                stage.responsible_user = users['manager']
                stage.save()
                stages.append(stage)

            if price_type == Contract.PriceType.ESTIMATE_BASED:
                estimate, _ = Estimate.objects.get_or_create(
                    organization=org,
                    contract=contract,
                    number=f'С-{index:03d}',
                    defaults={
                        'title': f'Смета к договору {contract.number}',
                        'status': Estimate.Status.APPROVED if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED] else Estimate.Status.DRAFT,
                        'currency': 'RUB',
                        'created_by': users['manager'],
                    },
                )
                estimate.title = f'Смета к договору {contract.number}'
                estimate.status = Estimate.Status.APPROVED if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED] else Estimate.Status.DRAFT
                estimate.currency = 'RUB'
                estimate.created_by = users['manager']
                estimate.approved_at = timezone.now() - timedelta(days=5) if estimate.status == Estimate.Status.APPROVED else None
                estimate.save()
                item_specs = [
                    ('Оборудование', 'компл.', Decimal('1'), Decimal('620000'), stages[0]),
                    ('Кабельные трассы', 'м', Decimal('120'), Decimal('950'), stages[0]),
                    ('Монтажные работы', 'час', Decimal('80'), Decimal('2400'), stages[1]),
                    ('Настройка и испытания', 'час', Decimal('24'), Decimal('3200'), stages[2]),
                    ('Резервные расходы', 'усл.', Decimal('1'), Decimal('50000'), None),
                ]
                for item_order, (name, unit, quantity, price, stage) in enumerate(item_specs, start=1):
                    item, _ = EstimateItem.objects.get_or_create(
                        estimate=estimate,
                        name=name,
                        defaults={'unit': unit, 'quantity': quantity, 'price': price},
                    )
                    item.description = f'{name} для договора {contract.number}'
                    item.unit = unit
                    item.quantity = quantity
                    item.price = price
                    item.stage = stage
                    item.sort_order = item_order
                    item.save()
                estimate.recalculate_total()
                if not estimate.versions.exists():
                    create_estimate_version(estimate, users['manager'], 'Начальная версия сметы')

            if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED]:
                for act_index, stage in enumerate(stages[:2 if status == Contract.Status.ACTIVE else 3], start=1):
                    act, _ = Act.objects.get_or_create(
                        contract=contract,
                        number=f'А-{index:03d}-{act_index}',
                        defaults={'title': f'Акт по этапу "{stage.name}"', 'date': stage.end_date or today, 'amount': stage.planned_amount or Decimal('0')},
                    )
                    act.stage = stage
                    act.title = f'Акт по этапу "{stage.name}"'
                    act.date = stage.actual_end_date or stage.end_date or today
                    act.amount = stage.planned_amount or Decimal('0')
                    act.status = Act.Status.SIGNED
                    act.description = 'Подписанный акт выполненных работ.'
                    act.created_by = users['manager']
                    act.save()

                    payment, _ = Payment.objects.get_or_create(
                        contract=contract,
                        description=f'Оплата по акту {act.number}',
                        defaults={'amount': act.amount, 'planned_date': act.date + timedelta(days=10)},
                    )
                    payment.stage = stage
                    payment.act = act
                    payment.type = Payment.Type.ACTUAL
                    payment.amount = act.amount
                    payment.planned_date = act.date + timedelta(days=10)
                    payment.paid_date = payment.planned_date if status == Contract.Status.COMPLETED or act_index == 1 else None
                    payment.status = Payment.Status.PAID if payment.paid_date else Payment.Status.PENDING
                    payment.created_by = users['approver']
                    payment.save()
            else:
                payment, _ = Payment.objects.get_or_create(
                    contract=contract,
                    description=f'Плановый аванс по {contract.number}',
                    defaults={'amount': base_amount * Decimal('0.30'), 'planned_date': start_date + timedelta(days=15)},
                )
                payment.type = Payment.Type.PLANNED
                payment.amount = (base_amount * Decimal('0.30')).quantize(Decimal('0.01'))
                payment.planned_date = start_date + timedelta(days=15)
                payment.paid_date = None
                payment.status = Payment.Status.OVERDUE if payment.planned_date < today and status != Contract.Status.TERMINATED else Payment.Status.PENDING
                payment.stage = None
                payment.act = None
                payment.created_by = users['approver']
                payment.save()

            if status == Contract.Status.ON_APPROVAL:
                for stage_data in route.stages:
                    assigned = next((user for user in users.values() if user.role == stage_data['role']), None)
                    ApprovalTask.objects.get_or_create(
                        contract=contract,
                        route=route,
                        stage_order=stage_data['order'],
                        defaults={
                            'role': stage_data['role'],
                            'assigned_to': assigned,
                            'status': ApprovalTask.Status.PENDING if stage_data['order'] == 1 else ApprovalTask.Status.WAITING,
                            'deadline': today + timedelta(days=stage_data['order'] * 2),
                        },
                    )

        PaymentCalendar.objects.get_or_create(
            organization=org,
            month=today.replace(day=1),
            defaults={
                'total_planned': Decimal('1500000'),
                'total_actual': Decimal('1200000'),
                'debt': Decimal('300000'),
            },
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data!'))
        self.stdout.write('')
        self.stdout.write('=== Login credentials ===')
        self.stdout.write('  Owner:     owner / owner123')
        self.stdout.write('  Director:  director / dir123')
        self.stdout.write('  Manager:   manager / manager123')
        self.stdout.write('  Approver:  approver / approver123')

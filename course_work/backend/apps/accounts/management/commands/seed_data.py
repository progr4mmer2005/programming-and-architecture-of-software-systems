"""Management command to populate the database with demo data."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import OrganizationMembership, OrganizationRole, build_permission_map
from apps.acts.models import Act
from apps.approvals.models import ApprovalRoute, ApprovalTask
from apps.contractors.models import Contractor, OrganizationContractor
from apps.core.permissions import LEGACY_ROLE_PERMISSIONS
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

    def add_arguments(self, parser):
        parser.add_argument('--bulk-organizations', type=int, default=24)
        parser.add_argument('--contractors-per-org', type=int, default=28)
        parser.add_argument('--contracts-per-org', type=int, default=42)

    def handle(self, *args, **options):
        bulk_organizations = max(0, int(options['bulk_organizations']))
        contractors_per_org = max(5, int(options['contractors_per_org']))
        contracts_per_org = max(8, int(options['contracts_per_org']))
        self.stdout.write('Creating demo data...')

        ApprovalTask.objects.filter(role='admin').update(role=User.Role.OWNER)
        ApprovalTask.objects.filter(role__in=['lawyer', 'finance']).update(role=User.Role.APPROVER)
        ApprovalTask.objects.filter(route__name='Стандартный маршрут').delete()
        User.objects.filter(role='admin').update(role=User.Role.OWNER)
        User.objects.filter(role__in=['lawyer', 'finance']).delete()
        User.objects.filter(username__in=['owner', 'lawyer', 'finance']).delete()
        ApprovalRoute.objects.filter(name='Стандартный маршрут').delete()

        for route in ApprovalRoute.objects.all():
            stages = []
            changed = False
            approver_stage_index = 0
            for stage in route.stages or []:
                current = dict(stage)
                role = current.get('role')
                if role == 'admin':
                    current['role'] = User.Role.OWNER
                    changed = True
                elif role in ['lawyer', 'finance']:
                    current['role'] = User.Role.APPROVER
                    changed = True
                if current.get('role') == User.Role.APPROVER:
                    approver_stage_index += 1
                    if current.get('name') in ['Юридическая проверка', 'Финансовая проверка']:
                        current['name'] = 'Проверка согласующим лицом' if approver_stage_index == 1 else f'Проверка согласующим лицом {approver_stage_index}'
                        changed = True
                stages.append(current)
            if changed:
                route.stages = stages
                route.save(update_fields=['stages'])

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
        OrganizationRole.create_default_super_admin(org)
        OrganizationRole.create_default_user(org)

        users_data = [
            {'username': 'admin', 'password': 'admin123', 'role': User.Role.SUPER_ADMIN, 'email': 'admin@techservice.ru', 'first_name': 'Алексей'},
            {'username': 'director', 'password': 'dir123', 'role': User.Role.DIRECTOR, 'email': 'director@techservice.ru', 'first_name': 'Марина'},
            {'username': 'manager', 'password': 'manager123', 'role': User.Role.MANAGER, 'email': 'manager@techservice.ru', 'first_name': 'Илья'},
            {'username': 'approver', 'password': 'approver123', 'role': User.Role.APPROVER, 'email': 'approver@techservice.ru', 'first_name': 'Елена'},
            {'username': 'approver2', 'password': 'approver234', 'role': User.Role.APPROVER, 'email': 'approver2@techservice.ru', 'first_name': 'Ольга'},
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
            user.set_password(data['password'])
            user.save()

            role, _ = OrganizationRole.objects.get_or_create(
                organization=org,
                code=data['role'],
                defaults={
                    'name': data['role'],
                    'permissions': LEGACY_ROLE_PERMISSIONS.get(data['role'], build_permission_map(False)),
                    'is_system': data['role'] in [User.Role.SUPER_ADMIN, User.Role.USER],
                },
            )
            membership, _ = OrganizationMembership.objects.get_or_create(
                user=user,
                organization=org,
                defaults={'role': role, 'is_active': True},
            )
            membership.role = role
            membership.is_active = True
            membership.save(update_fields=['role', 'is_active', 'updated_at'])

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
                    {'role': User.Role.APPROVER, 'order': 1, 'name': 'Первичная проверка согласующим лицом', 'assigned_to': users['approver'].id, 'assigned_to_name': users['approver'].get_full_name() or users['approver'].username},
                    {'role': User.Role.APPROVER, 'order': 2, 'name': 'Повторная проверка согласующим лицом', 'assigned_to': users['approver2'].id, 'assigned_to_name': users['approver2'].get_full_name() or users['approver2'].username},
                    {'role': User.Role.DIRECTOR, 'order': 3, 'name': 'Утверждение руководителем', 'assigned_to': users['director'].id, 'assigned_to_name': users['director'].get_full_name() or users['director'].username},
                ],
                'created_by': users['admin'],
            },
        )
        route.stages = [
            {'role': User.Role.APPROVER, 'order': 1, 'name': 'Первичная проверка согласующим лицом', 'assigned_to': users['approver'].id, 'assigned_to_name': users['approver'].get_full_name() or users['approver'].username},
            {'role': User.Role.APPROVER, 'order': 2, 'name': 'Повторная проверка согласующим лицом', 'assigned_to': users['approver2'].id, 'assigned_to_name': users['approver2'].get_full_name() or users['approver2'].username},
            {'role': User.Role.DIRECTOR, 'order': 3, 'name': 'Утверждение руководителем', 'assigned_to': users['director'].id, 'assigned_to_name': users['director'].get_full_name() or users['director'].username},
        ]
        route.is_active = True
        route.created_by = users['admin']
        route.save()

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

        self.stdout.write('Creating large bulk dataset...')
        status_cycle = [
            Contract.Status.DRAFT,
            Contract.Status.ON_APPROVAL,
            Contract.Status.READY_TO_SIGN,
            Contract.Status.SIGNED,
            Contract.Status.ACTIVE,
            Contract.Status.COMPLETED,
            Contract.Status.TERMINATED,
        ]
        price_type_cycle = [
            Contract.PriceType.NOT_SPECIFIED,
            Contract.PriceType.FIXED,
            Contract.PriceType.BY_RATES,
            Contract.PriceType.ESTIMATE_BASED,
            Contract.PriceType.FREE,
        ]
        user_role_codes = [
            User.Role.DIRECTOR,
            User.Role.MANAGER,
            User.Role.APPROVER,
        ]
        bulk_base_org_index = 1200

        for org_index in range(1, bulk_organizations + 1):
            org_number = bulk_base_org_index + org_index
            org_inn = f'{7700000000 + org_number:010d}'
            bulk_org, _ = Organization.objects.get_or_create(
                inn=org_inn,
                defaults={
                    'name': f'ООО "ТестОрг {org_number}"',
                    'legal_name': f'Общество с ограниченной ответственностью "ТестОрг {org_number}"',
                    'kpp': f'{770000000 + org_number:09d}'[-9:],
                    'ogrn': f'{1027700000000 + org_number:013d}'[-13:],
                    'address': f'г. Москва, Тестовая улица, д. {org_index}',
                    'is_active': True,
                },
            )
            OrganizationRole.create_default_super_admin(bulk_org)
            OrganizationRole.create_default_user(bulk_org)

            super_admin_role, _ = OrganizationRole.objects.get_or_create(
                organization=bulk_org,
                code=User.Role.SUPER_ADMIN,
                defaults={
                    'name': 'super_admin',
                    'permissions': LEGACY_ROLE_PERMISSIONS.get(User.Role.SUPER_ADMIN, build_permission_map(True)),
                    'is_system': True,
                },
            )
            system_user_role, _ = OrganizationRole.objects.get_or_create(
                organization=bulk_org,
                code=User.Role.USER,
                defaults={
                    'name': 'user',
                    'permissions': LEGACY_ROLE_PERMISSIONS.get(User.Role.USER, build_permission_map(False)),
                    'is_system': True,
                },
            )

            org_roles = {User.Role.SUPER_ADMIN: super_admin_role, User.Role.USER: system_user_role}
            for role_code in user_role_codes:
                org_role, _ = OrganizationRole.objects.get_or_create(
                    organization=bulk_org,
                    code=role_code,
                    defaults={
                        'name': role_code,
                        'permissions': LEGACY_ROLE_PERMISSIONS.get(role_code, build_permission_map(False)),
                        'is_system': False,
                    },
                )
                org_roles[role_code] = org_role

            admin_username = f'org{org_number}_admin'
            admin_email = f'{admin_username}@example.local'
            admin_user, _ = User.objects.get_or_create(
                username=admin_username,
                defaults={
                    'email': admin_email,
                    'first_name': 'Главный',
                    'last_name': f'Админ {org_number}',
                    'role': User.Role.SUPER_ADMIN,
                    'organization': bulk_org,
                    'is_active': True,
                },
            )
            admin_user.email = admin_email
            admin_user.organization = bulk_org
            admin_user.role = User.Role.SUPER_ADMIN
            admin_user.is_active = True
            admin_user.set_password('admin123')
            admin_user.save()

            OrganizationMembership.objects.update_or_create(
                user=admin_user,
                organization=bulk_org,
                defaults={'role': org_roles[User.Role.SUPER_ADMIN], 'is_active': True},
            )

            staff_users = []
            for staff_index in range(1, 7):
                role_code = user_role_codes[(staff_index - 1) % len(user_role_codes)]
                username = f'org{org_number}_user{staff_index}'
                email = f'{username}@example.local'
                staff_user, _ = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': email,
                        'first_name': 'Тест',
                        'last_name': f'Пользователь {staff_index}',
                        'role': role_code,
                        'organization': bulk_org,
                        'is_active': True,
                    },
                )
                staff_user.email = email
                staff_user.organization = bulk_org
                staff_user.role = role_code
                staff_user.is_active = True
                staff_user.set_password('test12345')
                staff_user.save()
                OrganizationMembership.objects.update_or_create(
                    user=staff_user,
                    organization=bulk_org,
                    defaults={'role': org_roles[role_code], 'is_active': True},
                )
                staff_users.append(staff_user)

            route_stages = []
            route_assignees = [staff_users[2], staff_users[5], staff_users[0]]
            route_roles = [User.Role.APPROVER, User.Role.APPROVER, User.Role.DIRECTOR]
            route_names = ['Первичная проверка', 'Повторная проверка', 'Финальное утверждение']
            for route_order, (route_user, route_role, route_name) in enumerate(zip(route_assignees, route_roles, route_names), start=1):
                route_stages.append({
                    'role': route_role,
                    'order': route_order,
                    'name': route_name,
                    'assigned_to': route_user.id,
                    'assigned_to_name': route_user.get_full_name() or route_user.username,
                })

            route, _ = ApprovalRoute.objects.get_or_create(
                organization=bulk_org,
                name='Стандартный маршрут согласования',
                defaults={'stages': route_stages, 'created_by': admin_user, 'is_active': True},
            )
            route.stages = route_stages
            route.created_by = admin_user
            route.is_active = True
            route.save(update_fields=['stages', 'created_by', 'is_active', 'updated_at'])

            org_contractors = []
            for contractor_index in range(1, contractors_per_org + 1):
                inn_number = 500000000000 + org_number * 1000 + contractor_index
                contractor_inn = str(inn_number)[-12:]
                contractor, _ = Contractor.objects.get_or_create(
                    inn=contractor_inn,
                    defaults={
                        'organization': bulk_org,
                        'name': f'Контрагент {org_number}-{contractor_index}',
                        'full_name': f'ООО "Контрагент {org_number}-{contractor_index}"',
                        'kpp': f'{910000000 + contractor_index:09d}'[-9:],
                        'ogrn': f'{1027800000000 + org_number * 10 + contractor_index:013d}'[-13:],
                        'address': f'г. Санкт-Петербург, Тестовый пр., д. {contractor_index}',
                        'phone': f'+7 (999) {org_index % 10}{contractor_index % 10}{(contractor_index + 1) % 10}-{contractor_index % 10}{(contractor_index + 2) % 10}-00',
                        'email': f'contractor_{org_number}_{contractor_index}@example.local',
                        'contact_person': f'Контакт {contractor_index}',
                        'bank_name': f'Банк #{(contractor_index % 9) + 1}',
                        'bank_bik': f'{440000000 + contractor_index:09d}'[-9:],
                        'bank_account': f'{40702810000000000000 + contractor_index:020d}'[-20:],
                        'is_active': True,
                    },
                )
                contractor.organization = bulk_org
                contractor.name = f'Контрагент {org_number}-{contractor_index}'
                contractor.full_name = f'ООО "Контрагент {org_number}-{contractor_index}"'
                contractor.address = f'г. Санкт-Петербург, Тестовый пр., д. {contractor_index}'
                contractor.phone = f'+7 (999) {org_index % 10}{contractor_index % 10}{(contractor_index + 1) % 10}-{contractor_index % 10}{(contractor_index + 2) % 10}-00'
                contractor.email = f'contractor_{org_number}_{contractor_index}@example.local'
                contractor.contact_person = f'Контакт {contractor_index}'
                contractor.bank_name = f'Банк #{(contractor_index % 9) + 1}'
                contractor.bank_bik = f'{440000000 + contractor_index:09d}'[-9:]
                contractor.bank_account = f'{40702810000000000000 + contractor_index:020d}'[-20:]
                contractor.is_active = True
                contractor.save()
                OrganizationContractor.objects.update_or_create(
                    organization=bulk_org,
                    contractor=contractor,
                    defaults={'is_active': True},
                )
                org_contractors.append(contractor)

            for contract_index in range(1, contracts_per_org + 1):
                contract_number = f'B-{org_number}-{contract_index:04d}'
                status = status_cycle[(contract_index - 1) % len(status_cycle)]
                price_type = price_type_cycle[(contract_index - 1) % len(price_type_cycle)]
                contractor = org_contractors[(contract_index - 1) % len(org_contractors)]
                start_date = today - timedelta(days=contract_index * 4 + org_index)
                end_date = start_date + timedelta(days=95 + (contract_index % 8) * 18)
                contract_amount = Decimal(str(180000 + (contract_index % 14) * 53000))
                if price_type in [Contract.PriceType.NOT_SPECIFIED, Contract.PriceType.BY_RATES]:
                    contract_amount = None
                if price_type == Contract.PriceType.FREE:
                    contract_amount = Decimal('0')

                contract, _ = Contract.objects.get_or_create(
                    organization=bulk_org,
                    number=contract_number,
                    defaults={
                        'title': f'Договор {org_number}-{contract_index}',
                        'description': 'Автоматически созданный тестовый договор для нагрузочного наполнения.',
                        'contractor': contractor,
                        'price_type': price_type,
                        'amount': contract_amount,
                        'currency': 'RUB' if contract_amount is not None else None,
                        'status': status,
                        'start_date': start_date,
                        'end_date': end_date,
                        'signing_date': start_date if status in [Contract.Status.SIGNED, Contract.Status.ACTIVE, Contract.Status.COMPLETED] else None,
                        'payment_terms': 'Оплата по актам в течение 15 календарных дней.',
                        'created_by': staff_users[1],
                        'responsible': staff_users[1],
                    },
                )
                contract.title = f'Договор {org_number}-{contract_index}'
                contract.description = 'Автоматически созданный тестовый договор для нагрузочного наполнения.'
                contract.contractor = contractor
                contract.price_type = price_type
                contract.amount = contract_amount
                contract.currency = 'RUB' if contract_amount is not None else None
                contract.status = status
                contract.start_date = start_date
                contract.end_date = end_date
                contract.signing_date = start_date if status in [Contract.Status.SIGNED, Contract.Status.ACTIVE, Contract.Status.COMPLETED] else None
                contract.termination_date = today - timedelta(days=(contract_index % 25) + 1) if status == Contract.Status.TERMINATED else None
                contract.payment_terms = 'Оплата по актам в течение 15 календарных дней.'
                contract.created_by = staff_users[1]
                contract.responsible = staff_users[1]
                contract.save()

                if not contract.versions.exists():
                    create_contract_version(contract, staff_users[1], 'Автоматически созданная версия')

                base_amount = contract_amount if contract_amount is not None else Decimal('600000')
                stage_specs = [
                    ('Подготовка', Decimal('0.30'), 0),
                    ('Исполнение', Decimal('0.45'), 35),
                    ('Закрытие', Decimal('0.25'), 70),
                ]
                contract_stages = []
                for stage_order, (stage_name, stage_ratio, stage_offset) in enumerate(stage_specs, start=1):
                    stage_status = ContractStage.Status.PLANNED
                    if status == Contract.Status.COMPLETED:
                        stage_status = ContractStage.Status.COMPLETED
                    elif status == Contract.Status.ACTIVE and stage_order == 1:
                        stage_status = ContractStage.Status.COMPLETED
                    elif status == Contract.Status.ACTIVE and stage_order == 2:
                        stage_status = ContractStage.Status.IN_PROGRESS
                    elif status == Contract.Status.TERMINATED:
                        stage_status = ContractStage.Status.CANCELLED
                    stage, _ = ContractStage.objects.get_or_create(contract=contract, order=stage_order, defaults={'name': stage_name})
                    stage.name = stage_name
                    stage.description = f'{stage_name} по договору {contract.number}'
                    stage.status = stage_status
                    stage.planned_amount = (base_amount * stage_ratio).quantize(Decimal('0.01'))
                    stage.start_date = start_date + timedelta(days=stage_offset)
                    stage.end_date = start_date + timedelta(days=stage_offset + 30)
                    stage.actual_start_date = stage.start_date if stage_status in [ContractStage.Status.IN_PROGRESS, ContractStage.Status.COMPLETED] else None
                    stage.actual_end_date = stage.end_date if stage_status == ContractStage.Status.COMPLETED else None
                    stage.responsible_user = staff_users[1]
                    stage.save()
                    contract_stages.append(stage)

                if price_type == Contract.PriceType.ESTIMATE_BASED:
                    estimate, _ = Estimate.objects.get_or_create(
                        organization=bulk_org,
                        contract=contract,
                        number=f'BE-{org_number}-{contract_index:04d}',
                        defaults={
                            'title': f'Смета к {contract.number}',
                            'status': Estimate.Status.APPROVED if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED] else Estimate.Status.DRAFT,
                            'currency': 'RUB',
                            'created_by': staff_users[1],
                        },
                    )
                    estimate.title = f'Смета к {contract.number}'
                    estimate.status = Estimate.Status.APPROVED if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED] else Estimate.Status.DRAFT
                    estimate.currency = 'RUB'
                    estimate.created_by = staff_users[1]
                    estimate.approved_at = timezone.now() - timedelta(days=2) if estimate.status == Estimate.Status.APPROVED else None
                    estimate.save()

                    estimate_items = [
                        ('Материалы', 'компл.', Decimal('1'), Decimal('210000'), contract_stages[0]),
                        ('Работы', 'час', Decimal('120'), Decimal('1800'), contract_stages[1]),
                        ('Сопровождение', 'час', Decimal('30'), Decimal('2200'), contract_stages[2]),
                        ('Резерв', 'усл.', Decimal('1'), Decimal('45000'), None),
                    ]
                    for item_order, (item_name, unit, quantity, price, stage) in enumerate(estimate_items, start=1):
                        estimate_item, _ = EstimateItem.objects.get_or_create(
                            estimate=estimate,
                            name=item_name,
                            sort_order=item_order,
                            defaults={'unit': unit, 'quantity': quantity, 'price': price},
                        )
                        estimate_item.description = f'{item_name} для {contract.number}'
                        estimate_item.unit = unit
                        estimate_item.quantity = quantity
                        estimate_item.price = price
                        estimate_item.stage = stage
                        estimate_item.sort_order = item_order
                        estimate_item.save()
                    estimate.recalculate_total()
                    if not estimate.versions.exists():
                        create_estimate_version(estimate, staff_users[1], 'Автоматически созданная версия сметы')

                if status in [Contract.Status.ACTIVE, Contract.Status.COMPLETED]:
                    acts_to_create = 3 if status == Contract.Status.COMPLETED else 2
                    for act_order, stage in enumerate(contract_stages[:acts_to_create], start=1):
                        act, _ = Act.objects.get_or_create(
                            contract=contract,
                            number=f'BA-{org_number}-{contract_index:04d}-{act_order}',
                            defaults={
                                'title': f'Акт этапа {stage.name}',
                                'date': stage.actual_end_date or stage.end_date or today,
                                'amount': stage.planned_amount or Decimal('0'),
                            },
                        )
                        act.stage = stage
                        act.title = f'Акт этапа {stage.name}'
                        act.date = stage.actual_end_date or stage.end_date or today
                        act.amount = stage.planned_amount or Decimal('0')
                        act.status = Act.Status.SIGNED
                        act.description = 'Автоматически созданный акт.'
                        act.created_by = staff_users[1]
                        act.save()

                        payment, _ = Payment.objects.get_or_create(
                            contract=contract,
                            act=act,
                            defaults={
                                'description': f'Оплата по {act.number}',
                                'type': Payment.Type.ACTUAL,
                                'amount': act.amount,
                                'planned_date': act.date + timedelta(days=12),
                            },
                        )
                        payment.description = f'Оплата по {act.number}'
                        payment.stage = stage
                        payment.act = act
                        payment.type = Payment.Type.ACTUAL
                        payment.amount = act.amount
                        payment.planned_date = act.date + timedelta(days=12)
                        payment.paid_date = payment.planned_date if status == Contract.Status.COMPLETED or act_order == 1 else None
                        payment.status = Payment.Status.PAID if payment.paid_date else Payment.Status.PENDING
                        payment.created_by = staff_users[2]
                        payment.save()
                else:
                    plan_payment, _ = Payment.objects.get_or_create(
                        contract=contract,
                        description=f'Плановый платёж {contract.number}',
                        type=Payment.Type.PLANNED,
                        defaults={
                            'amount': (base_amount * Decimal('0.25')).quantize(Decimal('0.01')),
                            'planned_date': start_date + timedelta(days=20),
                            'created_by': staff_users[2],
                        },
                    )
                    plan_payment.amount = (base_amount * Decimal('0.25')).quantize(Decimal('0.01'))
                    plan_payment.planned_date = start_date + timedelta(days=20)
                    plan_payment.paid_date = None
                    plan_payment.status = Payment.Status.OVERDUE if plan_payment.planned_date < today and status != Contract.Status.TERMINATED else Payment.Status.PENDING
                    plan_payment.stage = None
                    plan_payment.act = None
                    plan_payment.created_by = staff_users[2]
                    plan_payment.save()

                if status == Contract.Status.ON_APPROVAL:
                    for stage_data in route.stages:
                        assigned_id = stage_data.get('assigned_to')
                        assigned_to = User.objects.filter(id=assigned_id).first() if assigned_id else None
                        ApprovalTask.objects.update_or_create(
                            contract=contract,
                            route=route,
                            stage_order=stage_data['order'],
                            defaults={
                                'role': stage_data['role'],
                                'assigned_to': assigned_to,
                                'status': ApprovalTask.Status.PENDING if stage_data['order'] == 1 else ApprovalTask.Status.WAITING,
                                'deadline': today + timedelta(days=stage_data['order'] * 2),
                            },
                        )

            PaymentCalendar.objects.update_or_create(
                organization=bulk_org,
                month=today.replace(day=1),
                defaults={
                    'total_planned': Decimal('2500000') + Decimal(org_index * 130000),
                    'total_actual': Decimal('1800000') + Decimal(org_index * 90000),
                    'debt': Decimal('700000') + Decimal(org_index * 40000),
                },
            )

            if org_index % 4 == 0:
                self.stdout.write(f'  Bulk organizations ready: {org_index}/{bulk_organizations}')

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data!'))
        self.stdout.write(
            f'  Totals: organizations={Organization.objects.count()}, users={User.objects.count()}, '
            f'contractors={Contractor.objects.count()}, contracts={Contract.objects.count()}, '
            f'estimates={Estimate.objects.count()}, payments={Payment.objects.count()}'
        )
        self.stdout.write('')
        self.stdout.write('=== Login credentials ===')
        self.stdout.write('  Admin:     admin / admin123')
        self.stdout.write('  Director:  director / dir123')
        self.stdout.write('  Manager:   manager / manager123')
        self.stdout.write('  Approver:  approver / approver123')
        self.stdout.write('  Approver2: approver2 / approver234')

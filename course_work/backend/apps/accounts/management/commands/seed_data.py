"""Management command to populate the database with demo data."""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.organizations.models import Organization
from apps.contractors.models import Contractor
from apps.contracts.models import Contract, ContractVersion
from apps.estimates.models import Estimate, EstimateVersion
from apps.payments.models import Payment, PaymentCalendar
from apps.approvals.models import ApprovalRoute, ApprovalTask
from apps.stages.models import ContractStage
from decimal import Decimal
from datetime import date, timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with demo data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating demo data...')

        # Create Organization
        org, created = Organization.objects.get_or_create(
            inn='7701234567',
            defaults={
                'name': 'ООО "ТехноСервис"',
                'legal_name': 'Общество с ограниченной ответственностью "ТехноСервис"',
                'kpp': '770101001',
                'ogrn': '1027700132195',
                'address': 'г. Москва, ул. Ленина, д. 10',
            }
        )
        self.stdout.write(f'  Organization: {org.name}')

        # Create Users
        users_data = [
            {'username': 'owner', 'password': 'owner123', 'role': 'owner', 'email': 'owner@techservice.ru'},
            {'username': 'director', 'password': 'dir123', 'role': 'director', 'email': 'director@techservice.ru'},
            {'username': 'manager', 'password': 'manager123', 'role': 'manager', 'email': 'manager@techservice.ru'},
            {'username': 'lawyer', 'password': 'lawyer123', 'role': 'lawyer', 'email': 'lawyer@techservice.ru'},
            {'username': 'finance', 'password': 'finance123', 'role': 'finance', 'email': 'finance@techservice.ru'},
        ]
        users = []
        for data in users_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'organization': org,
                    'role': data['role'],
                    'email': data['email'],
                    'first_name': data['username'].capitalize(),
                }
            )
            if created:
                user.set_password(data['password'])
                user.save()
            users.append(user)
            self.stdout.write(f'  User: {user.username} ({user.get_role_display()})')

        # Create Contractors
        contractors_data = [
            {'name': 'ООО "СтройИнвест"', 'inn': '7702345678', 'full_name': 'ООО "СтройИнвест"'},
            {'name': 'АО "Поставщик"', 'inn': '7703456789', 'full_name': 'АО "Поставщик"'},
            {'name': 'ИП Иванов', 'inn': '770456789012', 'full_name': 'ИП Иванов И.И.'},
        ]
        contractors = []
        for data in contractors_data:
            c, _ = Contractor.objects.get_or_create(
                organization=org, inn=data['inn'],
                defaults={'name': data['name'], 'full_name': data['full_name']},
            )
            contractors.append(c)

        # Create Approval Routes
        route, _ = ApprovalRoute.objects.get_or_create(
            organization=org, name='Стандартный маршрут',
            defaults={
                'stages': [
                    {'role': 'lawyer', 'order': 1, 'name': 'Юридическая экспертиза'},
                    {'role': 'finance', 'order': 2, 'name': 'Финансовая проверка'},
                    {'role': 'director', 'order': 3, 'name': 'Утверждение руководителем'},
                ],
                'created_by': users[0],
            }
        )

        # Create Contracts
        contract_statuses = ['draft', 'approval', 'active', 'execution', 'closed']
        for i in range(8):
            status = contract_statuses[i % len(contract_statuses)]
            amount = Decimal(random.randint(100000, 5000000))
            contract, _ = Contract.objects.get_or_create(
                organization=org,
                title=f'Договор №{i+1}-{2025} на поставку оборудования',
                defaults={
                    'number': f'Д-{2025}/{i+1:03d}',
                    'status': status,
                    'contract_type': random.choice(['supply', 'service', 'standard']),
                    'contractor': random.choice(contractors),
                    'amount': amount,
                    'start_date': date.today() - timedelta(days=random.randint(0, 365)),
                    'end_date': date.today() + timedelta(days=random.randint(30, 365)),
                    'created_by': users[2],
                    'responsible': random.choice(users[:3]),
                }
            )
            # Create first version
            ContractVersion.objects.get_or_create(
                contract=contract, version_number=1,
                defaults={
                    'number': contract.number,
                    'amount': amount,
                    'content': {'subject': f'Поставка оборудования по договору {contract.number}'},
                    'created_by': users[2],
                    'is_current': True,
                }
            )
            # Create stages
            for j, stage_data in enumerate([
                {'name': 'Этап 1: Поставка', 'amount': amount * Decimal('0.5')},
                {'name': 'Этап 2: Монтаж', 'amount': amount * Decimal('0.3')},
                {'name': 'Этап 3: Пусконаладка', 'amount': amount * Decimal('0.2')},
            ]):
                ContractStage.objects.get_or_create(
                    contract=contract, order=j+1,
                    defaults={
                        'name': stage_data['name'],
                        'amount': stage_data['amount'],
                        'start_date': contract.start_date + timedelta(days=j * 30),
                        'end_date': contract.start_date + timedelta(days=(j + 1) * 30),
                        'is_completed': status in ['execution', 'closed'],
                    }
                )

            # Create estimates
            if random.random() > 0.3:
                estimate, _ = Estimate.objects.get_or_create(
                    organization=org, contract=contract,
                    title=f'Смета к {contract.number}',
                    defaults={
                        'number': f'С-{contract.number.split("/")[-1]}',
                        'amount': amount,
                        'status': 'approved' if status in ['active', 'execution', 'closed'] else 'draft',
                        'created_by': users[2],
                    }
                )
                EstimateVersion.objects.get_or_create(
                    estimate=estimate, version_number=1,
                    defaults={'amount': amount, 'is_current': True, 'created_by': users[2]}
                )

            # Create payments
            for pi in range(3):
                planned_date = contract.start_date + timedelta(days=pi * 30)
                Payment.objects.get_or_create(
                    contract=contract,
                    type='planned',
                    amount=amount / Decimal('3'),
                    planned_date=planned_date,
                    defaults={
                        'status': 'paid' if planned_date < date.today() else 'pending',
                        'description': f'Платёж {pi+1} по {contract.number}',
                        'created_by': users[4],
                    }
                )

            # Create approval tasks if contract is in approval
            if status == 'approval':
                for stage in route.stages:
                    assigned = next((u for u in users if u.role == stage['role']), None)
                    ApprovalTask.objects.get_or_create(
                        contract=contract, stage_order=stage['order'],
                        defaults={
                            'route': route,
                            'role': stage['role'],
                            'assigned_to': assigned,
                            'status': 'pending',
                        }
                    )

        # Create PaymentCalendar
        PaymentCalendar.objects.get_or_create(
            organization=org,
            month=date.today().replace(day=1),
            defaults={
                'total_planned': Decimal('1500000'),
                'total_actual': Decimal('1200000'),
                'debt': Decimal('300000'),
            }
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data!'))
        self.stdout.write('')
        self.stdout.write('=== Login credentials ===')
        self.stdout.write('  Owner:     owner / owner123')
        self.stdout.write('  Director:  director / dir123')
        self.stdout.write('  Manager:   manager / manager123')
        self.stdout.write('  Lawyer:    lawyer / lawyer123')
        self.stdout.write('  Finance:   finance / finance123')
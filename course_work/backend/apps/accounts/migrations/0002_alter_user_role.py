from django.db import migrations, models


def normalize_roles(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    ApprovalTask = apps.get_model('approvals', 'ApprovalTask')
    ApprovalRoute = apps.get_model('approvals', 'ApprovalRoute')

    User.objects.filter(role='admin').update(role='owner')
    User.objects.filter(role__in=['lawyer', 'finance']).delete()

    ApprovalTask.objects.filter(role='admin').update(role='owner')
    ApprovalTask.objects.filter(role__in=['lawyer', 'finance']).update(role='approver')

    for route in ApprovalRoute.objects.all():
        stages = []
        changed = False
        approver_stage_index = 0

        for stage in route.stages or []:
            current = dict(stage)
            role = current.get('role')

            if role == 'admin':
                current['role'] = 'owner'
                changed = True
            elif role in ['lawyer', 'finance']:
                current['role'] = 'approver'
                changed = True

            if current.get('role') == 'approver':
                approver_stage_index += 1
                if current.get('name') in ['Юридическая проверка', 'Финансовая проверка']:
                    current['name'] = (
                        'Проверка согласующим лицом'
                        if approver_stage_index == 1
                        else f'Проверка согласующим лицом {approver_stage_index}'
                    )
                    changed = True

            stages.append(current)

        if changed:
            route.stages = stages
            route.save(update_fields=['stages'])


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0003_remove_approvalroute_contract_types_and_more'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('owner', 'Администратор'),
                    ('director', 'Руководитель'),
                    ('manager', 'Менеджер'),
                    ('approver', 'Согласующее лицо'),
                ],
                default='manager',
                max_length=20,
                verbose_name='Роль',
            ),
        ),
        migrations.RunPython(normalize_roles, migrations.RunPython.noop),
    ]

from django.db import migrations


def forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    OrganizationRole = apps.get_model('accounts', 'OrganizationRole')
    OrganizationMembership = apps.get_model('accounts', 'OrganizationMembership')
    Organization = apps.get_model('organizations', 'Organization')

    for organization in Organization.objects.all().iterator():
        super_admin_role, _ = OrganizationRole.objects.get_or_create(
            organization_id=organization.id,
            code='super_admin',
            defaults={
                'name': 'Главный админ',
                'permissions': {k: True for k in [
                    'can_view_dashboard','can_view_contracts','can_manage_contracts','can_launch_approval',
                    'can_view_contractors','can_manage_contractors','can_view_templates','can_manage_templates',
                    'can_view_estimates','can_manage_estimates','can_view_approvals','can_manage_approval_routes',
                    'can_process_approval_tasks','can_view_payments','can_manage_payments','can_view_calendar',
                    'can_view_reports','can_view_organization','can_manage_organization','can_manage_users',
                    'can_manage_references','can_view_audit','scoped_to_assigned_contracts'
                ]},
                'is_system': True,
            },
        )

        memberships = OrganizationMembership.objects.filter(organization_id=organization.id, is_active=True)
        if memberships.filter(role__code='super_admin').exists():
            continue

        if memberships.count() != 1:
            continue

        membership = memberships.select_related('user').first()
        if membership is None:
            continue

        membership.role_id = super_admin_role.id
        membership.save(update_fields=['role', 'updated_at'])

        user = membership.user
        if user.organization_id == organization.id:
            user.role = 'super_admin'
            user.save(update_fields=['role'])


def backward(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_update_default_user_role_permissions'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]

"""Signal handlers for automatic audit logging."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import AuditLog

User = get_user_model()

# Models to track for audit
AUDIT_MODELS = {
    'Contract': 'contracts.Contract',
    'ContractVersion': 'contracts.ContractVersion',
    'Estimate': 'estimates.Estimate',
    'EstimateVersion': 'estimates.EstimateVersion',
    'Contractor': 'contractors.Contractor',
    'ApprovalRoute': 'approvals.ApprovalRoute',
    'ApprovalTask': 'approvals.ApprovalTask',
    'Payment': 'payments.Payment',
}


def _get_organization(instance):
    """Try to get organization from instance."""
    if hasattr(instance, 'organization'):
        return instance.organization
    if hasattr(instance, 'contract') and hasattr(instance.contract, 'organization'):
        return instance.contract.organization
    return None


@receiver(post_save)
def audit_log_save(sender, instance, created, **kwargs):
    """Log create/update actions for tracked models."""
    model_name = sender.__name__
    if model_name not in AUDIT_MODELS and model_name != 'User':
        return
    
    org = _get_organization(instance)
    if not org:
        return
    
    action = 'create' if created else 'update'
    changes = {}
    if not created and hasattr(instance, '_changed_fields'):
        changes = instance._changed_fields

    AuditLog.objects.create(
        organization=org,
        user=getattr(instance, '_changed_by', None),
        action=action,
        entity_type=model_name,
        entity_id=instance.id,
        changes=changes,
        description=f"{'Создан' if created else 'Обновлён'} {model_name} #{instance.id}",
    )


@receiver(post_delete)
def audit_log_delete(sender, instance, **kwargs):
    """Log delete actions for tracked models."""
    model_name = sender.__name__
    if model_name not in AUDIT_MODELS:
        return
    
    org = _get_organization(instance)
    if not org:
        return

    AuditLog.objects.create(
        organization=org,
        user=getattr(instance, '_changed_by', None),
        action='delete',
        entity_type=model_name,
        entity_id=instance.id,
        changes={},
        description=f"Удалён {model_name} #{instance.id}",
    )
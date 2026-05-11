"""Estimate snapshots, totals and versioning."""
from decimal import Decimal


def _json_value(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return value


def calculateEstimateItemTotal(item):
    return (item.quantity or Decimal('0')) * (item.price or Decimal('0'))


def calculateEstimateTotal(items):
    return sum((calculateEstimateItemTotal(item) for item in items), Decimal('0'))


def estimate_snapshot(estimate):
    return {
        'title': estimate.title,
        'number': estimate.number,
        'status': estimate.status,
        'totalAmount': _json_value(estimate.total_amount),
        'currency': estimate.currency,
        'items': [
            {
                'name': item.name,
                'description': item.description,
                'unit': item.unit,
                'quantity': _json_value(item.quantity),
                'price': _json_value(item.price),
                'total': _json_value(item.total),
                'sortOrder': item.sort_order,
                'stageId': item.stage_id,
            }
            for item in estimate.items.order_by('sort_order', 'id')
        ],
    }


def hasImportantEstimateChanges(old_snapshot, new_snapshot):
    return old_snapshot != new_snapshot


def create_estimate_version(estimate, user=None, reason=''):
    from .models import EstimateVersion

    next_number = (estimate.versions.order_by('-version_number').values_list('version_number', flat=True).first() or 0) + 1
    estimate.versions.update(is_current=False)
    version = EstimateVersion.objects.create(
        estimate=estimate,
        version_number=next_number,
        snapshot=estimate_snapshot(estimate),
        change_reason=reason,
        created_by=user,
        is_current=True,
    )
    if estimate.current_version != next_number:
        estimate.current_version = next_number
        estimate.save(update_fields=['current_version', 'updated_at'])
    return version

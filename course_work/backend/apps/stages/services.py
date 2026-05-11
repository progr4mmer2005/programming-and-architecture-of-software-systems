"""Stage financial calculations."""
from decimal import Decimal


def calculateStagePlannedAmount(stage, estimate_items=None):
    estimate_items = estimate_items if estimate_items is not None else stage.estimate_items.all()
    linked_total = sum((item.total for item in estimate_items if item.stage_id == stage.id), Decimal('0'))
    if linked_total:
        return linked_total
    return stage.planned_amount


def calculateStageActualAmount(stage, acts=None):
    acts = acts if acts is not None else stage.acts.all()
    return sum((act.amount for act in acts if act.status == 'signed'), Decimal('0'))

"""Contract snapshots, versioning and financial calculations."""
from decimal import Decimal

IMPORTANT_CONTRACT_FIELDS = [
    'number', 'title', 'description', 'contractor_id', 'amount', 'currency', 'price_type',
    'status', 'start_date', 'end_date', 'signing_date', 'termination_date', 'payment_terms',
]


def _json_value(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return value


def contract_snapshot(contract):
    return {
        'number': contract.number,
        'title': contract.title,
        'description': contract.description,
        'contractorId': contract.contractor_id,
        'amount': _json_value(contract.amount),
        'currency': contract.currency,
        'priceType': contract.price_type,
        'status': contract.status,
        'startDate': _json_value(contract.start_date),
        'endDate': _json_value(contract.end_date),
        'signingDate': _json_value(contract.signing_date),
        'terminationDate': _json_value(contract.termination_date),
        'paymentTerms': contract.payment_terms,
    }


def hasImportantContractChanges(old_contract, new_contract):
    return any(
        getattr(old_contract, field) != getattr(new_contract, field)
        for field in IMPORTANT_CONTRACT_FIELDS
    )


def create_contract_version(contract, user=None, reason=''):
    from .models import ContractVersion

    next_number = (contract.versions.order_by('-version_number').values_list('version_number', flat=True).first() or 0) + 1
    contract.versions.update(is_current=False)
    version = ContractVersion.objects.create(
        contract=contract,
        version_number=next_number,
        snapshot=contract_snapshot(contract),
        change_reason=reason,
        created_by=user,
        is_current=True,
    )
    if contract.current_version != next_number:
        contract.current_version = next_number
        contract.save(update_fields=['current_version', 'updated_at'])
    return version


def getApprovedEstimates(estimates):
    return [estimate for estimate in estimates if estimate.status == 'approved']


def calculateApprovedEstimatesTotal(estimates):
    return sum((estimate.total_amount for estimate in getApprovedEstimates(estimates)), Decimal('0'))


def calculateContractPlannedAmount(contract, stages=None, estimates=None):
    if contract.price_type == 'fixed' and contract.amount is not None:
        return contract.amount
    if contract.price_type == 'estimate_based':
        return calculateApprovedEstimatesTotal(estimates or contract.estimates.all())
    if stages:
        values = [stage.planned_amount for stage in stages if stage.planned_amount is not None]
        if values:
            return sum(values, Decimal('0'))
    return None


def calculateContractActualAmount(contract, acts=None):
    acts = acts or contract.acts.all()
    return sum((act.amount for act in acts if act.status == 'signed'), Decimal('0'))


def calculateContractPaidAmount(contract, payments=None):
    payments = payments or contract.payments.all()
    return sum((payment.amount for payment in payments if payment.status == 'paid'), Decimal('0'))


def calculateContractDebt(contract, acts=None, payments=None):
    return calculateContractActualAmount(contract, acts) - calculateContractPaidAmount(contract, payments)

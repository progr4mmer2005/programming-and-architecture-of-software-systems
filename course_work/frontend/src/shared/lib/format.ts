import type {
  ApprovalRouteStage,
  Contract,
  Estimate,
  EstimateItem,
  PaginatedResponse,
  Payment,
  Act,
  ContractStage,
} from '@/shared/types/domain';

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

export function formatMoney(value: number | string | null | undefined, currency = 'RUB') {
  const amount = toNumber(value);
  if (amount === null) {
    return 'Не указано';
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency || 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number | string | null | undefined) {
  const amount = toNumber(value);
  return new Intl.NumberFormat('ru-RU').format(amount ?? 0);
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) {
    return 'Не указано';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ru-RU', withTime ? {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  } : {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeWindow(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return 'Срок не указан';
  }
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function calculateEstimateItemTotal(item: Pick<EstimateItem, 'quantity' | 'price'>) {
  return (toNumber(item.quantity) ?? 0) * (toNumber(item.price) ?? 0);
}

export function calculateEstimateTotal(items: Array<Pick<EstimateItem, 'quantity' | 'price' | 'total'>>) {
  return items.reduce((sum, item) => sum + (toNumber(item.total) ?? calculateEstimateItemTotal(item)), 0);
}

export function getApprovedEstimates(estimates: Estimate[]) {
  return estimates.filter((estimate) => estimate.status === 'approved');
}

export function calculateApprovedEstimatesTotal(estimates: Estimate[]) {
  return getApprovedEstimates(estimates).reduce((sum, estimate) => sum + (toNumber(estimate.total_amount ?? estimate.amount) ?? 0), 0);
}

export function formatContractPrice(contract: Contract, estimates: Estimate[] = []) {
  if (contract.price_type === 'free') {
    return 'Безвозмездный договор';
  }
  if (contract.price_type === 'not_specified') {
    return 'Стоимость не указана';
  }
  if (contract.price_type === 'fixed') {
    return contract.amount === null || contract.amount === undefined || contract.amount === ''
      ? 'Стоимость не заполнена'
      : formatMoney(contract.amount, contract.currency || 'RUB');
  }
  if (contract.price_type === 'estimate_based') {
    const approvedTotal = calculateApprovedEstimatesTotal(estimates);
    return approvedTotal > 0 ? formatMoney(approvedTotal, contract.currency || 'RUB') : 'Стоимость определяется сметами';
  }
  if (contract.price_type === 'by_rates') {
    return 'Стоимость определяется тарифами/актами/заявками';
  }
  return 'Стоимость не указана';
}

export function calculateStagePlannedAmount(stage: ContractStage, estimateItems: EstimateItem[] = []) {
  const linkedTotal = estimateItems
    .filter((item) => (item.stage ?? item.stage_id) === stage.id)
    .reduce((sum, item) => sum + (toNumber(item.total) ?? calculateEstimateItemTotal(item)), 0);
  return linkedTotal || toNumber(stage.planned_amount ?? stage.calculated_planned_amount) || null;
}

export function calculateStageActualAmount(stage: ContractStage, acts: Act[] = []) {
  const signedTotal = acts
    .filter((act) => act.stage === stage.id && act.status === 'signed')
    .reduce((sum, act) => sum + (toNumber(act.amount) ?? 0), 0);
  return signedTotal || toNumber(stage.actual_amount ?? stage.calculated_actual_amount) || null;
}

export function calculateContractPlannedAmount(contract: Contract, stages: ContractStage[] = [], estimates: Estimate[] = []) {
  if (contract.price_type === 'fixed' && contract.amount !== null && contract.amount !== undefined) {
    return toNumber(contract.amount);
  }
  if (contract.price_type === 'estimate_based') {
    return calculateApprovedEstimatesTotal(estimates) || null;
  }
  const stageTotal = stages.reduce((sum, stage) => sum + (toNumber(stage.planned_amount) ?? 0), 0);
  return stageTotal || null;
}

export function calculateContractActualAmount(_contract: Contract, acts: Act[] = []) {
  return acts.filter((act) => act.status === 'signed').reduce((sum, act) => sum + (toNumber(act.amount) ?? 0), 0);
}

export function calculateContractPaidAmount(_contract: Contract, payments: Payment[] = []) {
  return payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (toNumber(payment.amount) ?? 0), 0);
}

export function calculateContractDebt(contract: Contract, acts: Act[] = [], payments: Payment[] = []) {
  return calculateContractActualAmount(contract, acts) - calculateContractPaidAmount(contract, payments);
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseVariables(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeVariables(values: string[] | undefined) {
  return (values ?? []).join(', ');
}

export function getResults<T>(payload: PaginatedResponse<T> | T[] | undefined): T[] {
  if (!payload) {
    return [];
  }
  return Array.isArray(payload) ? payload : payload.results;
}

export function summarizeStages(stages: ApprovalRouteStage[] | undefined) {
  if (!stages?.length) {
    return 'Этапы не заданы';
  }
  return stages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((stage) => `${stage.order}. ${stage.name}`)
    .join(' • ');
}

export function buildStagePreview(stages: ApprovalRouteStage[]) {
  return stages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({
      ...stage,
      key: `${stage.order}-${stage.role}-${stage.name}`,
    }));
}

export function toCsvValue(value: unknown) {
  const stringValue = String(value ?? '');
  if (/[",;\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [
    headers.map(toCsvValue).join(';'),
    ...rows.map((row) => row.map(toCsvValue).join(';')),
  ].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

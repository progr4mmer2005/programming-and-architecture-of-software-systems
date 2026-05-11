export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  full_name: string;
  role: UserRole;
  organization: number | null;
  phone?: string;
  position?: string;
  avatar?: string | null;
  is_active?: boolean;
  date_joined?: string;
}

export interface Organization {
  id: number;
  name: string;
  legal_name?: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
  logo?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  members_count?: number;
  contracts_count?: number;
  contractors_count?: number;
}

export interface OrganizationStats {
  members_count: number;
  contracts_count: number;
  contractors_count: number;
}

export interface Contractor {
  id: number;
  organization?: number | null;
  linked_organization?: number | null;
  linked_organization_name?: string;
  source_organization_name?: string;
  linked_organizations_count?: number;
  is_linked_to_current_organization?: boolean;
  name: string;
  full_name?: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContractTemplate {
  id: number;
  organization: number;
  name: string;
  description?: string;
  document?: string | null;
  document_name?: string;
  has_document?: boolean;
  is_active: boolean;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'owner' | 'director' | 'manager' | 'approver' | 'admin';
export type ContractPriceType = 'fixed' | 'estimate_based' | 'free' | 'not_specified' | 'by_rates';
export type ContractStatus = 'draft' | 'on_approval' | 'ready_to_sign' | 'signed' | 'active' | 'completed' | 'terminated';
export type EstimateStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'archived';
export type StageStatus = 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
export type ActStatus = 'draft' | 'signed' | 'rejected' | 'cancelled';
export type PaymentType = 'planned' | 'actual';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type FileEntityType = 'contract' | 'estimate' | 'stage' | 'act' | 'payment';
export type FileCategory = 'draft' | 'final' | 'signed' | 'scan' | 'appendix' | 'source' | 'export' | 'invoice' | 'act' | 'other';

export interface Contract {
  id: number;
  organization?: number;
  title: string;
  number: string;
  status: ContractStatus;
  status_display?: string;
  contractor: number | null;
  contractor_name?: string;
  amount: number | string | null;
  currency: string | null;
  price_type: ContractPriceType;
  start_date?: string | null;
  end_date?: string | null;
  signing_date?: string | null;
  termination_date?: string | null;
  payment_terms?: string;
  description?: string;
  current_version: number;
  template?: number | null;
  created_by?: number | null;
  created_by_name?: string;
  responsible?: number | null;
  versions_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ContractVersion {
  id: number;
  contract: number;
  version_number: number;
  snapshot: Record<string, unknown>;
  change_reason?: string;
  created_by?: number | null;
  created_by_name?: string;
  created_at?: string;
  is_current: boolean;
}

export interface ContractAttachment {
  id: number;
  contract: number;
  contract_title?: string;
  title: string;
  document_type: string;
  document_type_display?: string;
  file: string;
  description?: string;
  uploaded_by?: number | null;
  uploaded_by_name?: string;
  created_at?: string;
}

export interface FileAttachment {
  id: number;
  organization: number;
  entity_type: FileEntityType;
  entity_id: number;
  category: FileCategory;
  category_display?: string;
  file: string;
  file_name: string;
  file_url?: string;
  mime_type?: string;
  size?: number;
  uploaded_by?: number | null;
  uploaded_by_name?: string;
  uploaded_at?: string;
}

export interface ContractStage {
  id: number;
  contract: number;
  name: string;
  description?: string;
  order: number;
  status: StageStatus;
  status_display?: string;
  planned_amount?: number | string | null;
  actual_amount?: number | string | null;
  amount?: number | string | null;
  calculated_planned_amount?: number | string | null;
  calculated_actual_amount?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  responsible_user?: number | null;
  responsible_user_name?: string;
  is_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EstimateItem {
  id: number;
  estimate: number;
  stage?: number | null;
  stage_id?: number | null;
  stage_name?: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number | string;
  price: number | string;
  total: number | string;
  sort_order: number;
}

export interface Estimate {
  id: number;
  organization: number;
  contract: number;
  contract_title?: string;
  title: string;
  number: string;
  status: EstimateStatus;
  status_display?: string;
  total_amount: number | string;
  amount?: number | string;
  currency: string;
  current_version: number;
  description?: string;
  items?: EstimateItem[];
  items_count?: number;
  approved_at?: string | null;
  created_by?: number | null;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EstimateVersion {
  id: number;
  estimate: number;
  version_number: number;
  snapshot: Record<string, unknown>;
  change_reason?: string;
  created_by?: number | null;
  created_by_name?: string;
  created_at?: string;
  is_current: boolean;
}

export interface Act {
  id: number;
  contract: number;
  contract_title?: string;
  stage?: number | null;
  stage_name?: string;
  number: string;
  title: string;
  date: string;
  amount: number | string;
  status: ActStatus;
  status_display?: string;
  description?: string;
  created_by?: number | null;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: number;
  contract: number;
  contract_title?: string;
  stage?: number | null;
  stage_name?: string;
  act?: number | null;
  act_title?: string;
  type: PaymentType;
  type_display?: string;
  amount: number | string;
  planned_date?: string | null;
  paid_date?: string | null;
  actual_date?: string | null;
  status: PaymentStatus;
  status_display?: string;
  description?: string;
  created_by?: number | null;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentCalendar {
  id: number;
  organization: number;
  month: string;
  total_planned: number | string;
  total_actual: number | string;
  debt: number | string;
  updated_at?: string;
}

export interface ApprovalRouteStage {
  role: string;
  order: number;
  name: string;
}

export interface ApprovalRoute {
  id: number;
  organization: number;
  name: string;
  stages: ApprovalRouteStage[];
  is_active: boolean;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalTask {
  id: number;
  contract: number;
  contract_title?: string;
  route?: number | null;
  route_name?: string;
  stage_order: number;
  role: string;
  assigned_to?: number | null;
  assigned_to_name?: string;
  status: string;
  status_display?: string;
  comment?: string;
  deadline?: string | null;
  assigned_at?: string;
  completed_at?: string | null;
}

export interface Comment {
  id: number;
  organization: number;
  contract: number;
  author: number;
  author_name?: string;
  author_role?: string;
  text: string;
  is_internal: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: number;
  organization: number;
  user?: number | null;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: number;
  changes: Record<string, unknown>;
  description?: string;
  ip_address?: string | null;
  created_at?: string;
}

export interface ReferenceEntry {
  id: number;
  organization: number;
  category: string;
  category_display?: string;
  code: string;
  label: string;
  description?: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardAlert {
  kind: string;
  level: string;
  title: string;
  subtitle?: string;
  description: string;
  date?: string;
  amount?: number;
  contract_id?: number;
}

export interface ExecutionReportItem {
  id: number;
  number: string;
  title: string;
  contractor: string;
  status: string;
  amount: number;
  planned_payments: number;
  actual_payments: number;
  debt: number;
  stages_total: number;
  stages_completed: number;
  next_deadline?: string | null;
}

export interface CalendarEvent {
  id: string;
  kind: 'payment' | 'contract' | 'stage' | 'approval';
  tone: string;
  date: string;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  stage_order?: number;
  contract_id?: number;
}

export interface CalendarEventsResponse {
  date_from: string;
  date_to: string;
  counts: Record<string, number>;
  events: CalendarEvent[];
}

export const roleOptions = [
  { value: 'owner', label: 'Владелец' },
  { value: 'director', label: 'Руководитель' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'approver', label: 'Согласующее лицо' },
  { value: 'admin', label: 'Администратор' },
];

export const contractStatusOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'on_approval', label: 'На согласовании' },
  { value: 'ready_to_sign', label: 'Готов к подписанию' },
  { value: 'signed', label: 'Подписан' },
  { value: 'active', label: 'Действует' },
  { value: 'completed', label: 'Завершён' },
  { value: 'terminated', label: 'Расторгнут' },
] as const;

export const priceTypeOptions = [
  { value: 'fixed', label: 'Фиксированная стоимость' },
  { value: 'estimate_based', label: 'По утверждённым сметам' },
  { value: 'free', label: 'Безвозмездно' },
  { value: 'not_specified', label: 'Стоимость не указана' },
  { value: 'by_rates', label: 'По тарифам/актам/заявкам' },
] as const;

export const estimateStatusOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'under_review', label: 'На проверке' },
  { value: 'approved', label: 'Утверждена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'archived', label: 'Архив' },
] as const;

export const stageStatusOptions = [
  { value: 'planned', label: 'Запланирован' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'delayed', label: 'Задержан' },
  { value: 'cancelled', label: 'Отменён' },
] as const;

export const actStatusOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'signed', label: 'Подписан' },
  { value: 'rejected', label: 'Отклонён' },
  { value: 'cancelled', label: 'Отменён' },
] as const;

export const paymentTypeOptions = [
  { value: 'planned', label: 'Плановый' },
  { value: 'actual', label: 'Фактический' },
] as const;

export const paymentStatusOptions = [
  { value: 'pending', label: 'Ожидается' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'overdue', label: 'Просрочен' },
  { value: 'cancelled', label: 'Отменён' },
] as const;

export const fileCategoryOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'final', label: 'Финальная версия' },
  { value: 'signed', label: 'Подписанный документ' },
  { value: 'scan', label: 'Скан' },
  { value: 'appendix', label: 'Приложение' },
  { value: 'source', label: 'Исходный файл' },
  { value: 'export', label: 'Экспорт' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'act', label: 'Акт' },
  { value: 'other', label: 'Другое' },
] as const;

export const approvalStatusOptions = [
  { value: 'waiting', label: 'Ожидает очереди' },
  { value: 'pending', label: 'Ожидает' },
  { value: 'approved', label: 'Согласован' },
  { value: 'rejected', label: 'Отклонён' },
  { value: 'skipped', label: 'Пропущен' },
];

export function getListResults<T>(payload: PaginatedResponse<T> | T[] | undefined): T[] {
  if (!payload) {
    return [];
  }
  return Array.isArray(payload) ? payload : payload.results;
}

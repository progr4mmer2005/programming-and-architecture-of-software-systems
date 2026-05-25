import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Download, FileText, Pencil, Plus, Receipt, Save, Trash2 } from 'lucide-react';
import apiClient from '@/api/client';
import { calculateEstimateItemTotal, calculateEstimateTotal, formatDate, formatMoney, getResults, prettyJson } from '@/shared/lib/format';
import type { ContractStage, Estimate, EstimateItem, EstimateStatus, EstimateVersion, FileAttachment, FileCategory, PaginatedResponse } from '@/shared/types/domain';
import { estimateStatusOptions, fileCategoryOptions } from '@/shared/types/domain';
import { Badge, Button, DataTable, EmptyState, Field, Input, LoadingBlock, Modal, PageIntro, SectionCard, Select, StatCard, Textarea } from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';

interface EstimateFormState { title: string; number: string; status: EstimateStatus; currency: string; }
interface ItemFormState { name: string; description: string; unit: string; quantity: string; price: string; stage: string; sort_order: string; }
interface FileFormState { category: FileCategory; file: File | null; }

const emptyItem: ItemFormState = { name: '', description: '', unit: 'шт.', quantity: '1', price: '0', stage: '', sort_order: '1' };
const emptyFile: FileFormState = { category: 'source', file: null };

function tone(status: string) { if (status === 'approved') return 'success'; if (status === 'under_review') return 'accent'; if (status === 'rejected') return 'danger'; return 'neutral'; }

export default function EstimateDetailsPage() {
  const { id } = useParams();
  const estimateId = Number(id);
  const enabled = Number.isFinite(estimateId);
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.permissions);
  const canManage = Boolean(permissions?.can_manage_estimates);
  const [form, setForm] = useState<EstimateFormState | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItem);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstimateItem | null>(null);
  const [itemStepIndex, setItemStepIndex] = useState(0);
  const [itemError, setItemError] = useState('');
  const [fileForm, setFileForm] = useState<FileFormState>(emptyFile);

  const { data: estimate, isLoading } = useQuery<Estimate>({
    queryKey: ['estimate', estimateId],
    queryFn: () => apiClient.get(`/estimates/${estimateId}/`).then((response) => response.data),
    enabled,
  });
  const { data: versionsPayload } = useQuery<PaginatedResponse<EstimateVersion>>({ queryKey: ['estimate', estimateId, 'versions'], queryFn: () => apiClient.get(`/estimates/${estimateId}/versions/`).then((response) => response.data), enabled });
  const { data: filesPayload } = useQuery<PaginatedResponse<FileAttachment>>({ queryKey: ['estimate', estimateId, 'files'], queryFn: () => apiClient.get('/file-attachments/', { params: { entity_type: 'estimate', entity_id: estimateId } }).then((response) => response.data), enabled });
  const { data: stagesPayload } = useQuery<PaginatedResponse<ContractStage>>({ queryKey: ['estimate', estimateId, 'stages', estimate?.contract], queryFn: () => apiClient.get('/stages/', { params: { contract: estimate?.contract } }).then((response) => response.data), enabled: Boolean(estimate?.contract) });

  const currentForm = form ?? (estimate ? { title: estimate.title, number: estimate.number || '', status: estimate.status, currency: estimate.currency || 'RUB' } : null);
  const items = estimate?.items ?? [];
  const versions = getResults(versionsPayload);
  const files = getResults(filesPayload);
  const stages = getResults(stagesPayload);
  const calculatedTotal = calculateEstimateTotal(items);

  const itemSteps = [
    { key: 'main', label: 'Основное' },
    { key: 'params', label: 'Параметры' },
    { key: 'review', label: 'Проверка' },
  ] as const;
  const activeItemStep = itemSteps[itemStepIndex];
  const itemMainValid = itemForm.name.trim().length > 0;
  const itemParamsValid = Number(itemForm.quantity || 0) > 0;

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemForm(emptyItem);
    setItemStepIndex(0);
    setItemError('');
  };
  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({ ...emptyItem, sort_order: String((items?.length || 0) + 1) });
    setItemStepIndex(0);
    setItemError('');
    setIsItemModalOpen(true);
  };
  const openEditItem = (item: EstimateItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      description: item.description || '',
      unit: item.unit || 'шт.',
      quantity: String(item.quantity ?? '1'),
      price: String(item.price ?? '0'),
      stage: item.stage ? String(item.stage) : '',
      sort_order: String(item.sort_order ?? 1),
    });
    setItemStepIndex(0);
    setItemError('');
    setIsItemModalOpen(true);
  };

  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] }); await queryClient.invalidateQueries({ queryKey: ['estimates'] }); await queryClient.invalidateQueries({ queryKey: ['estimate', estimateId, 'versions'] }); };
  const saveMutation = useMutation({ mutationFn: () => apiClient.patch(`/estimates/${estimateId}/`, currentForm), onSuccess: invalidate });
  const saveItemMutation = useMutation({
    mutationFn: () => {
      const payload = {
        estimate: estimateId,
        name: itemForm.name,
        description: itemForm.description,
        unit: itemForm.unit,
        quantity: Number(itemForm.quantity || 0),
        price: Number(itemForm.price || 0),
        stage: itemForm.stage ? Number(itemForm.stage) : null,
        sort_order: Number(itemForm.sort_order || 1),
      };
      return editingItem ? apiClient.patch(`/estimate-items/${editingItem.id}/`, payload) : apiClient.post('/estimate-items/', payload);
    },
    onSuccess: async () => {
      closeItemModal();
      await invalidate();
    },
    onError: () => setItemError('Не удалось сохранить позицию сметы. Проверьте заполнение полей.'),
  });
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => apiClient.delete(`/estimate-items/${itemId}/`),
    onSuccess: async () => {
      closeItemModal();
      await invalidate();
    },
    onError: () => setItemError('Не удалось удалить позицию сметы.'),
  });
  const fileMutation = useMutation({ mutationFn: async () => { if (!fileForm.file) throw new Error('file-required'); const payload = new FormData(); payload.append('entity_type', 'estimate'); payload.append('entity_id', String(estimateId)); payload.append('category', fileForm.category); payload.append('file', fileForm.file); return apiClient.post('/file-attachments/', payload); }, onSuccess: async () => { setFileForm(emptyFile); await queryClient.invalidateQueries({ queryKey: ['estimate', estimateId, 'files'] }); } });

  if (isLoading || !estimate || !currentForm) return <LoadingBlock label="Открываем смету..." />;

  return <div className="space-y-6">
    <PageIntro eyebrow="Смета" title={estimate.title} actions={canManage ? <Button onClick={() => saveMutation.mutate()} busy={saveMutation.isPending}><Save className="h-4 w-4" />Сохранить</Button> : undefined} />
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Итог" value={formatMoney(estimate.total_amount, estimate.currency)} hint={`Расчёт по позициям: ${formatMoney(calculatedTotal, estimate.currency)}`} tone="accent" icon={<Receipt className="h-5 w-5" />} />
      <StatCard label="Позиций" value={items.length} hint={estimate.number || 'Без номера'} tone="brand" icon={<FileText className="h-5 w-5" />} />
      <StatCard label="Статус" value={estimateStatusOptions.find((item) => item.value === estimate.status)?.label || estimate.status} hint={estimate.approved_at ? formatDate(estimate.approved_at) : 'Не утверждена'} tone="neutral" icon={<Receipt className="h-5 w-5" />} />
    </div>

    <SectionCard title="Основная информация"><fieldset disabled={!canManage} className="grid gap-4 md:grid-cols-2"><Field label="Название"><Input value={currentForm.title} onChange={(event) => setForm((current) => ({ ...(current ?? currentForm), title: event.target.value }))} /></Field><Field label="Номер"><Input value={currentForm.number} onChange={(event) => setForm((current) => ({ ...(current ?? currentForm), number: event.target.value }))} /></Field><Field label="Статус"><Select value={currentForm.status} onChange={(event) => setForm((current) => ({ ...(current ?? currentForm), status: event.target.value as EstimateStatus }))}>{estimateStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Валюта"><Input value={currentForm.currency} onChange={(event) => setForm((current) => ({ ...(current ?? currentForm), currency: event.target.value }))} /></Field></fieldset></SectionCard>

    <SectionCard title="Позиции сметы" action={canManage ? <Button onClick={openCreateItem}><Plus className="h-4 w-4" />Добавить позицию</Button> : undefined}>
      {items.length ? <DataTable columns={canManage ? ['Позиция', 'Этап', 'Количество', 'Цена', 'Итого', 'Действия'] : ['Позиция', 'Этап', 'Количество', 'Цена', 'Итого']}>{items.map((item) => <tr key={item.id} className="border-b border-[var(--line)] last:border-none"><td className="px-4 py-4"><p className="font-semibold text-[var(--foreground)]">{item.name}</p><p className="text-sm text-[var(--muted-foreground)]">{item.description || 'Без описания'}</p></td><td className="px-4 py-4 text-[var(--muted-foreground)]">{item.stage_name || 'Без этапа'}</td><td className="px-4 py-4 text-[var(--muted-foreground)]">{item.quantity} {item.unit}</td><td className="px-4 py-4 text-[var(--muted-foreground)]">{formatMoney(item.price, estimate.currency)}</td><td className="px-4 py-4 font-semibold text-[var(--foreground)]">{formatMoney(item.total || calculateEstimateItemTotal(item), estimate.currency)}</td>{canManage ? <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button variant="secondary" className="px-3 py-2" onClick={() => openEditItem(item)}><Pencil className="h-4 w-4" />Изменить</Button><Button variant="danger" className="px-3 py-2" onClick={() => deleteItemMutation.mutate(item.id)} busy={deleteItemMutation.isPending}><Trash2 className="h-4 w-4" />Удалить</Button></div></td> : null}</tr>)}</DataTable> : <EmptyState title="Позиции отсутствуют" />}
    </SectionCard>

    <Modal open={isItemModalOpen} onClose={closeItemModal} title={editingItem ? 'Редактирование позиции сметы' : 'Новая позиция сметы'} description="Заполните шаги и проверьте данные перед сохранением." size="xl">
      <div className="space-y-4">
        {itemError ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{itemError}</div> : null}
        <div className="flex flex-wrap gap-2">
          {itemSteps.map((step, idx) => (
            <button key={step.key} type="button" onClick={() => setItemStepIndex(idx)} className={`rounded-full border px-3 py-1.5 text-xs ${idx === itemStepIndex ? 'border-[var(--brand)] bg-[rgba(31,77,61,0.08)] text-[var(--brand)]' : 'border-[var(--line)] bg-white text-[var(--muted-foreground)]'}`}>
              {idx + 1}. {step.label}
            </button>
          ))}
        </div>

        {activeItemStep.key === 'main' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Наименование"><Input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Этап"><Select value={itemForm.stage} onChange={(event) => setItemForm((current) => ({ ...current, stage: event.target.value }))}><option value="">Без этапа</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select></Field>
            <div className="md:col-span-2"><Field label="Описание"><Textarea value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} /></Field></div>
          </div>
        ) : null}
        {activeItemStep.key === 'params' ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ед. изм."><Input value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} /></Field>
            <Field label="Количество"><Input type="number" value={itemForm.quantity} onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
            <Field label="Цена"><Input type="number" value={itemForm.price} onChange={(event) => setItemForm((current) => ({ ...current, price: event.target.value }))} /></Field>
            <Field label="Порядок"><Input type="number" value={itemForm.sort_order} onChange={(event) => setItemForm((current) => ({ ...current, sort_order: event.target.value }))} /></Field>
          </div>
        ) : null}
        {activeItemStep.key === 'review' ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted-foreground)]">
            <p><strong className="text-[var(--foreground)]">Позиция:</strong> {itemForm.name || 'Не заполнено'}</p>
            <p><strong className="text-[var(--foreground)]">Этап:</strong> {stages.find((s) => String(s.id) === itemForm.stage)?.name || 'Без этапа'}</p>
            <p><strong className="text-[var(--foreground)]">Количество:</strong> {itemForm.quantity || '0'} {itemForm.unit || ''}</p>
            <p><strong className="text-[var(--foreground)]">Цена:</strong> {formatMoney(Number(itemForm.price || 0), estimate.currency)}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={closeItemModal}>Отмена</Button>
          {itemStepIndex > 0 ? <Button variant="secondary" onClick={() => setItemStepIndex((s) => s - 1)}>Назад</Button> : null}
          {itemStepIndex < itemSteps.length - 1 ? (
            <Button onClick={() => setItemStepIndex((s) => s + 1)} disabled={(activeItemStep.key === 'main' && !itemMainValid) || (activeItemStep.key === 'params' && !itemParamsValid)}>
              Далее
            </Button>
          ) : (
            <Button onClick={() => saveItemMutation.mutate()} busy={saveItemMutation.isPending} disabled={!itemMainValid || !itemParamsValid}>
              Сохранить позицию
            </Button>
          )}
        </div>
      </div>
    </Modal>

    <SectionCard title="Файлы сметы" action={canManage ? <Button onClick={() => fileMutation.mutate()} busy={fileMutation.isPending} disabled={!fileForm.file}>Прикрепить файл</Button> : undefined}>
      {canManage ? <div className="mb-5 grid gap-4 md:grid-cols-[0.7fr_1.3fr]"><Field label="Категория"><Select value={fileForm.category} onChange={(event) => setFileForm((current) => ({ ...current, category: event.target.value as FileCategory }))}>{fileCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Файл"><Input type="file" onChange={(event) => setFileForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} /></Field></div> : null}
      {files.length ? <div className="grid gap-3 xl:grid-cols-2">{files.map((file) => <div key={file.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"><Badge tone="neutral">{file.category_display || file.category}</Badge><p className="mt-3 font-semibold text-[var(--foreground)]">{file.file_name}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatDate(file.uploaded_at, true)}</p><div className="mt-4 flex flex-wrap gap-3"><a href={file.file_url || file.file} download={file.file_name} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--line-strong)] hover:bg-white"><Download className="h-4 w-4" />Скачать</a>{canManage ? <Button variant="ghost" onClick={async () => { if (confirm('Удалить файл?')) { await apiClient.delete(`/file-attachments/${file.id}/`); await queryClient.invalidateQueries({ queryKey: ['estimate', estimateId, 'files'] }); } }}><Trash2 className="h-4 w-4" />Удалить</Button> : null}</div></div>)}</div> : <EmptyState title="Файлы отсутствуют" />}
    </SectionCard>

    <SectionCard title="История версий"><div className="space-y-3">{versions.length ? versions.map((version) => <details key={version.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"><summary className="cursor-pointer font-semibold text-[var(--foreground)]">v{version.version_number} {version.is_current ? '· текущая' : ''}</summary><p className="mt-2 text-xs text-[var(--muted-foreground)]">{version.created_by_name || 'Система'} • {formatDate(version.created_at, true)}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">{version.change_reason || 'Причина не указана'}</p><pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-[var(--muted)] p-4 text-xs">{prettyJson(version.snapshot)}</pre></details>) : <EmptyState title="Версии отсутствуют" />}</div></SectionCard>

    <Link className="inline-flex text-sm font-semibold text-[var(--brand)]" to={`/contracts/${estimate.contract}`}>Вернуться к договору</Link>
  </div>;
}

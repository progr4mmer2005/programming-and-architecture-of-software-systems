import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Plus, Trash2, Upload } from 'lucide-react';

import apiClient from '@/api/client';
import { formatDate, formatNumber, getResults } from '@/shared/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { ContractTemplate, FileAttachment, PaginatedResponse } from '@/shared/types/domain';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageIntro,
  SectionCard,
  Select,
  StatCard,
  Textarea,
} from '@/shared/components/ui';

interface TemplateFormState {
  name: string;
  description: string;
  is_active: boolean;
}

const initialState: TemplateFormState = {
  name: '',
  description: '',
  is_active: true,
};

const steps = ['Основное', 'Статус', 'Проверка'] as const;

function fileSize(size?: number) {
  if (!size) return 'Размер не указан';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.permissions);
  const canManageTemplates = Boolean(permissions?.can_manage_templates);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(initialState);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const { data: payload } = useQuery<PaginatedResponse<ContractTemplate>>({
    queryKey: ['templates', search],
    queryFn: () => apiClient.get('/templates/', { params: { search: search || undefined } }).then((response) => response.data),
  });

  const templates = getResults(payload);

  const openCreate = () => {
    if (!canManageTemplates) return;
    setEditing(null);
    setForm(initialState);
    setError('');
    setStepIndex(0);
    setIsModalOpen(true);
  };

  const openEdit = (template: ContractTemplate) => {
    if (!canManageTemplates) return;
    setEditing(template);
    setForm({
      name: template.name,
      description: template.description || '',
      is_active: template.is_active,
    });
    setError('');
    setStepIndex(0);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(initialState);
    setError('');
    setStepIndex(0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('description', form.description);
      payload.append('is_active', String(form.is_active));
      return editing
        ? apiClient.patch(`/templates/${editing.id}/`, payload)
        : apiClient.post('/templates/', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
    onError: () => setError('Не удалось сохранить шаблон.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/templates/${id}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Шаблоны"
        title="Архив шаблонов договоров"
        description="Здесь хранятся готовые шаблоны с прикреплёнными файлами любых форматов."
        actions={canManageTemplates ? (
          <Button onClick={openCreate} className="rounded-2xl px-5 py-3"><Plus className="h-4 w-4" />Добавить шаблон</Button>
        ) : undefined}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Всего" value={formatNumber(templates.length)} hint="Карточек в архиве" tone="brand" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Активные" value={formatNumber(templates.filter((item) => item.is_active).length)} hint="Используются сейчас" tone="neutral" icon={<Upload className="h-5 w-5" />} />
      </div>

      <SectionCard title="Поиск" description="По названию или краткому описанию.">
        <Field label="Поиск шаблона">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например: поставка" />
        </Field>
      </SectionCard>

      <SectionCard title="Шаблоны" description="Список доступных шаблонов.">
        {templates.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} canManage={canManageTemplates} onEdit={openEdit} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Шаблоны не найдены"
            description="После добавления первого шаблона здесь появится архив."
            action={canManageTemplates ? <Button onClick={openCreate}>Добавить шаблон</Button> : undefined}
          />
        )}
      </SectionCard>

      <Modal open={isModalOpen} onClose={closeModal} title={editing ? 'Редактирование шаблона' : 'Новый шаблон'} size="xl">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">{steps.map((step, idx) => <button type="button" key={step} onClick={() => setStepIndex(idx)} className={`rounded-full border px-3 py-1.5 text-sm ${stepIndex===idx?'border-[var(--brand)] bg-[rgba(31,77,61,0.1)] text-[var(--brand)]':'border-[var(--line)] bg-white/75 text-[var(--muted-foreground)]'}`}>{idx+1}. {step}</button>)}</div>
          {error ? (<div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>) : null}
          {stepIndex===0 ? <div className="grid gap-4"><Field label="Название шаблона"><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Описание"><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field></div> : null}
          {stepIndex===1 ? <Field label="Статус"><Select value={String(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}><option value="true">Активен</option><option value="false">Отключен</option></Select></Field> : null}
          {stepIndex===2 ? <div className="rounded-xl border border-[var(--line)] bg-white/80 p-4 text-sm space-y-1"><p><b>Название:</b> {form.name || 'Не заполнено'}</p><p><b>Статус:</b> {form.is_active ? 'Активен' : 'Отключен'}</p><p><b>Описание:</b> {form.description || 'Не заполнено'}</p></div> : null}
          <div className="flex flex-wrap justify-between gap-3">
            <div>{editing ? <Button variant="danger" onClick={() => deleteMutation.mutate(editing.id)} busy={deleteMutation.isPending}>Удалить шаблон</Button> : null}</div>
            <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={closeModal}>Отмена</Button>{stepIndex>0?<Button variant="secondary" onClick={()=>setStepIndex((s)=>s-1)}>Назад</Button>:null}{stepIndex<steps.length-1?<Button onClick={()=>{ if (!form.name.trim() && stepIndex===0){ setError('Введите название шаблона.'); return; } setError(''); setStepIndex((s)=>s+1); }}>Далее</Button>:<Button onClick={() => saveMutation.mutate()} busy={saveMutation.isPending}>Сохранить</Button>}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TemplateCard({ template, canManage, onEdit }: { template: ContractTemplate; canManage: boolean; onEdit: (t: ContractTemplate) => void }) {
  const queryClient = useQueryClient();
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: filesPayload } = useQuery<PaginatedResponse<FileAttachment>>({
    queryKey: ['template-files', template.id],
    queryFn: () => apiClient.get('/file-attachments/', { params: { entity_type: 'template', entity_id: template.id } }).then((response) => response.data),
  });

  const files = getResults(filesPayload);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('file-required');
      const payload = new FormData();
      payload.append('entity_type', 'template');
      payload.append('entity_id', String(template.id));
      payload.append('category', 'source');
      payload.append('file', uploadFile);
      return apiClient.post('/file-attachments/', payload);
    },
    onSuccess: async () => {
      setUploadFile(null);
      await queryClient.invalidateQueries({ queryKey: ['template-files', template.id] });
    },
  });

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={template.is_active ? 'success' : 'neutral'}>
              {template.is_active ? 'Активен' : 'Отключен'}
            </Badge>
          </div>
          <h3 className="mt-4 break-words text-lg font-semibold leading-8 text-[var(--foreground)]">{template.name}</h3>
          <p className="mt-2 break-words text-sm leading-7 text-[var(--muted-foreground)]">{template.description || 'Описание не заполнено.'}</p>
        </div>
        {canManage ? <Button variant="secondary" onClick={() => onEdit(template)}>Изменить</Button> : null}
      </div>

      {files.length ? (
        <div className="mt-5 space-y-3">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">Файлы шаблона</h4>
          {files.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--line)] bg-white/80 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">{file.file_name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{fileSize(file.size)} • {formatDate(file.uploaded_at, true)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={file.file_url || file.file} download={file.file_name} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--line-strong)] hover:bg-white"><Download className="h-3.5 w-3.5" />Скачать</a>
                {canManage ? <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={async () => { if (confirm('Удалить файл?')) { await apiClient.delete(`/file-attachments/${file.id}/`); await queryClient.invalidateQueries({ queryKey: ['template-files', template.id] }); } }}><Trash2 className="h-3.5 w-3.5" />Удалить</Button> : null}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 text-sm text-[var(--muted-foreground)]">Файлы не прикреплены.</p>}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Прикрепить файл"><Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /></Field>
          <Button variant="secondary" onClick={() => uploadMutation.mutate()} busy={uploadMutation.isPending} disabled={!uploadFile}>Загрузить</Button>
        </div>
      ) : null}
    </div>
  );
}

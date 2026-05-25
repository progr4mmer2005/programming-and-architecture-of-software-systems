import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Button, Field, Input, PageIntro, SectionCard, Textarea } from '@/shared/components/ui';

interface OrganizationFormState {
  name: string;
  inn: string;
  legal_name: string;
  kpp: string;
  ogrn: string;
  address: string;
}

type StepId = 'basic' | 'legal' | 'address' | 'review';

interface StepDefinition {
  id: StepId;
  title: string;
  optional: boolean;
}

const steps: StepDefinition[] = [
  { id: 'basic', title: 'Основное', optional: false },
  { id: 'legal', title: 'Реквизиты', optional: true },
  { id: 'address', title: 'Адрес', optional: true },
  { id: 'review', title: 'Проверка', optional: false },
];

const initialForm: OrganizationFormState = {
  name: '',
  inn: '',
  legal_name: '',
  kpp: '',
  ogrn: '',
  address: '',
};

export default function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { fetchUser } = useAuthStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OrganizationFormState>(initialForm);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const step = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const createOrganization = useMutation({
    mutationFn: () => apiClient.post('/organizations/', { ...form, is_active: true }),
    onSuccess: async () => {
      setError('');
      setFieldErrors({});
      await fetchUser();
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
      navigate('/workspace');
    },
    onError: (err: unknown) => {
      const payload = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      if (!payload) {
        setError('Не удалось создать организацию. Проверьте данные формы.');
        return;
      }
      const nextErrors: Record<string, string> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (Array.isArray(value)) {
          nextErrors[key] = value[0] || 'Ошибка поля';
        } else {
          nextErrors[key] = value;
        }
      }
      setFieldErrors(nextErrors);
      setError('Форма содержит ошибки. Проверьте поля ниже.');
    },
  });

  const canSkip = step.optional && !isLastStep;

  const summary = useMemo(
    () => [
      { label: 'Название', value: form.name || 'Не заполнено' },
      { label: 'ИНН', value: form.inn || 'Не заполнено' },
      { label: 'Юридическое название', value: form.legal_name || 'Пропущено' },
      { label: 'КПП', value: form.kpp || 'Пропущено' },
      { label: 'ОГРН', value: form.ogrn || 'Пропущено' },
      { label: 'Адрес', value: form.address || 'Пропущено' },
    ],
    [form],
  );

  const goToStep = (index: number) => {
    setError('');
    setStepIndex(index);
  };

  const validateCurrentStep = () => {
    const nextFieldErrors: Record<string, string> = {};
    if (step.id === 'basic') {
      if (!form.name.trim()) nextFieldErrors.name = 'Введите название организации.';
      if (!form.inn.trim()) nextFieldErrors.inn = 'Введите ИНН.';
      if (form.inn.trim().length > 12) nextFieldErrors.inn = 'ИНН не должен превышать 12 символов.';
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError('Заполните обязательные поля текущего шага.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleSkip = () => {
    setError('');
    setFieldErrors({});
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Новая организация"
        title="Официальная форма создания"
        actions={<Badge tone="brand">После создания вы станете Главным админом</Badge>}
      />

      <SectionCard title="Хлебные крошки шага">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((item, index) => {
            const isActive = index === stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToStep(index)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${isActive ? 'border-[var(--brand)] bg-[rgba(31,77,61,0.1)] text-[var(--brand)]' : 'border-[var(--line)] bg-white text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                {index + 1}. {item.title}{item.optional ? ' (опционально)' : ''}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <SectionCard title={`Шаг ${stepIndex + 1}. ${step.title}`}>
        {step.id === 'basic' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название организации *">
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              {fieldErrors.name ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.name}</p> : null}
            </Field>
            <Field label="ИНН *">
              <Input value={form.inn} onChange={(event) => setForm((prev) => ({ ...prev, inn: event.target.value }))} />
              {fieldErrors.inn ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.inn}</p> : null}
            </Field>
          </div>
        ) : null}

        {step.id === 'legal' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Юридическое название">
              <Input value={form.legal_name} onChange={(event) => setForm((prev) => ({ ...prev, legal_name: event.target.value }))} />
              {fieldErrors.legal_name ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.legal_name}</p> : null}
            </Field>
            <Field label="КПП">
              <Input value={form.kpp} onChange={(event) => setForm((prev) => ({ ...prev, kpp: event.target.value }))} />
              {fieldErrors.kpp ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.kpp}</p> : null}
            </Field>
            <Field label="ОГРН">
              <Input value={form.ogrn} onChange={(event) => setForm((prev) => ({ ...prev, ogrn: event.target.value }))} />
              {fieldErrors.ogrn ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.ogrn}</p> : null}
            </Field>
          </div>
        ) : null}

        {step.id === 'address' ? (
          <Field label="Юридический адрес">
            <Textarea value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
            {fieldErrors.address ? <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.address}</p> : null}
          </Field>
        ) : null}

        {step.id === 'review' ? (
          <div className="space-y-3">
            {summary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{item.label}</p>
                <p className="mt-2 text-sm text-[var(--foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/workspace')}>Отмена</Button>
            {!isFirstStep ? (
              <Button variant="secondary" onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}>
                Назад
              </Button>
            ) : null}
          </div>

          <div className="flex gap-2">
            {canSkip ? (
              <Button variant="ghost" onClick={handleSkip}>
                Пропустить шаг
              </Button>
            ) : null}

            {!isLastStep ? (
              <Button onClick={handleNext}>Далее</Button>
            ) : (
              <Button busy={createOrganization.isPending} onClick={() => createOrganization.mutate()}>
                Создать организацию
              </Button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

import apiClient from '@/api/client';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import type { CalendarEvent, CalendarEventsResponse } from '@/shared/types/domain';
import {
  Badge,
  Button,
  EmptyState,
  LoadingBlock,
  PageIntro,
  SectionCard,
  StatCard,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

type CalendarKind = 'payment' | 'contract' | 'stage' | 'approval';

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const kindLabels: Record<CalendarKind, string> = {
  payment: 'Платежи',
  contract: 'Договоры',
  stage: 'Этапы',
  approval: 'Согласование',
};

const emptyCounts: Record<CalendarKind, number> = {
  payment: 0,
  contract: 0,
  stage: 0,
  approval: 0,
};

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfWeekMonday(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeekSunday(value: Date) {
  const date = startOfWeekMonday(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isSameDate(left: Date, right: Date) {
  return toIsoDate(left) === toIsoDate(right);
}


function monthLabel(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function shortDayLabel(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(value);
}

function eventToneToBadge(tone: string): 'brand' | 'accent' | 'danger' | 'success' | 'neutral' {
  if (tone === 'danger') {
    return 'danger';
  }
  if (tone === 'brand') {
    return 'brand';
  }
  if (tone === 'success') {
    return 'success';
  }
  if (tone === 'warning' || tone === 'accent') {
    return 'accent';
  }
  return 'neutral';
}

function eventIcon(kind: CalendarKind) {
  if (kind === 'payment') {
    return <WalletCards className="h-4 w-4" />;
  }
  if (kind === 'approval') {
    return <ShieldCheck className="h-4 w-4" />;
  }
  if (kind === 'stage') {
    return <Clock3 className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

function eventSecondaryLine(event: CalendarEvent) {
  if (typeof event.amount === 'number') {
    return formatMoney(event.amount);
  }
  if (event.stage_order) {
    return `Этап ${event.stage_order}`;
  }
  return event.subtitle || '';
}

function eventDayBadge(event: CalendarEvent) {
  if (event.kind === 'payment') {
    return 'Платеж';
  }
  if (event.kind === 'approval') {
    return 'Согласование';
  }
  if (event.kind === 'stage') {
    return 'Этап';
  }
  return 'Договор';
}

export default function CalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

  const moveToMonth = (nextMonth: Date) => {
    const normalizedMonth = startOfMonth(nextMonth);
    const today = new Date();
    setMonthCursor(normalizedMonth);
    setSelectedDate(
      normalizedMonth.getFullYear() === today.getFullYear() && normalizedMonth.getMonth() === today.getMonth()
        ? toIsoDate(today)
        : toIsoDate(normalizedMonth),
    );
  };
  const [selectedKinds, setSelectedKinds] = useState<Record<CalendarKind, boolean>>({
    payment: true,
    contract: true,
    stage: true,
    approval: true,
  });
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const visibleStart = startOfWeekMonday(monthStart);
  const visibleEnd = endOfWeekSunday(monthEnd);
  const visibleStartIso = toIsoDate(visibleStart);
  const visibleEndIso = toIsoDate(visibleEnd);
  const monthStartIso = toIsoDate(monthStart);
  const monthEndIso = toIsoDate(monthEnd);

  const enabledKinds = (Object.entries(selectedKinds) as Array<[CalendarKind, boolean]>)
    .filter(([, enabled]) => enabled)
    .map(([kind]) => kind);


  const { data, isLoading } = useQuery<CalendarEventsResponse>({
    queryKey: ['calendar-events', visibleStartIso, visibleEndIso, enabledKinds.join(',')],
    enabled: enabledKinds.length > 0,
    queryFn: () => apiClient.get('/dashboard/calendar_events/', {
      params: {
        date_from: visibleStartIso,
        date_to: visibleEndIso,
        kinds: enabledKinds.join(','),
      },
    }).then((response) => response.data),
  });

  const events = useMemo(() => (enabledKinds.length > 0 ? (data?.events ?? []) : []), [enabledKinds.length, data?.events]);
  const counts = useMemo(
    () => (enabledKinds.length > 0 ? (data?.counts as Record<CalendarKind, number> | undefined) ?? emptyCounts : emptyCounts),
    [enabledKinds.length, data?.counts],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const items = map.get(event.date) ?? [];
      items.push(event);
      items.sort((left, right) => {
        const byKind = left.kind.localeCompare(right.kind);
        return byKind !== 0 ? byKind : left.title.localeCompare(right.title);
      });
      map.set(event.date, items);
    }
    return map;
  }, [events]);

  const dayCells = useMemo(() => {
    const days: Date[] = [];
    let cursor = new Date(`${visibleStartIso}T00:00:00`);
    const endDate = new Date(`${visibleEndIso}T00:00:00`);
    while (cursor <= endDate) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [visibleStartIso, visibleEndIso]);

  const selectedDayEvents = eventsByDate.get(selectedDate) ?? [];
  const monthEvents = events
    .filter((event) => event.date >= monthStartIso && event.date <= monthEndIso)
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) {
        return byDate;
      }
      const byKind = left.kind.localeCompare(right.kind);
      return byKind !== 0 ? byKind : left.title.localeCompare(right.title);
    });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Календарь событий"
        title="Единый календарный экран"
        description="На экране объединены платежи по дням, сроки договоров, этапы исполнения и задачи согласования. Месячная сетка и общая лента событий работают в одном разделе."
        actions={(
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                const today = new Date();
                moveToMonth(today);
              }}
            >
              Текущий месяц
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Платежи в периоде" value={formatNumber(counts.payment)} hint="Плановые и фактические события" tone="accent" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Сроки договоров" value={formatNumber(counts.contract)} hint="Начало и окончание договоров" tone="brand" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Этапы исполнения" value={formatNumber(counts.stage)} hint="Контроль по этапам работ" tone="neutral" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Согласование" value={formatNumber(counts.approval)} hint="Задачи и сроки согласования" tone="danger" icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <SectionCard
        title="Параметры календаря"
        description="Вы можете переключать месяцы и включать только нужные типы событий."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => moveToMonth(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
              Предыдущий
            </Button>
            <div className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
              {monthLabel(monthCursor)}
            </div>
            <Button variant="secondary" onClick={() => moveToMonth(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
              Следующий
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      >
        <div className="flex flex-wrap gap-3">
          {(Object.keys(kindLabels) as CalendarKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSelectedKinds((current) => ({ ...current, [kind]: !current[kind] }))}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                selectedKinds[kind]
                  ? 'border-[rgba(31,77,61,0.18)] bg-[rgba(31,77,61,0.08)] text-[var(--foreground)]'
                  : 'border-[var(--line)] bg-white/70 text-[var(--muted-foreground)]',
              )}
            >
              <Filter className="h-4 w-4" />
              {kindLabels[kind]}
              <Badge tone={selectedKinds[kind] ? 'brand' : 'neutral'}>{formatNumber(counts[kind])}</Badge>
            </button>
          ))}
        </div>
        {enabledKinds.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            Для отображения событий включите хотя бы один тип в фильтре.
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <SectionCard title="Месячная сетка" description="В ячейках месяца отображаются все события выбранных типов по дням.">
          {isLoading ? (
            <LoadingBlock label="Подготавливаем календарные события..." />
          ) : (
            <div className="px-1 pb-2">
              <div className="grid grid-cols-7 gap-2 xl:gap-3">
                {weekdayLabels.map((label) => (
                  <div key={label} className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {label}
                  </div>
                ))}
                {dayCells.map((day) => {
                  const iso = toIsoDate(day);
                  const dayEvents = eventsByDate.get(iso) ?? [];
                  const inCurrentMonth = day.getMonth() === monthCursor.getMonth();
                  const isToday = isSameDate(day, new Date());
                  const isSelected = iso === selectedDate;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      className={cn(
                        'flex min-h-[136px] flex-col rounded-[1.5rem] border p-2.5 text-left transition xl:min-h-[148px] xl:p-3',
                        inCurrentMonth ? 'bg-white/80' : 'bg-[rgba(245,239,232,0.62)]',
                        isSelected ? 'border-[var(--brand)] shadow-[0_16px_34px_rgba(31,77,61,0.12)] ring-2 ring-[rgba(31,77,61,0.1)]' : 'border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-white/90',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-base font-semibold', inCurrentMonth ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]')}>
                            {day.getDate()}
                          </span>
                          {isToday ? <Badge tone="brand">Сегодня</Badge> : null}
                        </div>
                        {dayEvents.length ? <Badge tone="neutral">{dayEvents.length}</Badge> : null}
                      </div>

                      <div className="mt-3 flex-1 overflow-hidden">
                        {dayEvents.slice(0, 1).map((event) => (
                          <div key={event.id} className="rounded-[1rem] border border-[var(--line)] bg-white/90 px-2.5 py-2 shadow-[0_6px_18px_rgba(22,18,14,0.04)]">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                              {eventIcon(event.kind)}
                              <span className="truncate">{eventDayBadge(event)}</span>
                            </div>
                            <p className="mt-1 break-words text-[13px] font-semibold leading-5 text-[var(--foreground)]">{event.title}</p>
                            <p className="truncate text-[11px] text-[var(--muted-foreground)]">{eventSecondaryLine(event)}</p>
                          </div>
                        ))}
                      </div>

                      {dayEvents.length > 1 ? (
                        <p className="mt-2 text-[11px] font-semibold text-[var(--brand)]">
                          Еще событий: {dayEvents.length - 1}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="События выбранного дня"
          description={selectedDate ? `Дата: ${formatDate(selectedDate)}` : 'Выберите дату в сетке месяца.'}
        >
          {isLoading ? (
            <LoadingBlock label="Получаем события выбранного дня..." />
          ) : selectedDayEvents.length ? (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={eventToneToBadge(event.tone)}>{kindLabels[event.kind]}</Badge>
                    {event.status ? <Badge tone="neutral">{event.status}</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{event.title}</p>
                  {event.subtitle ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.subtitle}</p> : null}
                  {eventSecondaryLine(event) && eventSecondaryLine(event) !== event.subtitle ? (
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">{eventSecondaryLine(event)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="События на дату не найдены" description="Для выбранного дня события выбранных типов не найдены." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Объединенная лента событий" description="Ниже собраны все события выбранного месяца в едином хронологическом списке.">
        {isLoading ? (
          <LoadingBlock label="Формируем ленту событий месяца..." />
        ) : monthEvents.length ? (
          <div className="space-y-3">
            {monthEvents.map((event) => (
              <div key={event.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={eventToneToBadge(event.tone)}>{kindLabels[event.kind]}</Badge>
                    <span className="text-xs text-[var(--muted-foreground)]">{shortDayLabel(new Date(event.date))}</span>
                    {event.status ? <Badge tone="neutral">{event.status}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{event.title}</p>
                  {event.subtitle ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.subtitle}</p> : null}
                </div>
                <div className="text-sm text-[var(--muted-foreground)] lg:text-right">
                  {typeof event.amount === 'number' ? <p className="font-semibold text-[var(--foreground)]">{formatMoney(event.amount)}</p> : null}
                  {event.stage_order ? <p>Этап {event.stage_order}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="В выбранном месяце события не найдены" description="Измените месяц или включите дополнительные типы событий в фильтре." />
        )}
      </SectionCard>

    </div>
  );
}


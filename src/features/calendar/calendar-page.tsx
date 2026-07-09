import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  PhoneCall,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';

import {
  buildLocalCalendarWorkspace,
  calendarWorkspaceQueryKey,
  fetchCalendarWorkspace,
  type CalendarEvent,
} from './calendar-queries';

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toneForKind(kind: CalendarEvent['kind']) {
  switch (kind) {
    case 'follow_up':
      return 'brand' as const;
    case 'billing':
      return 'warning' as const;
    case 'project_start':
      return 'brand' as const;
    case 'project_due':
      return 'warning' as const;
    case 'task':
      return 'neutral' as const;
  }
}

function labelForKind(kind: CalendarEvent['kind']) {
  switch (kind) {
    case 'follow_up':
      return 'Follow-up';
    case 'billing':
      return 'Financeiro';
    case 'project_start':
      return 'Inicio';
    case 'project_due':
      return 'Prazo';
    case 'task':
      return 'Tarefa';
  }
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function fullDateLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function weekdayLabels(baseDate: Date) {
  const start = startOfWeek(baseDate, { locale: ptBR });
  return Array.from({ length: 7 }, (_, index) =>
    addDays(start, index).toLocaleDateString('pt-BR', { weekday: 'short' }),
  );
}

export function CalendarPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => today);

  const calendarQuery = useQuery({
    queryKey: calendarWorkspaceQueryKey,
    queryFn: fetchCalendarWorkspace,
    enabled: hasRealSession,
  });

  const localWorkspace = useMemo(() => buildLocalCalendarWorkspace(), []);
  const workspace = hasRealSession ? (calendarQuery.data ?? { events: [] }) : localWorkspace;
  const kindFilter = searchParams.get('kind');
  const focusFilter = searchParams.get('focus');
  const filteredEvents = useMemo(
    () =>
      workspace.events.filter((event) => {
        if (kindFilter && event.kind !== kindFilter) return false;
        if (focusFilter === 'critical' && event.tone !== 'danger') return false;
        return true;
      }),
    [focusFilter, kindFilter, workspace.events],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const event of filteredEvents) {
      const current = grouped.get(event.dateKey) ?? [];
      current.push(event);
      grouped.set(event.dateKey, current);
    }

    for (const [dateKey, events] of grouped.entries()) {
      grouped.set(
        dateKey,
        [...events].sort((first, second) => first.sortAt.localeCompare(second.sortAt)),
      );
    }

    return grouped;
  }, [filteredEvents]);

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedEvents = eventsByDate.get(selectedDateKey) ?? [];
  const criticalDateKeys = useMemo(
    () =>
      new Set(
        filteredEvents.filter((event) => event.tone === 'danger').map((event) => event.dateKey),
      ),
    [filteredEvents],
  );

  const gridDays = useMemo(() => {
    const firstDay = startOfWeek(startOfMonth(visibleMonth), { locale: ptBR });
    const lastDay = endOfWeek(endOfMonth(visibleMonth), { locale: ptBR });
    const days: Date[] = [];

    for (let current = firstDay; current <= lastDay; current = addDays(current, 1)) {
      days.push(current);
    }

    return days;
  }, [visibleMonth]);

  const monthEventCounts = useMemo(
    () => ({
      total: filteredEvents.filter((event) => isSameMonth(new Date(event.sortAt), visibleMonth))
        .length,
      followUps: filteredEvents.filter(
        (event) => event.kind === 'follow_up' && isSameMonth(new Date(event.sortAt), visibleMonth),
      ).length,
      tasks: filteredEvents.filter(
        (event) => event.kind === 'task' && isSameMonth(new Date(event.sortAt), visibleMonth),
      ).length,
      billing: filteredEvents.filter(
        (event) => event.kind === 'billing' && isSameMonth(new Date(event.sortAt), visibleMonth),
      ).length,
      criticalDays: Array.from(criticalDateKeys).filter((dateKey) =>
        isSameMonth(new Date(`${dateKey}T12:00:00`), visibleMonth),
      ).length,
    }),
    [criticalDateKeys, filteredEvents, visibleMonth],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agenda consolidada de follow-ups, tarefas, projetos e vencimentos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kindFilter || focusFilter ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Limpar filtro
            </Button>
          ) : null}
          {calendarQuery.isFetching ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<CalendarDays size={20} />}
          label="Eventos no mes"
          value={String(monthEventCounts.total)}
        />
        <MetricCard
          icon={<PhoneCall size={20} />}
          label="Follow-ups"
          value={String(monthEventCounts.followUps)}
        />
        <MetricCard
          icon={<ClipboardList size={20} />}
          label="Tarefas com prazo"
          value={String(monthEventCounts.tasks)}
        />
        <MetricCard
          icon={<CircleDollarSign size={20} />}
          label="Vencimentos"
          value={String(monthEventCounts.billing)}
        />
        <MetricCard
          icon={<CalendarDays size={20} />}
          label="Dias criticos"
          value={String(monthEventCounts.criticalDays)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold capitalize">{monthLabel(visibleMonth)}</h2>
                <p className="text-sm text-muted-foreground">
                  Clique em um dia para ver os detalhes da agenda.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-10 w-10 px-0"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const nextMonth = subMonths(visibleMonth, 1);
                    setVisibleMonth(nextMonth);
                    setSelectedDate(startOfMonth(nextMonth));
                  }}
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setVisibleMonth(startOfMonth(today));
                    setSelectedDate(today);
                  }}
                >
                  Hoje
                </Button>
                <Button
                  className="h-10 w-10 px-0"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const nextMonth = addMonths(visibleMonth, 1);
                    setVisibleMonth(nextMonth);
                    setSelectedDate(startOfMonth(nextMonth));
                  }}
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekdayLabels(visibleMonth).map((label) => (
                <div
                  key={label}
                  className="px-2 pb-2 text-center text-xs font-semibold uppercase text-muted-foreground"
                >
                  {label}
                </div>
              ))}

              {gridDays.map((day) => {
                const dayKey = formatDateKey(day);
                const dayEvents = eventsByDate.get(dayKey) ?? [];
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);
                const inVisibleMonth = isSameMonth(day, visibleMonth);
                const isCritical = criticalDateKeys.has(dayKey);

                return (
                  <button
                    key={dayKey}
                    className={[
                      'min-h-28 rounded-md border p-2 text-left transition-colors',
                      isSelected
                        ? 'border-brand bg-brand/5'
                        : isCritical
                          ? 'border-danger/50 bg-danger/5 hover:border-danger'
                          : 'border-border hover:border-brand/40 hover:bg-muted/30',
                      !inVisibleMonth ? 'opacity-45' : '',
                    ].join(' ')}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={[
                          'grid h-7 w-7 place-items-center rounded-full text-sm font-semibold',
                          isToday ? 'bg-brand text-white' : 'text-foreground',
                        ].join(' ')}
                      >
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 ? (
                        <Badge
                          tone={isCritical ? 'danger' : dayEvents.length >= 3 ? 'brand' : 'neutral'}
                        >
                          {dayEvents.length}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div key={event.id} className="rounded bg-muted px-2 py-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {event.timeLabel ? `${event.timeLabel} ` : ''}
                            {event.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {labelForKind(event.kind)}
                          </p>
                        </div>
                      ))}
                      {dayEvents.length > 3 ? (
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          +{dayEvents.length - 3} itens
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-semibold capitalize">{fullDateLabel(selectedDate)}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedEvents.length > 0
                  ? `${selectedEvents.length} item(ns) para acompanhar`
                  : 'Nenhum item agendado para este dia'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {calendarQuery.isError ? (
              <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                {calendarQuery.error.message}
              </p>
            ) : selectedEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedEvents.map((event) => (
                  <article key={event.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{event.accountName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={toneForKind(event.kind)}>{labelForKind(event.kind)}</Badge>
                        <Badge tone={event.tone}>{event.timeLabel ?? 'Dia inteiro'}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {event.description}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title="Dia sem agenda"
                description="Use este painel para concentrar follow-ups, prazos e vencimentos."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Proximos itens</h2>
        </CardHeader>
        <CardContent>
          {filteredEvents.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-3">
              {filteredEvents.slice(0, 6).map((event) => (
                <article key={`next-${event.id}`} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={toneForKind(event.kind)}>{labelForKind(event.kind)}</Badge>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {new Date(event.sortAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold">{event.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.accountName}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {event.description}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum item combina com o filtro atual.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--brand)] text-white hover:bg-[#173a2f] shadow-[0_18px_40px_rgba(31,77,61,0.18)]',
  secondary: 'bg-white/80 text-[var(--foreground)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-white',
  ghost: 'bg-transparent text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--foreground)]',
  danger: 'bg-[var(--danger)] text-white hover:bg-[#953d31]',
};

export function Button({
  children,
  className,
  variant = 'primary',
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className,
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-[var(--muted-foreground)] transition hover:border-[var(--line-strong)] hover:text-[var(--foreground)]',
        className,
      )}
      {...props}
    />
  );
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'glass-panel rounded-[calc(var(--radius)+0.125rem)] border border-[var(--line)] shadow-[var(--shadow)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="section-heading text-4xl text-[var(--foreground)] sm:text-5xl">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'accent' | 'danger';
}) {
  const toneStyles = {
    neutral: 'from-white/70 to-white/40',
    brand: 'from-[rgba(31,77,61,0.16)] to-white/50',
    accent: 'from-[rgba(179,138,82,0.18)] to-white/45',
    danger: 'from-[rgba(180,79,64,0.18)] to-white/45',
  };

  return (
    <Surface className={cn('overflow-hidden p-5', `bg-gradient-to-br ${toneStyles[tone]}`)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <div className="min-w-0 break-words text-3xl font-bold leading-tight text-[var(--foreground)]">{value}</div>
          {hint ? <div className="min-w-0 break-words text-sm text-[var(--muted-foreground)]">{hint}</div> : null}
        </div>
        {icon ? (
          <div className="shrink-0 rounded-full border border-white/60 bg-white/80 p-3 text-[var(--brand)]">
            {icon}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'accent' | 'danger' | 'success';
  className?: string;
}) {
  const toneStyles = {
    neutral: 'bg-black/5 text-[var(--muted-foreground)]',
    brand: 'bg-[rgba(31,77,61,0.12)] text-[var(--brand)]',
    accent: 'bg-[rgba(179,138,82,0.18)] text-[#7a5f36]',
    danger: 'bg-[rgba(180,79,64,0.15)] text-[var(--danger)]',
    success: 'bg-[rgba(44,125,92,0.16)] text-[#245c45]',
  };

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.02em] break-all',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn('p-5 sm:p-6', className)}>
      <div className="mb-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-[var(--line-strong)] bg-white/45 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      {description ? <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
        {hint ? <span className="text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(31,77,61,0.08)]',
        props.className,
      )}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(31,77,61,0.08)]',
        props.className,
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[120px] w-full rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(31,77,61,0.08)]',
        props.className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
        checked
          ? 'border-[rgba(31,77,61,0.22)] bg-[rgba(31,77,61,0.08)]'
          : 'border-[var(--line)] bg-white/70 hover:border-[var(--line-strong)]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 rounded-md border transition',
          checked
            ? 'border-[var(--brand)] bg-[var(--brand)]'
            : 'border-[var(--line-strong)] bg-white',
        )}
      />
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
        {description ? <span className="block text-xs text-[var(--muted-foreground)]">{description}</span> : null}
      </span>
    </button>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-[var(--line)]" />;
}

export function LoadingBlock({ label = 'Загружаем данные...' }: { label?: string }) {
  return (
    <Surface className="flex items-center gap-3 px-5 py-4 text-sm text-[var(--muted-foreground)]">
      <LoaderCircle className="h-4 w-4 animate-spin text-[var(--brand)]" />
      {label}
    </Surface>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'lg',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  if (!open) {
    return null;
  }

  const maxWidth = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(26,20,16,0.48)] p-4 sm:p-8">
      <div className={cn('w-full rounded-[2rem] border border-white/40 bg-[#fffaf3] p-6 shadow-[0_40px_100px_rgba(24,18,14,0.3)]', maxWidth)}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="section-heading text-3xl text-[var(--foreground)]">{title}</h3>
          </div>
          <IconButton onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; badge?: ReactNode }>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-full border border-[var(--line)] bg-white/75 p-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            value === item.value
              ? 'bg-[var(--foreground)] text-white'
              : 'text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--foreground)]',
          )}
        >
          {item.label}
          {item.badge}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--line)] bg-white/75">
      <table className="min-w-full text-sm">
        <thead className="border-b border-[var(--line)] bg-white/85">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

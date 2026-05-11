import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChartColumnIncreasing, ShieldCheck, WalletCards } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Button, Field, Input, Surface } from '@/shared/components/ui';

const demoAccounts = [
  { role: 'Владелец', credentials: 'owner / owner123' },
  { role: 'Руководитель', credentials: 'director / dir123' },
  { role: 'Менеджер', credentials: 'manager / manager123' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('owner123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Не удалось войти. Проверьте логин и пароль или убедитесь, что серверная часть запущена.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid w-full max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Surface className="overflow-hidden p-8 sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge tone="accent" className="px-4 py-2 text-[11px]">
                  Курсовой проект
                </Badge>
                <h1 className="section-heading max-w-xl text-5xl leading-[1.05] text-[var(--foreground)] sm:text-6xl">
                  Управление договорной и сметной деятельностью без хаоса.
                </h1>
                <p className="max-w-xl text-base leading-8 text-[var(--muted-foreground)]">
                  Единая рабочая среда для договоров, согласования, смет, платежей и командной ответственности.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: <ChartColumnIncreasing className="h-5 w-5" />, title: 'Аналитика', text: 'Ключевые показатели по обязательствам и финансам.' },
                  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Согласование', text: 'Маршруты и задачи по ролям без потери контекста.' },
                  { icon: <WalletCards className="h-5 w-5" />, title: 'Платежи', text: 'План-факт и предстоящие выплаты по каждому договору.' },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-4">
                    <div className="mb-4 inline-flex rounded-2xl bg-[rgba(31,77,61,0.08)] p-3 text-[var(--brand)]">
                      {item.icon}
                    </div>
                    <h2 className="text-base font-semibold text-[var(--foreground)]">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-6 sm:p-8">
              <div className="mb-8 space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-[var(--accent)]">Вход в систему</p>
                <h2 className="section-heading text-4xl text-[var(--foreground)]">Добро пожаловать</h2>
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  Используйте тестового пользователя или свои локальные учётные данные.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Имя пользователя">
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Введите логин"
                    autoComplete="username"
                    required
                  />
                </Field>
                <Field label="Пароль">
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    required
                  />
                </Field>

                {error ? (
                  <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" busy={submitting} className="w-full justify-between rounded-2xl px-5 py-3.5">
                  Войти в рабочее пространство
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-8 space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  Быстрый доступ
                </p>
                <div className="space-y-3">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => {
                        const [demoUsername, demoPassword] = account.credentials.split(' / ');
                        setUsername(demoUsername);
                        setPassword(demoPassword);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3 text-left transition hover:border-[var(--line-strong)] hover:bg-white"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-[var(--foreground)]">{account.role}</span>
                        <span className="block text-xs text-[var(--muted-foreground)]">{account.credentials}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}



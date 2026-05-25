import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChartColumnIncreasing, ShieldCheck, WalletCards } from 'lucide-react';

import { Badge, Button, Field, Input, Surface } from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(username, password);
        navigate('/workspace');
      } else {
        await register({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        });
        setMode('login');
        setError('');
      }
    } catch {
      setError(mode === 'login'
        ? 'Не удалось войти. Проверьте логин и пароль или убедитесь, что серверная часть запущена.'
        : 'Не удалось зарегистрироваться. Проверьте уникальность логина/email и корректность данных.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-[96rem]">
        <Surface className="overflow-hidden p-8 sm:p-10 lg:p-12 xl:p-14">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.82fr)] xl:items-start">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge tone="accent" className="px-4 py-2 text-[11px]">
                  Курсовой проект
                </Badge>
                <h1 className="section-heading max-w-[44rem] text-5xl leading-[1.02] text-[var(--foreground)] sm:text-6xl xl:text-[5.35rem]">
                  Управление договорной и сметной деятельностью без хаоса.
                </h1>
                <p className="max-w-[38rem] text-base leading-8 text-[var(--muted-foreground)]">
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

            <div className="w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-6 sm:p-8 xl:sticky xl:top-10 xl:justify-self-end">
              <div className="mb-8 space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-[var(--accent)]">{mode === 'login' ? 'Вход в систему' : 'Регистрация'}</p>
                <h2 className="section-heading text-[3.2rem] leading-[0.94] text-[var(--foreground)] sm:text-[3.6rem]">
                  {mode === 'login' ? 'Добро пожаловать' : 'Создайте аккаунт'}
                </h2>
                <p className="max-w-md text-sm leading-7 text-[var(--muted-foreground)]">
                  {mode === 'login'
                    ? 'Войдите в систему, затем выберите рабочую организацию или примите приглашение.'
                    : 'После регистрации Вы сможете создать свою организацию и автоматически станете Главным админом.'}
                </p>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] bg-white/75 p-1">
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-[var(--foreground)] text-white' : 'text-[var(--muted-foreground)]'}`}
                  onClick={() => setMode('login')}
                >
                  Вход
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-[var(--foreground)] text-white' : 'text-[var(--muted-foreground)]'}`}
                  onClick={() => setMode('register')}
                >
                  Регистрация
                </button>
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

                {mode === 'register' ? (
                  <>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Введите email"
                        autoComplete="email"
                        required
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Имя">
                        <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Имя" />
                      </Field>
                      <Field label="Фамилия">
                        <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Фамилия" />
                      </Field>
                    </div>
                  </>
                ) : null}

                <Field label="Пароль">
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </Field>

                {error ? (
                  <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" busy={submitting} className="w-full justify-between rounded-2xl px-5 py-3.5">
                  {mode === 'login' ? 'Войти в рабочее пространство' : 'Создать аккаунт'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

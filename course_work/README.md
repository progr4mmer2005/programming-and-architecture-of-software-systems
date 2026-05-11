# АИС "Управление договорной и сметной деятельностью"

Автоматизированная информационная система для управления полным жизненным циклом договоров, смет и платежей.

## Технологический стек

- **Backend:** Python 3.14+ / Django 6.0 / Django REST Framework
- **Frontend:** React 18 / TypeScript / Vite / TanStack Query / Zustand / Tailwind CSS / Recharts
- **Database:** MySQL 8 / SQLite (переключается через .env)
- **Auth:** JWT (djangorestframework-simplejwt)
- **Queue:** django-q2 (для уведомлений)

## Быстрый старт

### Предварительные требования

- Python 3.14+
- Node.js 20+
- MySQL 8 (или MariaDB 10.5+) — необязательно при использовании SQLite

### 1. Создайте базу данных MySQL

```sql
CREATE DATABASE contracts_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Настройка бэкенда

```bash
cd backend

# Создание виртуального окружения
python -m venv venv

# Активация (Windows)
venv\Scripts\activate
# Активация (Linux/Mac)
# source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Настройка окружения
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Отредактируйте .env под свои параметры БД
#   - Для MySQL: DB_ENGINE=mysql (заполните DB_NAME, DB_USER, DB_PASSWORD и т.д.)
#   - Для SQLite: DB_ENGINE=sqlite (остальные DB_* не нужны)

# Миграции
python manage.py makemigrations organizations accounts contractors contracts templates estimates stages payments approvals comments audit

# Примените миграции
python manage.py migrate

# Заполните тестовыми данными
python manage.py seed_data

# Запустите сервер
python manage.py runserver
```

### 3. Настройка фронтенда

```bash
cd frontend
npm install
npm run dev
```

### 4. Откройте приложение

- **Frontend:** http://localhost:5173
- **Admin панель:** http://localhost:8000/admin/
- **API:** http://localhost:8000/api/

## Тестовые пользователи

| Роль         | Логин     | Пароль      |
|-------------|-----------|-------------|
| Владелец    | owner     | owner123    |
| Руководитель | director  | dir123      |
| Менеджер    | manager   | manager123  |
| Юрист       | lawyer    | lawyer123   |
| Финансист   | finance   | finance123  |

## Структура проекта

```
course_work/
├── backend/
│   ├── config/           # Django настройки
│   ├── apps/
│   │   ├── organizations # Организации (multi-tenant)
│   │   ├── accounts/     # Пользователи + роли
│   │   ├── contractors/  # Контрагенты
│   │   ├── contracts/    # Договоры + версионирование
│   │   ├── templates/    # Шаблоны договоров
│   │   ├── estimates/    # Сметы + версии
│   │   ├── stages/       # Этапы договоров
│   │   ├── payments/     # Платежи + календарь
│   │   ├── approvals/    # Согласования
│   │   ├── comments/     # Комментарии
│   │   ├── audit/        # Аудит изменений
│   │   ├── dashboard/    # Дашборды
│   │   └── core/         # Утилиты (permissions, pagination)
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/         # API клиент (axios)
│   │   ├── pages/       # Страницы
│   │   ├── stores/      # Zustand store
│   │   ├── shared/      # UI компоненты, хуки
│   │   └── App.tsx      # Роутинг
│   ├── package.json
│   └── vite.config.ts
├── setup.bat            # Скрипт установки (Windows)
├── setup.sh             # Скрипт установки (Linux/Mac)
└── README.md
```

## API Endpoints

| Module          | Endpoints                                                      |
|-----------------|----------------------------------------------------------------|
| **Auth**        | `POST /api/auth/login/`, `POST /api/auth/refresh/`             |
| **Users**       | `GET/POST /api/users/`, `GET /api/users/me/`                   |
| **Organizations**| `GET/PUT /api/organizations/`, `/api/organizations/stats/`    |
| **Contracts**   | `GET/POST /api/contracts/`, `/api/contracts/{id}/change-status/`|
| **Versions**    | `GET /api/contracts/{id}/versions/`, `POST .../new-version/`   |
| **Contractors** | `GET/POST /api/contractors/`                                    |
| **Templates**   | `GET/POST /api/templates/`                                      |
| **Estimates**   | `GET/POST /api/estimates/`, `/api/estimates/{id}/upload-version/`|
| **Payments**    | `GET/POST /api/payments/`                                       |
| **Calendar**    | `GET /api/payment-calendar/`, `/api/payment-calendar/current/` |
| **Approvals**   | `GET/POST /api/approval-routes/`, `/api/approval-tasks/{id}/approve/`|
| **Dashboard**   | `GET /api/dashboard/summary/`, `.../contracts-by-status/`       |
| **Audit**       | `GET /api/audit-logs/`                                          |
| **Comments**    | `GET/POST /api/comments/`                                       |

## Ролевая модель

- **Владелец (Owner)** — полный доступ, управление пользователями
- **Руководитель (Director)** — утверждение договоров, дашборды
- **Менеджер** — создание договоров и смет
- **Юрист** — юридическая экспертиза
- **Финансист** — платежи и календарь
- **Администратор** — подроль владельца

## Переключение между MySQL и SQLite

В файле `backend/.env` укажите:

```ini
# Для MySQL (требуется работающий сервер MySQL)
DB_ENGINE=mysql
DB_NAME=contracts_db
DB_USER=root
DB_PASSWORD=root
DB_HOST=localhost
DB_PORT=3306

# Для SQLite (не требует внешней БД)
DB_ENGINE=sqlite
```

При `DB_ENGINE=sqlite` база данных хранится в файле `backend/db.sqlite3`. Остальные `DB_*` переменные игнорируются.

### Перенос данных между СУБД

Если нужно скопировать данные из MySQL в SQLite или обратно:

```bash
cd backend

# 1. Убедитесь, что в .env стоит DB_ENGINE=mysql и MySQL доступен
# 2. Выполните миграции (если не сделано)
python manage.py migrate

# 3. Скопируйте данные из MySQL в SQLite
python manage.py sync_data mysql2sqlite

# 4. Остановите сервер, переключите .env на DB_ENGINE=sqlite
# 5. Запустите сервер снова — данные уже на месте
python manage.py runserver
```

Команда `sync_data` также поддерживает обратное направление:

```bash
python manage.py sync_data sqlite2mysql
```

## Docker (альтернатива)

```bash
# Запуск только MySQL через Docker
docker run -d --name contracts-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=contracts_db -p 3306:3306 mysql:8

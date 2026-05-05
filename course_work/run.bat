@echo off
chcp 65001 >nul
title АИС Управление договорами
echo ============================================
echo   АИС Управление договорной деятельностью
echo ============================================
echo.

:: Проверка виртуального окружения
cd backend
if not exist "venv" (
    echo [1/3] Виртуальное окружение не найдено. Создаю...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt >nul 2>&1
) else (
    call venv\Scripts\activate.bat
)
echo [1/3] Виртуальное окружение: OK

:: Запуск Django сервера в фоне
echo [2/3] Запуск Django сервера (порт 8000)...
start "Django Server" /B cmd /c "python manage.py runserver 2>&1"
if %ERRORLEVEL% NEQ 0 (
    echo   ОШИБКА! Django не запустился.
    pause
    exit /b 1
)
echo   Сервер бэкенда запущен: http://localhost:8000
cd ..

:: Запуск Frontend
echo [3/3] Запуск Frontend (порт 5173)...
cd frontend
if not exist "node_modules" (
    echo   Установка зависимостей frontend...
    call npm install
)
start "Frontend Vite" /B cmd /c "npm run dev 2>&1"
echo   Сервер фронтенда запущен: http://localhost:5173
cd ..

echo.
echo ============================================
echo   Приложение запущено!
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   Admin:    http://localhost:8000/admin/
echo   API:      http://localhost:8000/api/
echo.
echo   Для остановки закройте окна серверов
echo   или нажмите Ctrl+C в соответствующих окнах.
echo ============================================
pause
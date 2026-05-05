@echo off
chcp 65001 >nul
echo ============================================
echo   Заполнение базы тестовыми данными
echo ============================================
echo.

cd backend

if not exist "venv" (
    echo [1/2] Виртуальное окружение не найдено. Создаю...
    python -m venv venv
) else (
    echo [1/2] Виртуальное окружение найдено.
)

echo [2/2] Заполнение тестовыми данными...
call venv\Scripts\activate.bat

python manage.py seed_data
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ОШИБКА! Возможно не применены миграции.
    echo Сначала запустите: setup_db.bat
    echo.
    pause
    exit /b 1
)

cd ..

echo.
echo ============================================
echo   Тестовые данные успешно загружены!
echo.
echo   Пользователи для входа:
echo     Владелец:     owner / owner123
echo     Руководитель: director / dir123
echo     Менеджер:     manager / manager123
echo     Юрист:        lawyer / lawyer123
echo     Финансист:    finance / finance123
echo.
echo   Запустите приложение: run.bat
echo ============================================
pause
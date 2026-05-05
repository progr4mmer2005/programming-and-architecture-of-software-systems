@echo off
chcp 65001 >nul
echo ============================================
echo   Создание и настройка базы данных
echo ============================================
echo.

:: Настройки MySQL (можно изменить)
set DB_USER=root
set DB_PASS=root
set DB_NAME=contracts_db

echo [1/3] Удаление существующей базы данных (если есть)...
mysql -u%DB_USER% -p%DB_PASS% -e "DROP DATABASE IF EXISTS %DB_NAME%;" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ВНИМАНИЕ] Не удалось подключиться к MySQL.
    echo Пожалуйста, убедитесь что MySQL запущен и укажите правильные учетные данные.
    echo.
    echo Вы можете создать базу данных вручную:
    echo   mysql -u root -p
    echo   CREATE DATABASE contracts_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    echo.
    pause
    exit /b 1
)
echo   База данных удалена (если существовала).

echo [2/3] Создание новой базы данных...
mysql -u%DB_USER% -p%DB_PASS% -e "CREATE DATABASE %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo   База данных "%DB_NAME%" создана.

echo [3/3] Применение миграций Django...
cd backend
if not exist "venv" (
    echo   Виртуальное окружение не найдено. Создаю...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt >nul 2>&1

echo   Создание миграций...
python manage.py makemigrations organizations accounts contractors contracts templates estimates stages payments approvals comments audit
if %ERRORLEVEL% NEQ 0 (
    echo   ОШИБКА при создании миграций!
    pause
    exit /b 1
)

echo   Применение миграций...
python manage.py migrate
if %ERRORLEVEL% NEQ 0 (
    echo   ОШИБКА при применении миграций!
    pause
    exit /b 1
)

cd ..
echo.
echo ============================================
echo   Готово! База данных настроена.
echo   Теперь запустите: seed_data.bat
echo         или:      run.bat
echo ============================================
pause
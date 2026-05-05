@echo off
echo ============================================
echo  Setting up AIS Contract Management System
echo ============================================
echo.

echo [1/5] Creating Python virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate.bat

echo [2/5] Installing Python dependencies...
pip install -r requirements.txt
echo.

echo [3/5] Installing frontend dependencies...
cd ..\frontend
if not exist "package.json" (
    echo Creating frontend project...
    call npm create vite@latest . -- --template react-ts
)
call npm install
cd ..

echo [4/5] Setting up environment...
if not exist "backend\.env" (
    copy backend\.env.example backend\.env
    echo Copied .env.example to .env - please configure your database settings
)
echo.

echo [5/5] Setup complete!
echo.
echo ============================================
echo  Next steps:
echo  1. Create MySQL database 'contracts_db'
echo  2. Edit backend/.env with your DB credentials
echo  3. cd backend && python manage.py migrate
echo  4. cd backend && python manage.py seed_data
echo  5. cd backend && python manage.py runserver
echo  6. cd frontend && npm run dev
echo ============================================
pause
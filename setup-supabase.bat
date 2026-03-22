@echo off
echo ================================================
echo  居護所個案管理系統 - Supabase 設定精靈
echo ================================================
echo.

echo [步驟 1] 前往以下網址登入 Supabase 並取得 Access Token：
echo   https://supabase.com/dashboard/account/tokens
echo.
set /p ACCESS_TOKEN="請貼上您的 Access Token: "

echo.
echo [步驟 2] 請輸入您的 Supabase Project ID
echo   （在 Project Settings > General 中可找到）
echo.
set /p PROJECT_ID="請輸入 Project ID: "

echo.
echo [步驟 3] 設定環境變數並登入...
set SUPABASE_ACCESS_TOKEN=%ACCESS_TOKEN%

echo.
echo [步驟 4] 連結專案...
npx supabase link --project-ref %PROJECT_ID%

echo.
echo [步驟 5] 推送資料庫結構（Migration）...
npx supabase db push

echo.
echo [步驟 6] 取得 API 金鑰...
echo   請前往：https://supabase.com/dashboard/project/%PROJECT_ID%/settings/api
echo   複製以下兩個值：
echo   - Project URL
echo   - anon public key
echo.

echo [步驟 7] 建立 .env 檔案...
set /p SUPABASE_URL="請貼上 Project URL: "
set /p SUPABASE_ANON_KEY="請貼上 anon public key: "

echo VITE_SUPABASE_URL=%SUPABASE_URL% > .env
echo VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY% >> .env

echo.
echo ================================================
echo  設定完成！
echo  請執行：npm run dev
echo  然後開啟瀏覽器：http://localhost:3000
echo ================================================
pause

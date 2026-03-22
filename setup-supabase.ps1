# ================================================
#  居護所個案管理系統 - Supabase 設定精靈 (PowerShell)
# ================================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  居護所個案管理系統 - Supabase 設定精靈" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Access Token
Write-Host "[步驟 1] 取得 Supabase Access Token" -ForegroundColor Yellow
Write-Host "  請開啟：https://supabase.com/dashboard/account/tokens" -ForegroundColor Gray
Write-Host "  點選 'Generate new token'，複製後貼在下方" -ForegroundColor Gray
Write-Host ""
$ACCESS_TOKEN = Read-Host "請貼上 Access Token"

# Step 2: Project ID
Write-Host ""
Write-Host "[步驟 2] 輸入 Project ID" -ForegroundColor Yellow
Write-Host "  在 Supabase Dashboard > Project Settings > General 可找到" -ForegroundColor Gray
Write-Host ""
$PROJECT_ID = Read-Host "請輸入 Project ID"

# Step 3: Link project
Write-Host ""
Write-Host "[步驟 3] 連結 Supabase 專案..." -ForegroundColor Yellow
$env:SUPABASE_ACCESS_TOKEN = $ACCESS_TOKEN
npx supabase link --project-ref $PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "連結失敗，請確認 Project ID 是否正確" -ForegroundColor Red
    pause
    exit 1
}

# Step 4: Push migrations
Write-Host ""
Write-Host "[步驟 4] 推送資料庫結構..." -ForegroundColor Yellow
npx supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "資料庫推送失敗，請檢查錯誤訊息" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "✅ 資料庫建立成功！" -ForegroundColor Green

# Step 5: Get API keys
Write-Host ""
Write-Host "[步驟 5] 設定 API 金鑰" -ForegroundColor Yellow
Write-Host "  請前往：https://supabase.com/dashboard/project/$PROJECT_ID/settings/api" -ForegroundColor Gray
Write-Host ""
$SUPABASE_URL = Read-Host "請貼上 Project URL (https://xxx.supabase.co)"
$SUPABASE_ANON_KEY = Read-Host "請貼上 anon public key"

# Step 6: Create .env
$envContent = @"
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "✅ .env 檔案已建立" -ForegroundColor Green
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  🎉 設定完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  啟動系統：npm run dev" -ForegroundColor White
Write-Host "  瀏覽器開啟：http://localhost:3000" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 7: Start dev server
$START = Read-Host "是否立即啟動開發伺服器？(Y/N)"
if ($START -eq "Y" -or $START -eq "y") {
    npm run dev
}

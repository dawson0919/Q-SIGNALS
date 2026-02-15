# Railway 部署指南

## 快速部署步驟

### 1. 前往 Railway
訪問：https://railway.app/new

### 2. 連接 GitHub
- 點擊 "Deploy from GitHub repo"
- 授權 Railway 訪問您的 GitHub
- 選擇 `dawson0919/Q-SIGNALS` 專案

### 3. 設定環境變數
在 Railway Dashboard → Variables 中新增：

```
SUPABASE_URL=https://zrhussirvsgsoffmrkxb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM
BACKFILL_DAYS=365
PORT=3000
NODE_ENV=production
```

### 4. 部署設定
Railway 會自動偵測到 `package.json` 並執行：
- `npm install`
- `npm start` (或 `node server.js`)

### 5. 取得網址
部署完成後，Railway 會提供一個公開網址，例如：
`https://your-app-name.up.railway.app`

## ✅ 完整功能支援

Railway 支援您所有的功能：
- ✅ WebSocket 即時價格監控
- ✅ 背景資料回填任務
- ✅ 長時間運行的服務
- ✅ Supabase 連線
- ✅ 靜態檔案服務

## 💰 費用估算

**免費額度：**
- 每月 $5 USD credit
- 約 500 小時運行時間（足夠一個小型應用 24/7 運行）

**超出後：**
- 按使用量計費
- 通常小型應用每月 $5-10 USD

## 🔧 進階設定（可選）

### 自訂網域
在 Railway Dashboard → Settings → Domains 中可以綁定自己的網域。

### 健康檢查
Railway 會自動監控您的服務，如果崩潰會自動重啟。

### 日誌查看
在 Railway Dashboard 可以即時查看應用日誌。

## 🆚 Railway vs Vercel

| 功能 | Railway | Vercel |
|------|---------|--------|
| WebSocket | ✅ 完整支援 | ❌ 不支援 |
| 長時間運行 | ✅ 支援 | ❌ 有時間限制 |
| 背景任務 | ✅ 支援 | ⚠️ 需要 Cron Jobs |
| 靜態檔案 | ✅ 支援 | ✅ 優化更好 |
| 免費額度 | $5/月 credit | 更慷慨 |
| 部署速度 | 快 | 非常快 |
| 適合場景 | 全功能應用 | 靜態網站 + API |

## 🚀 立即開始

1. 訪問：https://railway.app/new
2. 選擇 "Deploy from GitHub repo"
3. 選擇您的專案
4. 設定環境變數
5. 點擊 Deploy！

部署通常在 2-3 分鐘內完成。

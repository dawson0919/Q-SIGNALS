# Vercel 部署指南

## 環境變數設定

在 Vercel Dashboard → Settings → Environment Variables 中新增：

```
SUPABASE_URL=https://zrhussirvsgsoffmrkxb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM
BACKFILL_DAYS=365
NODE_ENV=production
```

## 部署步驟

1. 前往 [Vercel Dashboard](https://vercel.com/new)
2. 選擇 "Import Git Repository"
3. 連接您的 GitHub 帳號並選擇 `Q-SIGNALS` 專案
4. 設定環境變數（如上）
5. 點擊 "Deploy"

## ⚠️ 重要限制

### WebSocket 不支援
Vercel Serverless Functions 不支援長時間運行的 WebSocket。

**解決方案：**
- 使用 Supabase Realtime 替代 WebSocket
- 或使用輪詢 (Polling) 方式定期更新價格
- 或將 WebSocket 服務部署到其他平台（如 Railway, Render）

### 背景任務限制
- Serverless Functions 有執行時間限制（10秒 Hobby plan, 60秒 Pro plan）
- 歷史資料回填 (backfill) 需要改為按需執行或使用 Vercel Cron Jobs

### 資料庫連線
- 確保 Supabase 連線池設定正確
- 避免在每個請求中建立新連線

## 建議架構調整

### 選項 1：混合部署
- **Vercel**: 靜態頁面 + API Routes
- **Railway/Render**: WebSocket 服務 + 背景任務

### 選項 2：完全 Serverless
- 移除 WebSocket，改用 Supabase Realtime
- 使用 Vercel Cron Jobs 處理定時任務
- 將歷史資料回填改為手動觸發的 API

## 測試部署

部署後測試以下功能：
- ✅ 靜態頁面載入
- ✅ API 端點回應
- ✅ Supabase 認證
- ⚠️ 即時價格更新（需調整）
- ⚠️ 背景資料同步（需調整）

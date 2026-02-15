# Railway 環境變數設定詳細步驟

## 🎯 快速導航

部署後的環境變數設定路徑：
```
Railway Dashboard → 您的專案 → Service → Variables 標籤
```

## 📋 詳細步驟

### 步驟 1：進入 Railway Dashboard
1. 前往 https://railway.app
2. 登入您的帳號
3. 您會看到所有專案列表

### 步驟 2：選擇專案
1. 點擊 `Q-SIGNALS` 專案（或您的專案名稱）
2. 進入專案詳情頁面

### 步驟 3：進入 Service 設定
1. 在專案頁面中，您會看到一個或多個 "Service"（服務）
2. 點擊您的服務（通常名為 `q-signals` 或 `server`）

### 步驟 4：找到 Variables 標籤
在服務頁面頂部，您會看到幾個標籤：
- **Deployments** (部署記錄)
- **Metrics** (監控指標)
- **Variables** ← 點這個！
- **Settings** (設定)

### 步驟 5：新增環境變數

#### 方法 A：使用 Raw Editor（推薦，最快）
1. 點擊右上角的 "**RAW Editor**" 按鈕
2. 將以下內容完整複製貼上：

```
SUPABASE_URL=https://zrhussirvsgsoffmrkxb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM
BACKFILL_DAYS=365
PORT=3000
NODE_ENV=production
```

3. 點擊 "**Update Variables**" 按鈕
4. Railway 會自動重新部署您的應用

#### 方法 B：逐一新增
1. 點擊 "**+ New Variable**" 按鈕
2. 輸入變數名稱和值：
   - Variable Name: `SUPABASE_URL`
   - Value: `https://zrhussirvsgsoffmrkxb.supabase.co`
3. 點擊 "Add"
4. 重複以上步驟，新增其他變數

### 步驟 6：確認設定
設定完成後，您應該會看到 5 個環境變數：
- ✅ SUPABASE_URL
- ✅ SUPABASE_ANON_KEY
- ✅ BACKFILL_DAYS
- ✅ PORT
- ✅ NODE_ENV

### 步驟 7：等待重新部署
- Railway 會自動觸發重新部署
- 通常需要 1-2 分鐘
- 在 "Deployments" 標籤可以看到部署進度

## 🔍 如何驗證環境變數已生效

### 方法 1：查看部署日誌
1. 進入 "Deployments" 標籤
2. 點擊最新的部署
3. 查看日誌，應該會看到：
   ```
   🚀 Starting QuantSignal Server...
   ✅ Supabase connected
   ```

### 方法 2：測試 API
部署完成後，訪問：
```
https://your-app.up.railway.app/api/strategies
```
如果返回策略列表，表示環境變數設定正確。

## ⚠️ 常見問題

### Q: 我找不到 Variables 標籤
**A:** 確保您點擊的是 **Service**（服務），而不是 Project（專案）。
- ❌ 錯誤：在專案層級找不到 Variables
- ✅ 正確：進入 Service → Variables

### Q: 修改環境變數後需要重啟嗎？
**A:** Railway 會自動重新部署，不需要手動操作。

### Q: 可以隱藏敏感資訊嗎？
**A:** Railway 的環境變數預設是隱藏的，只有您能看到完整值。

### Q: 如何刪除環境變數？
**A:** 在 Variables 頁面，點擊變數右側的 "..." → Delete

## 📝 環境變數說明

| 變數名稱 | 說明 | 必填 |
|---------|------|------|
| SUPABASE_URL | Supabase 專案網址 | ✅ 是 |
| SUPABASE_ANON_KEY | Supabase 公開金鑰 | ✅ 是 |
| BACKFILL_DAYS | 歷史資料回填天數 | ⚠️ 可選（預設 365） |
| PORT | 伺服器埠號 | ⚠️ 可選（Railway 會自動設定） |
| NODE_ENV | 執行環境 | ⚠️ 可選（建議設為 production） |

## 🎉 完成！

設定完環境變數後，您的應用就可以正常運作了！

下一步：
1. 等待部署完成（1-2 分鐘）
2. 點擊 Railway 提供的網址
3. 測試您的應用功能

## 🆘 需要幫助？

如果遇到問題：
1. 檢查部署日誌（Deployments → 點擊最新部署 → View Logs）
2. 確認所有環境變數都已正確設定
3. 或隨時詢問我！

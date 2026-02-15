# 混合部署方案：Vercel + Railway

## 架構說明

### Vercel（前端）
- 靜態 HTML 頁面
- 超快的全球 CDN
- 免費且無限流量

### Railway（後端）
- Express API 服務
- WebSocket 即時價格
- 背景資料同步

## 部署步驟

### 第一步：部署後端到 Railway

1. 前往 https://railway.app/new
2. 選擇 GitHub 專案
3. 設定環境變數（同 RAILWAY_DEPLOY.md）
4. 記下部署後的網址，例如：`https://q-signals.up.railway.app`

### 第二步：修改前端配置

在所有 HTML 檔案中，將 API 端點改為 Railway 網址：

```javascript
// 原本
const API_BASE = '/api';

// 改為
const API_BASE = 'https://q-signals.up.railway.app/api';
```

### 第三步：部署前端到 Vercel

1. 前往 https://vercel.com/new
2. 選擇 GitHub 專案
3. 設定環境變數（Supabase 相關）
4. 部署

## 優點

✅ **最佳效能**：靜態內容由 Vercel CDN 提供，速度極快
✅ **完整功能**：Railway 處理所有動態功能
✅ **成本優化**：Vercel 免費，Railway 只需支付後端運算
✅ **可擴展性**：前後端獨立擴展

## 缺點

⚠️ **跨域問題**：需要在 Railway 設定 CORS
⚠️ **配置複雜**：需要管理兩個平台
⚠️ **額外延遲**：API 請求需要跨域

## 建議

對於您的應用，**建議使用 Railway 單一平台部署**，原因：
1. 配置更簡單
2. 不需要處理 CORS
3. 免費額度足夠使用
4. 維護更容易

除非您的流量非常大（每月數十萬訪問），否則混合部署的優勢不明顯。

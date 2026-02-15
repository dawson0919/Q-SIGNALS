# 修復 OAuth 重定向問題

## 問題
登入後跳轉到 `localhost:3000` 而不是 Railway 網址。

## 原因
Supabase 的 OAuth 回調網址設定中包含了 `localhost:3000`。

## 解決方案

### 步驟 1：更新 Supabase 設定

1. 前往 Supabase Dashboard
   - https://supabase.com/dashboard

2. 選擇您的專案 (zrhussirvsgsoffmrkxb)

3. 進入 Authentication → URL Configuration

4. 在 **Redirect URLs** 中新增：
   ```
   https://q-signals-production.up.railway.app/**
   ```

5. 在 **Site URL** 設定為：
   ```
   https://q-signals-production.up.railway.app
   ```

6. 點擊 **Save**

### 步驟 2：確認設定

**Redirect URLs 應該包含：**
- `http://localhost:3000/**` (開發環境)
- `https://q-signals-production.up.railway.app/**` (生產環境)

**Site URL 應該是：**
- `https://q-signals-production.up.railway.app` (生產環境)

或

- `http://localhost:3000` (開發環境，本地測試時)

### 步驟 3：清除瀏覽器快取

設定完成後：
1. 清除瀏覽器快取和 Cookies
2. 重新登入測試

## 注意事項

- Supabase 允許多個重定向網址（用 `**` 通配符）
- 開發和生產環境的網址都可以保留
- 修改後立即生效，無需重新部署

## 測試

設定完成後，測試以下流程：
1. 訪問 https://q-signals-production.up.railway.app/login.html
2. 點擊 "Continue with Google"
3. 登入後應該重定向到 https://q-signals-production.up.railway.app/index.html

✅ 如果成功，問題解決！

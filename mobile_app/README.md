# QuantSignal Mobile App

這是一個使用 Flutter 開發的量化交易訊號平台手機 App。

## 功能特點
- **Supabase 整合**：直接與現有的 Supabase 後端連動（Auth, Database）。
- **進階會員判斷**：根據用戶的角色（Standard/Advanced）自動解鎖或鎖定 Premium 策略。
- **深色外觀**：採用黑、金、紅的專業交易界面設計。

## 如何運行 (Windows)

1. **安裝 Flutter SDK**：
   請參考 [Flutter 官網安裝指南](https://docs.flutter.dev/get-started/install/windows)。

2. **安裝依賴項**：
   在 `mobile_app` 目錄下執行：
   ```bash
   flutter pub get
   ```

3. **運行 App**：
   連結您的手機（開啟開發者模式與 USB 調試）或啟動模擬器，執行：
   ```bash
   flutter run
   ```

## 目錄結構
- `lib/core`: 存放 API 設定與佈景主題。
- `lib/screens`: 各個功能頁面（登入、主頁、細節頁）。
- `lib/widgets`: 可重複使用的 UI 組件。

## 注意事項
- 目前 API 連結已預設為您的 Supabase 專案。
- 如果需要連結您的 Local Node.js server，請修改 `lib/core/constants.dart` 中的 `apiBaseUrl`。

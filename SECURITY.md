# 求職門神 - 資安政策

## 漏洞通報

如果你發現安全漏洞，請**不要**公開揭露。請寄信至 `ryan@mktersalon.com`，標題請註明 `[Security] 求職門神`。

我會在 7 個工作天內回覆。

## 資料處理原則

1. **不收集個人資料**：求職門神完全在使用者瀏覽器本機運作，不傳送任何瀏覽歷史、查詢紀錄、職缺資訊到任何伺服器。

2. **資料來源公開**：違規資料來自勞動部公開資料，新聞資料來自 Google News RSS，使用者可自行驗證。

3. **第三方資料當不信任**：所有外部資料（政府、Google News）都經過 HTML 跳脫處理，避免 XSS。

## 防護機制

- **XSS 防護**：所有外部字串透過 `escapeHtml` 處理
- **URL 驗證**：只允許 http(s) 連結
- **訊息驗證**：service worker 拒絕未知來源訊息
- **網路韌性**：fetch 帶 retry + timeout
- **配額容錯**：IndexedDB 寫入失敗時自動 prune
- **最小權限**：host_permissions 只申請必要網域

## 第三方依賴

extension：無 npm 依賴（純 vanilla JS）
資料 pipeline（不打包進 extension）：adm-zip, csv-parse

## Manifest V3

求職門神使用 Manifest V3，遵守：
- 嚴格 CSP（不允許 inline script / eval）
- Service Worker（無持續執行的 background page）
- declarativeNetRequest（如未來需要）

# 求職門神 JobGuard

在求職網站（104、1111 等）浮現公司風險資訊：勞基法違規、勞資訴訟、最新負面新聞。

## 專案結構

```
jobguard/
├── extension/      Chrome 擴充功能本體
├── data/          政府開放資料 pipeline
├── docs/          GitHub Pages 內容（violations.json、隱私權政策）
└── packages/
    └── shared/    共用型別與常數
```

## 開發

```bash
pnpm install

# 抓最新政府資料
cd data && pnpm fetch:ntpc-labor

# 整理成索引
pnpm build:violations

# 複製到 docs/ 以便 GitHub Pages 發布
pnpm copy:docs
```

## 資料來源

- 新北市資料開放平台 - 違反勞動基準法事業單位（CC-BY 4.0）
  - https://data.ntpc.gov.tw/datasets/A3408B16-7B28-4FA5-9834-D147AAE909BF

## 隱私

本擴充功能完全在使用者瀏覽器本機運作，不收集任何個人資料。詳見 [privacy.html](https://ryan-mkt.github.io/jobguard/privacy.html)。

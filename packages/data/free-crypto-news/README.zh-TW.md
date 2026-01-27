🌐 **語言:** [English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md) | [العربية](README.ar.md) | [Русский](README.ru.md) | [Italiano](README.it.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Türkçe](README.tr.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [Bahasa Indonesia](README.id.md)

---

# 🆓 免費加密貨幣新聞 API

<p align="center">
  <a href="https://github.com/nirholas/free-crypto-news/stargazers"><img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=for-the-badge&logo=github&color=yellow" alt="GitHub 星標"></a>
  <a href="https://github.com/nirholas/free-crypto-news/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nirholas/free-crypto-news?style=for-the-badge&color=blue" alt="授權"></a>
  <a href="https://github.com/nirholas/free-crypto-news/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nirholas/free-crypto-news/ci.yml?style=for-the-badge&logo=github-actions&label=CI" alt="CI 狀態"></a>
</p>

<p align="center">
  <img src=".github/demo.svg" alt="Free Crypto News API 展示" width="700">
</p>

> ⭐ **如果您覺得有用，請給倉庫點星！** 這有助於其他人發現這個專案並激勵持續開發。

---
透過一次 API 呼叫從 7 個主要來源獲取即時加密貨幣新聞。

```bash
curl https://free-crypto-news.vercel.app/api/news
```
---

| | Free Crypto News | CryptoPanic | 其他 |
|---|---|---|---|
| **價格** | 🆓 永久免費 | $29-299/月 | 付費 |
| **API 金鑰** | ❌ 無需 | 需要 | 需要 |
| **速率限制** | 無限制* | 100-1000/天 | 有限制 |
| **來源** | 12 英語 + 12 國際 | 1 | 不等 |
| **國際化** | 🌏 韓語、中文、日語、西班牙語 + 翻譯 | 否 | 否 |
| **自託管** | ✅ 一鍵部署 | 否 | 否 |
| **PWA** | ✅ 可安裝 | 否 | 否 |
| **MCP** | ✅ Claude + ChatGPT | 否 | 否 |

---

## 🌍 國際新聞來源

從韓語、中文、日語和西班牙語的 **12 個國際來源**獲取加密貨幣新聞 — 自動翻譯成英語！

### 支援的來源

| 地區 | 來源 |
|--------|---------|
| 🇰🇷 **韓國** | Block Media, TokenPost, CoinDesk Korea |
| 🇨🇳 **中國** | 8BTC (巴比特), Jinse Finance (金色財經), Odaily (星球日報) |
| 🇯🇵 **日本** | CoinPost, CoinDesk Japan, Cointelegraph Japan |
| 🇪🇸 **拉丁美洲** | Cointelegraph Español, Diario Bitcoin, CriptoNoticias |

### 快速範例

```bash
# 獲取所有國際新聞
curl "https://free-crypto-news.vercel.app/api/news/international"

# 獲取韓語新聞並翻譯成英語
curl "https://free-crypto-news.vercel.app/api/news/international?language=ko&translate=true"

# 獲取亞洲地區新聞
curl "https://free-crypto-news.vercel.app/api/news/international?region=asia&limit=20"
```

### 功能特點

- ✅ 透過 Groq AI **自動翻譯**成英語
- ✅ **7 天翻譯快取**提高效率
- ✅ 保留**原文 + 英文**
- ✅ **速率限制**（1 請求/秒）尊重 API
- ✅ 不可用來源的**備用處理**
- ✅ 跨來源**去重**

---

## 📱 漸進式 Web 應用程式（PWA）

Free Crypto News 是一個**完全可安裝的 PWA**，支援離線使用！

### 功能

| 功能 | 描述 |
|---------|-------------|
| 📲 **可安裝** | 在任何裝置上新增至主畫面 |
| 📴 **離線模式** | 無需網路即可閱讀快取新聞 |
| 🔔 **推播通知** | 接收突發新聞提醒 |
| ⚡ **閃電般快速** | 積極的快取策略 |
| 🔄 **背景同步** | 重新上線時自動更新 |

### 安裝應用程式

**桌面（Chrome/Edge）：**
1. 造訪 [free-crypto-news.vercel.app](https://free-crypto-news.vercel.app)
2. 點擊網址列中的安裝圖示（⊕）
3. 點擊「安裝」

**iOS Safari：**
1. 在 Safari 中造訪網站
2. 點擊分享（📤）→「加入主畫面」

**Android Chrome：**
1. 造訪網站
2. 點擊安裝橫幅或選單 →「安裝應用程式」

---

## 來源

我們從 **7 個可信媒體**聚合：

- 🟠 **CoinDesk** — 通用加密貨幣新聞
- 🔵 **The Block** — 機構與研究
- 🟢 **Decrypt** — Web3 與文化
- 🟡 **CoinTelegraph** — 全球加密貨幣新聞
- 🟤 **Bitcoin Magazine** — Bitcoin 極簡主義者
- 🟣 **Blockworks** — DeFi 與機構
- 🔴 **The Defiant** — DeFi 原生

---

## 端點

| 端點 | 描述 |
|----------|-------------|
| `/api/news` | 所有來源的最新新聞 |
| `/api/search?q=bitcoin` | 按關鍵字搜尋 |
| `/api/defi` | DeFi 專題新聞 |
| `/api/bitcoin` | Bitcoin 專題新聞 |
| `/api/breaking` | 僅過去 2 小時 |
| `/api/trending` | 帶情緒的趨勢話題 |
| `/api/analyze` | 帶主題分類的新聞 |
| `/api/stats` | 分析與統計 |

### 🤖 AI 驅動端點（透過 Groq 免費）

| 端點 | 描述 |
|----------|-------------|
| `/api/summarize` | 文章的 AI 摘要 |
| `/api/ask?q=...` | 詢問有關加密貨幣新聞的問題 |
| `/api/digest` | AI 生成的每日摘要 |
| `/api/sentiment` | 每篇文章的深度情緒分析 |

---

## SDK 與元件

| 套件 | 描述 |
|---------|-------------|
| [React](sdk/react/) | `<CryptoNews />` 即插即用元件 |
| [TypeScript](sdk/typescript/) | 完整的 TypeScript SDK |
| [Python](sdk/python/) | 零依賴 Python 客戶端 |
| [JavaScript](sdk/javascript/) | 瀏覽器和 Node.js SDK |
| [Go](sdk/go/) | Go 客戶端函式庫 |
| [PHP](sdk/php/) | PHP SDK |

**基礎 URL：** `https://free-crypto-news.vercel.app`

---

# 自託管

## 一鍵部署

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Ffree-crypto-news)

## 手動

```bash
git clone https://github.com/nirholas/free-crypto-news.git
cd free-crypto-news
pnpm install
pnpm dev
```

開啟 http://localhost:3000/api/news

---

# 授權

MIT © 2025 [nich](https://github.com/nirholas)

---

<p align="center">
  <b>停止為加密貨幣新聞 API 付費。</b><br>
  <sub>用 💜 為社群打造</sub>
</p>

<p align="center">
  <br>
  ⭐ <b>覺得有用？請點星！</b> ⭐<br>
  <a href="https://github.com/nirholas/free-crypto-news/stargazers">
    <img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=social" alt="在 GitHub 上點星">
  </a>
</p>

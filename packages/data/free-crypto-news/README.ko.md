🌐 **언어:** [English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md) | [العربية](README.ar.md) | [Русский](README.ru.md) | [Italiano](README.it.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Türkçe](README.tr.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [Bahasa Indonesia](README.id.md)

---

# 🆓 무료 암호화폐 뉴스 API

<p align="center">
  <a href="https://github.com/nirholas/free-crypto-news/stargazers"><img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=for-the-badge&logo=github&color=yellow" alt="GitHub 스타"></a>
  <a href="https://github.com/nirholas/free-crypto-news/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nirholas/free-crypto-news?style=for-the-badge&color=blue" alt="라이선스"></a>
  <a href="https://github.com/nirholas/free-crypto-news/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nirholas/free-crypto-news/ci.yml?style=for-the-badge&logo=github-actions&label=CI" alt="CI 상태"></a>
</p>

<p align="center">
  <img src=".github/demo.svg" alt="Free Crypto News API 데모" width="700">
</p>

> ⭐ **유용하다면 스타를 눌러주세요!** 다른 사람들이 이 프로젝트를 발견하고 지속적인 개발에 동기를 부여합니다.

---
하나의 API 호출로 7개 주요 소스에서 실시간 암호화폐 뉴스를 받아보세요.

```bash
curl https://free-crypto-news.vercel.app/api/news
```
---

| | Free Crypto News | CryptoPanic | 기타 |
|---|---|---|---|
| **가격** | 🆓 영구 무료 | $29-299/월 | 유료 |
| **API 키** | ❌ 필요없음 | 필수 | 필수 |
| **요청 제한** | 무제한* | 100-1000/일 | 제한 |
| **소스** | 12개 영어 + 12개 국제 | 1 | 다양 |
| **국제화** | 🌏 한국어, 중국어, 일본어, 스페인어 + 번역 | 아니오 | 아니오 |
| **셀프 호스팅** | ✅ 원클릭 배포 | 아니오 | 아니오 |
| **PWA** | ✅ 설치 가능 | 아니오 | 아니오 |
| **MCP** | ✅ Claude + ChatGPT | 아니오 | 아니오 |

---

## 🌍 국제 뉴스 소스

한국어, 중국어, 일본어, 스페인어로 된 **12개 국제 소스**에서 암호화폐 뉴스를 가져옵니다 — 영어로 자동 번역됩니다!

### 지원 소스

| 지역 | 소스 |
|--------|---------|
| 🇰🇷 **한국** | 블록미디어, 토큰포스트, 코인데스크코리아 |
| 🇨🇳 **중국** | 8BTC (바비트), Jinse Finance (진써), Odaily (오데일리) |
| 🇯🇵 **일본** | CoinPost, CoinDesk Japan, Cointelegraph Japan |
| 🇪🇸 **라틴아메리카** | Cointelegraph Español, Diario Bitcoin, CriptoNoticias |

### 빠른 예제

```bash
# 모든 국제 뉴스 가져오기
curl "https://free-crypto-news.vercel.app/api/news/international"

# 한국어 뉴스를 영어로 번역해서 가져오기
curl "https://free-crypto-news.vercel.app/api/news/international?language=ko&translate=true"

# 아시아 지역 뉴스 가져오기
curl "https://free-crypto-news.vercel.app/api/news/international?region=asia&limit=20"
```

### 기능

- ✅ Groq AI를 통한 **자동 영어 번역**
- ✅ 효율성을 위한 **7일 번역 캐시**
- ✅ **원문 + 영문** 보존
- ✅ API 존중을 위한 **속도 제한** (1 요청/초)
- ✅ 소스 불가 시 **우아한 폴백**
- ✅ 소스 간 **중복 제거**

---

## 📱 프로그레시브 웹 앱 (PWA)

Free Crypto News는 오프라인 지원이 되는 **완전히 설치 가능한 PWA**입니다!

### 기능

| 기능 | 설명 |
|---------|-------------|
| 📲 **설치 가능** | 모든 기기에서 홈 화면에 추가 |
| 📴 **오프라인 모드** | 네트워크 없이 캐시된 뉴스 읽기 |
| 🔔 **푸시 알림** | 속보 알림 받기 |
| ⚡ **빠른 속도** | 적극적인 캐싱 전략 |
| 🔄 **백그라운드 동기화** | 온라인 복귀 시 자동 업데이트 |

### 앱 설치

**데스크톱 (Chrome/Edge):**
1. [free-crypto-news.vercel.app](https://free-crypto-news.vercel.app) 방문
2. URL 바의 설치 아이콘 (⊕) 클릭
3. "설치" 클릭

**iOS Safari:**
1. Safari에서 사이트 방문
2. 공유 (📤) → "홈 화면에 추가" 탭

**Android Chrome:**
1. 사이트 방문
2. 설치 배너 탭 또는 메뉴 → "앱 설치"

---

## 소스

**7개 신뢰할 수 있는 매체**에서 집계합니다:

- 🟠 **CoinDesk** — 일반 암호화폐 뉴스
- 🔵 **The Block** — 기관 및 연구
- 🟢 **Decrypt** — Web3 및 문화
- 🟡 **CoinTelegraph** — 글로벌 암호화폐 뉴스
- 🟤 **Bitcoin Magazine** — 비트코인 맥시멀리스트
- 🟣 **Blockworks** — DeFi 및 기관
- 🔴 **The Defiant** — DeFi 네이티브

---

## 엔드포인트

| 엔드포인트 | 설명 |
|----------|-------------|
| `/api/news` | 모든 소스의 최신 뉴스 |
| `/api/search?q=bitcoin` | 키워드로 검색 |
| `/api/defi` | DeFi 관련 뉴스 |
| `/api/bitcoin` | Bitcoin 관련 뉴스 |
| `/api/breaking` | 최근 2시간 이내 |
| `/api/trending` | 감성 분석 포함 트렌딩 토픽 |
| `/api/analyze` | 토픽 분류 포함 뉴스 |
| `/api/stats` | 분석 및 통계 |

### 🤖 AI 기반 엔드포인트 (Groq 무료)

| 엔드포인트 | 설명 |
|----------|-------------|
| `/api/summarize` | 기사 AI 요약 |
| `/api/ask?q=...` | 암호화폐 뉴스 질문하기 |
| `/api/digest` | AI 생성 일일 요약 |
| `/api/sentiment` | 기사별 심층 감성 분석 |

---

## SDK 및 컴포넌트

| 패키지 | 설명 |
|---------|-------------|
| [React](sdk/react/) | `<CryptoNews />` 즉시 사용 컴포넌트 |
| [TypeScript](sdk/typescript/) | 완전한 TypeScript SDK |
| [Python](sdk/python/) | 의존성 없는 Python 클라이언트 |
| [JavaScript](sdk/javascript/) | 브라우저 및 Node.js SDK |
| [Go](sdk/go/) | Go 클라이언트 라이브러리 |
| [PHP](sdk/php/) | PHP SDK |

**Base URL:** `https://free-crypto-news.vercel.app`

---

# 셀프 호스팅

## 원클릭 배포

[![Vercel로 배포](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Ffree-crypto-news)

## 수동

```bash
git clone https://github.com/nirholas/free-crypto-news.git
cd free-crypto-news
pnpm install
pnpm dev
```

http://localhost:3000/api/news 열기

---

# 라이선스

MIT © 2025 [nich](https://github.com/nirholas)

---

<p align="center">
  <b>암호화폐 뉴스 API에 돈을 쓰지 마세요.</b><br>
  <sub>커뮤니티를 위해 💜로 제작됨</sub>
</p>

<p align="center">
  <br>
  ⭐ <b>유용하셨나요? 스타를 눌러주세요!</b> ⭐<br>
  <a href="https://github.com/nirholas/free-crypto-news/stargazers">
    <img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=social" alt="GitHub 스타">
  </a>
</p>

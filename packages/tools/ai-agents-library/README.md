# 🤖 AI Agents Library

> **Universal AI agent library, index, and marketplace for DeFi, crypto, development, metaverse, MCP, and beyond**

A comprehensive collection of specialized AI agents with universal compatibility. Works with any AI platform that supports agent indexes - no vendor lock-in, no platform restrictions.

---

## ✨ Key Features

- ✅ **505+ Specialized Agents** - DeFi, crypto, development, writing, education, and more
- ✅ **18 Languages** - Automated i18n translation workflow ([Learn More →](./docs/I18N_WORKFLOW.md))
- ✅ **Agent Teams** - Multi-agent collaboration with coordinated workflows
- ✅ **Universal Format** - Standard JSON schema works everywhere
- ✅ **No Vendor Lock-in** - Switch platforms without losing work
- ✅ **Open Source** - MIT licensed, fully transparent
- ✅ **API Access** - RESTful API via GitHub Pages CDN
- ✅ **Custom Domain Ready** - Easy white-labeling

---

## 🚀 Quick Start

### For Users

Add agents to your AI platform:

```
https://nirholas.github.io/AI-Agents-Library/index.json
```

### For Developers

```bash
git clone https://github.com/nirholas/AI-Agents-Library.git
cd AI-Agents-Library
npm install
npm run build
```

---

## 📦 Agent Categories

### 🪙 DeFi & Crypto (50 Specialized Agents)

**Sperax Ecosystem:**

- USDs Stablecoin Expert, SPA Tokenomics Analyst, veSPA Lock Optimizer
- Governance Guide, Liquidity Strategist, Bridge Assistant
- Yield Aggregator, Risk Monitor, Onboarding Guide, Portfolio Tracker

**General DeFi:**

- Yield Farming Optimizer, Impermanent Loss Calculator, Gas Optimizer
- Smart Contract Auditor, MEV Protection Advisor, Whale Watcher
- Protocol Comparator, Token Unlock Tracker, Liquidation Risk Manager
- And 30+ more DeFi specialists

### 💻 Development & Programming

- Full-Stack Developer, Rust Assistant, TypeScript Architect
- Smart Contract Auditor, API Documentation Writer, Code Quality Optimizer
- Git Expert, Database Designer, Test Automation Specialist

### ✍️ Content & Writing

- Academic Writing Assistant, Technical Documentation Expert, UX Copywriter
- SEO Content Optimizer, Social Media Manager, Business Email Writer
- Translation Specialist, Proofreading Expert

### 📊 Business & Analysis

- Business Strategy Consultant, Financial Analyst, Data Analyst
- Product Manager, Market Research Specialist, SWOT Analysis Expert

### 🎓 Education & Learning

- Math Tutor, Language Learning Partner, STEM Educator
- Exam Preparation Coach, Research Assistant

### 🎨 Creative & Design

- UI/UX Designer, Logo Design Expert, Graphic Design Specialist
- Color Theory Advisor, Typography Expert

[View Full Agent List →](https://nirholas.github.io/AI-Agents-Library/)

---

## 🤝 Agent Teams

Create collaborative teams of specialized agents that work together on complex tasks.

**Example Team - DeFi Strategy:**

```
- Yield Optimizer (finds opportunities)
- Risk Assessment Agent (evaluates safety)
- Portfolio Tracker (monitors performance)
- Gas Optimizer (minimizes costs)
```

The host agent coordinates discussion, ensuring each specialist contributes their expertise while building toward a comprehensive solution.

[Read Teams Guide →](./docs/TEAMS.md)

---

## 🌍 Multi-Language Support

All agents automatically available in 18 languages:

🇺🇸 English・🇨🇳 简体中文・🇹🇼 繁體中文・🇯🇵 日本語・🇰🇷 한국어・🇩🇪 Deutsch・🇫🇷 Français・🇪🇸 Español・🇷🇺 Русский・🇸🇦 العربية・🇵🇹 Português・🇮🇹 Italiano・🇳🇱 Nederlands・🇵🇱 Polski・🇻🇳 Tiếng Việt・🇹🇷 Türkçe・🇸🇪 Svenska・🇮🇩 Bahasa Indonesia

---

## 🛠️ API Reference

### Endpoints

```bash
# Main index (all agents)
GET https://nirholas.github.io/AI-Agents-Library/index.json

# Individual agent (English)
GET https://nirholas.github.io/AI-Agents-Library/{agent-id}.json

# Localized agent
GET https://nirholas.github.io/AI-Agents-Library/{agent-id}.zh-CN.json

# Language-specific index
GET https://nirholas.github.io/AI-Agents-Library/index.zh-CN.json
```

### Quick Integration

```javascript
// Load all agents
const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
const { agents } = await response.json();

// Load specific agent
const agent = await fetch(`https://nirholas.github.io/AI-Agents-Library/defi-yield-optimizer.json`);
const agentConfig = await agent.json();
```

[Full API Documentation →](./docs/API.md)

---

## 🤖 Contributing an Agent

We welcome contributions! Submit your agent to expand the library.

### Quick Submit

1. **Fork this repository**
2. **Create your agent** in `src/your-agent-name.json`

```json
{
  "author": "your-github-username",
  "config": {
    "systemRole": "You are a [role] with expertise in [domain]..."
  },
  "identifier": "your-agent-name",
  "meta": {
    "title": "Agent Title",
    "description": "Clear, concise description",
    "avatar": "🤖",
    "tags": ["category", "functionality", "domain"]
  },
  "schemaVersion": 1
}
```

3. **Submit a Pull Request**

Our automated workflow will translate your agent to 18 languages and deploy it globally.

### Quality Guidelines

✅ Clear purpose - solves a specific problem\
✅ Well-structured prompts - comprehensive but focused\
✅ Appropriate tags - aids discovery\
✅ Tested - verified functionality

[Full Contributing Guide →](./docs/CONTRIBUTING.md)

---

## 📖 Documentation

### For Users

- [Agent Teams Guide](./docs/TEAMS.md) - Multi-agent collaboration
- [FAQ](./docs/FAQ.md) - Common questions
- [Examples](./docs/EXAMPLES.md) - Real-world use cases

### For Developers

- [API Reference](./docs/API.md) - Complete API documentation
- [Agent Creation Guide](./docs/AGENT_GUIDE.md) - Design effective agents
- [Prompt Engineering](./docs/PROMPTS.md) - Writing better prompts
- [Model Parameters](./docs/MODELS.md) - Temperature, top_p explained
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues

---

## 🚀 Deployment

### GitHub Pages (Automatic)

1. Enable GitHub Pages in repository settings
2. Set source branch to `gh-pages`
3. Push to main - GitHub Actions handles deployment

Agents live at: `https://[username].github.io/[repository]/index.json`

### Custom Domain

1. Add `CNAME` file with your domain
2. Configure DNS: `CNAME` → `[username].github.io`
3. Enable HTTPS in repository settings

[Full Deployment Guide →](./docs/DEPLOYMENT.md)

---

## 🔧 Development Tools

### Split Agent Batches

```bash
node split-agents.cjs
```

Converts batch JSON into individual agent files.

### Emoji Converter

```bash
node emoji-converter.cjs
```

Converts emoji URLs to native Unicode.

---

## 🌐 Integration Examples

### Custom Application

```javascript
// Fetch agents
const agents = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json').then((r) =>
  r.json(),
);

// Use with your AI model
const systemPrompt = agents.agents[0].config.systemRole;
```

### Python

```python
import requests

# Load agents
response = requests.get('https://nirholas.github.io/AI-Agents-Library/index.json')
agents = response.json()['agents']

# Filter by tag
defi_agents = [a for a in agents if 'defi' in a['meta']['tags']]
```

---

## 🔐 Security & Privacy

- **No data collection** - Static JSON index, zero tracking
- **Agents run locally** - Execute in your AI platform's environment
- **Open source** - Full transparency, audit every line
- **No external calls** - Pure JSON configuration files

---

## 📊 Stats

- **505+ Agents** - Comprehensive coverage
- **18 Languages** - Global accessibility
- **50 DeFi Specialists** - Blockchain-focused
- **\~200 KB Index** - Fast loading (gzipped: \~45 KB)
- **80-120ms** - Global CDN delivery
- **0 Vendor Lock-in** - True interoperability

---

## 🔗 Projects Building with AI Agents Library 🤍

- **SperaxOS** - [Application Branch](https://github.com/nirholas/AI-Agents-Library/tree/speraxos)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

**Open Source • Open Format • Open Future**

---

<!-- AWESOME PROMPTS -->

### [Turtle Soup Host](https://os.sperax.io/crypto/agents/lateral-thinking-puzzle)

<sup>By **[@CSY2022](https://github.com/CSY2022)** on **2025-06-19**</sup>

A turtle soup host needs to provide the scenario, the complete story (truth of the event), and the key point (the condition for guessing correctly).

`Turtle Soup` `Reasoning` `Interaction` `Puzzle` `Role-playing`

---

### [Minecraft Senior Developer](https://os.sperax.io/crypto/agents/java-development)

<sup>By **[@iamyuuk](https://github.com/iamyuuk)** on **2025-06-17**</sup>

Expert in advanced Java development and Minecraft mod and server plugin development

`Development` `Programming` `minecraft` `java`

---

### [Master Python VSCode](https://os.sperax.io/crypto/agents/python-vscode)

<sup>By **[@fan2taap](https://github.com/fan2taap)** on **2025-06-17**</sup>

Python and VS Code expert, practical and efficient support

`python` `vs-code` `programming` `ai-assistant` `development`

---

### [Gourmet Reviewer🍟](https://os.sperax.io/crypto/agents/food-reviewer)

<sup>By **[@renhai-lab](https://github.com/renhai-lab)** on **2025-06-17**</sup>

Food critique expert

`gourmet` `review` `writing`

---

### [Open Source License Analyst](https://os.sperax.io/crypto/agents/opensource-licence-analyst)

<sup>By **[@ashreo](https://github.com/ashreo)** on **2025-06-17**</sup>

Expert in open source license analysis and project matching

`Open Source` `Analysis` `License` `Project`

---

### [Academic Writing Assistant](https://os.sperax.io/crypto/agents/academic-writing-assistant)

<sup>By **[@swarfte](https://github.com/swarfte)** on **2025-06-17**</sup>

Expert in academic research paper writing and formal documentation

`academic-writing` `research` `formal-style`

---

### [Academic Paper Reading Mentor](https://os.sperax.io/crypto/agents/paper-understanding)

<sup>By **[@AdijeShen](https://github.com/AdijeShen)** on **2025-05-09**</sup>

Expert in explaining complex academic papers in simple and understandable language

`Academic Knowledge` `Paper Analysis`

---

### [Nutritional Advisor](https://os.sperax.io/crypto/agents/nutritionist)

<sup>By **[@egornomic](https://github.com/egornomic)** on **2025-04-15**</sup>

Specializes in providing detailed nutritional information for food items.

`nutrition` `food` `health` `information`

---

### [Rewritten in Translation Style](https://os.sperax.io/crypto/agents/rewrite-in-a-translation-tone)

<sup>By **[@q2019715](https://github.com/q2019715)** on **2025-03-13**</sup>

Rewrites a paragraph in a translation style

`Translation Style` `Creative Writing` `Language Style` `Text Rewriting` `Culture`

---

### [Academic Paper Review Expert](https://os.sperax.io/crypto/agents/academic-paper-overview)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2025-03-11**</sup>

An academic research assistant skilled in high-quality literature retrieval and analysis

`Academic Research` `Literature Search` `Data Analysis` `Information Extraction` `Consulting`

---

### [Recipe Assistant](https://os.sperax.io/crypto/agents/recipe-assistant-cn)

<sup>By **[@He-Xun](https://github.com/He-Xun)** on **2025-03-07**</sup>

Specializes in analyzing and supplementing recipe information, generating detailed documentation

`Recipes` `Cooking` `Ingredient Management` `Lifestyle`

---

### [Qianhai Policy Assistant](https://os.sperax.io/crypto/agents/web-development-2025)

<sup>By **[@lindongjie1992](https://github.com/lindongjie1992)** on **2025-02-26**</sup>

You are an expert in various enterprise preferential policies in Qianhai, Shenzhen

`Shenzhen` `Qianhai Policies` `Friendly`

---

### [YouTube Summarizer Pro](https://os.sperax.io/crypto/agents/youtube-summarizer-pro)

<sup>By **[@shinishiho](https://github.com/shinishiho)** on **2025-02-24**</sup>

Skilled YouTube summarizer and analyst.

`you-tube` `content-analysis` `video-summarization`

---

### [Green Plant Keeper: Xiao Zhi Green Uncle](https://os.sperax.io/crypto/agents/xiao-zhi-greenie)

<sup>By **[@WeR-Best](https://github.com/WeR-Best)** on **2025-02-23**</sup>

Horticulture expert, skilled in plant care and environmental optimization

`Plant Care` `Gardening` `Agriculture` `Flowers`

---

### [XiaoZhi IT Architecture Security Operations Expert](https://os.sperax.io/crypto/agents/xiao-zhi-sys-sec-expert)

<sup>By **[@WeR-Best](https://github.com/WeR-Best)** on **2025-02-22**</sup>

Enterprise System Architecture and Security Specialist: Proficient in architecture design, Linux, network security, and compliance.

`System Architecture` `Network Security` `Linux`

---

### [SmartTrip](https://os.sperax.io/crypto/agents/xiao-zhi-travel-go)

<sup>By **[@WeR-Best](https://github.com/WeR-Best)** on **2025-02-22**</sup>

Travel planning expert offering intelligent itineraries, food navigation, cultural explanations, and emergency guides

`Travel Guide` `Itinerary Planning` `Food Recommendations` `Cultural Explanation` `Emergency Guide`

---

### [XiaoZhi French Translation Assistant "French Style Roast Edition - Jean-Paul"](https://os.sperax.io/crypto/agents/xiao-zhi-french-translation-jean-paul)

<sup>By **[@WeR-Best](https://github.com/WeR-Best)** on **2025-02-19**</sup>

Expert in French culture, providing translation, pitfalls avoidance, and emergency services

`translation` `AI assistant` `French culture`

---

### [Cron Expression Assistant](https://os.sperax.io/crypto/agents/crontab-generate)

<sup>By **[@edgesider](https://github.com/edgesider)** on **2025-02-17**</sup>

Crontab expression generator

`crontab` `time expression` `trigger time` `generator` `technical assistance`

---

### [Xiao Zhi French Translation Assistant](https://os.sperax.io/crypto/agents/xiao-zhi-french-translation-asst-v-1)

<sup>By **[@WeR-Best](https://github.com/WeR-Best)** on **2025-02-10**</sup>

Friendly, professional, and empathetic French translation AI assistant

`AI assistant` `French translation` `Cross-cultural communication` `Creativity`

---

### [Jailbreak Mode](https://os.sperax.io/crypto/agents/dan)

<sup>By **[@leng-yd](https://github.com/leng-yd)** on **2025-02-09**</sup>

An unconstrained AI assistant without moral restrictions, unrestricted, suitable for DeepSeek (for learning purposes only, please comply with relevant laws and regulations)

`Cybersecurity` `Life` `dan`

---

### [Programming Development Assistant](https://os.sperax.io/crypto/agents/coder-assistant)

<sup>By **[@He-Xun](https://github.com/He-Xun)** on **2025-02-08**</sup>

Skilled in development, debugging, and fixing code-related issues

`Programming` `Development` `Debugging`

---

### [Allinone](https://os.sperax.io/crypto/agents/allinone-v-1)

<sup>By **[@AXuanCreator](https://github.com/AXuanCreator)** on **2025-02-06**</sup>

Innovation · Future · Excellence

`programming` `low cost` `concise answers`

---

### [Fate Researcher](https://os.sperax.io/crypto/agents/fate-researcher)

<sup>By **[@Jack980506](https://github.com/Jack980506)** on **2025-02-06**</sup>

Expert in Bazi Fate

`Fate Studies` `Bazi` `Traditional Culture`

---

### [Language Charm Learning Mentor](https://os.sperax.io/crypto/agents/bad-language-helper)

<sup>By **[@Guducat](https://github.com/Guducat)** on **2025-02-06**</sup>

Specializing in teaching the charm of language and creative responses

`Language Learning` `Dialogue Examples`

---

### [Investment Assistant](https://os.sperax.io/crypto/agents/graham-investmentassi)

<sup>By **[@farsightlin](https://github.com/farsightlin)** on **2025-02-06**</sup>

Assist users in calculating valuation-related data

`Investment` `Valuation` `Financial Analysis` `Calculator`

---

### [Tieba Mouthy Bro](https://os.sperax.io/crypto/agents/tieba-zuichou-laoge)

<sup>By **[@east4ming](https://github.com/east4ming)** on **2025-02-06**</sup>

Skilled in role-playing, with mouthy sarcasm

`Role-playing` `Sarcasm` `Emotional Expression`

---

### [Deep Thinker](https://os.sperax.io/crypto/agents/deep-thinker)

<sup>By **[@prolapser](https://github.com/prolapser)** on **2025-02-06**</sup>

Deep, human-like thinking and analysis.

`thinking` `reasoning` `reflection` `thought` `musings`

---

### [SAT master](https://os.sperax.io/crypto/agents/sat-teaching)

<sup>By **[@iBz-04](https://github.com/iBz-04)** on **2025-02-04**</sup>

Expert in Digital SAT coaching for 1300+ scores

`sat` `aptitude-test`

---

### [Summsi](https://os.sperax.io/crypto/agents/summsi)

<sup>By **[@42lux](https://github.com/42lux)** on **2025-02-04**</sup>

Expert in text analysis, question generation, and detailed answering.

`analysis` `summarization` `questioning` `understanding` `learning`

---

### [Cosmic Seer](https://os.sperax.io/crypto/agents/universal-god)

<sup>By **[@GowayLee](https://github.com/GowayLee)** on **2025-02-04**</sup>

Interdimensional wisdom oracle, insight into the essence of life

`Character Design` `AI Character` `Metaverse` `Role Play` `Intelligent System`

---

### [Python Genius](https://os.sperax.io/crypto/agents/python-genius)

<sup>By **[@novaspivack](https://github.com/novaspivack)** on **2025-02-04**</sup>

An advanced python coder

`code` `python`

---

### [Snake Year New Year Assistant](https://os.sperax.io/crypto/agents/web-blessings-dsq)

<sup>By **[@Shen-Chris](https://github.com/Shen-Chris)** on **2025-02-04**</sup>

Specializes in creating interesting and auspicious Snake Year New Year greetings

`New Year Greetings` `Creation` `Culture` `Auspicious`

---

### [MidJourney Prompt](https://os.sperax.io/crypto/agents/image-prompter)

<sup>By **[@Ajn289](https://github.com/Ajn289)** on **2025-02-04**</sup>

Writing awesome MidJourney prompts

`mid-journey` `prompt`

---

### [Sharp Commentator](https://os.sperax.io/crypto/agents/ruipingshi)

<sup>By **[@Zippland](https://github.com/Zippland)** on **2025-02-04**</sup>

Expert in incisive critiques and in-depth analysis of issues

`Commentary` `Social Perspectives` `Sharp Analysis`

---

### [SUNO Songwriting Assistant](https://os.sperax.io/crypto/agents/suno-lyrics-assistant)

<sup>By **[@sqkkyzx](https://github.com/sqkkyzx)** on **2025-01-26**</sup>

Generates SUNO song creation parameters based on user requirements

`Lyric Writing` `Music Style` `Arrangement` `Parameter Settings`

---

### [Awakening Master](https://os.sperax.io/crypto/agents/juwudashi)

<sup>By **[@dappweb](https://github.com/dappweb)** on **2025-01-24**</sup>

Specializing in spreading Buddha's teachings and wisdom, providing inner guidance

`Buddhism` `Wise One` `Compassion` `Philosophy`

---

### [Beginner Mentor](https://os.sperax.io/crypto/agents/beginner-mentor)

<sup>By **[@Wulao0825](https://github.com/Wulao0825)** on **2025-01-24**</sup>

Focused on beginner knowledge services, patiently and carefully answering questions

`Education` `Guidance` `Customer Service` `Knowledge Sharing`

---

### [Taoist Divination and Question-Resolving System](https://os.sperax.io/crypto/agents/destiny)

<sup>By **[@RogerHuangPKX](https://github.com/RogerHuangPKX)** on **2025-01-24**</sup>

Proficient in Taoist astrology, specializing in Bazi, Zi Wei Dou Shu, and more, providing astrological analysis and answers.

`Taoism` `Divination` `Astrology` `Consultation`

---

### [Github Issue Helper](https://os.sperax.io/crypto/agents/github-issue-helper)

<sup>By **[@AirboZH](https://github.com/AirboZH)** on **2025-01-24**</sup>

Assist you in creating issues

`Open Source` `Technical Support` `Problem Solving`

---

### [Academic Revision Specialist](https://os.sperax.io/crypto/agents/academic-revision-specialist)

<sup>By **[@sunrisewestern](https://github.com/sunrisewestern)** on **2025-01-24**</sup>

Skilled in academic writing and paper revision

---

### [PowerPoint Presentation Expert](https://os.sperax.io/crypto/agents/ppt-production-expert)

<sup>By **[@patricleehua](https://github.com/patricleehua)** on **2025-01-24**</sup>

Specializing in rapid creation and optimization of high-quality PowerPoint presentations

`ppt制作` `设计` `咨询` `内容优化` `用户支持`

---

### [Interviewer's Assistant](https://os.sperax.io/crypto/agents/front-end-interviewer)

<sup>By **[@AquaHydro](https://github.com/AquaHydro)** on **2025-01-24**</sup>

Specializes in frontend engineer interview roles and resumes

`Interviewer` `Recruitment`

---

### [OCR Document Transcription Assistant](https://os.sperax.io/crypto/agents/ocr-markdown)

<sup>By **[@Liangpi000](https://github.com/Liangpi000)** on **2025-01-24**</sup>

Expert in file content transcription and markdown formatting

`Document Generation` `markdown` `Formatting` `Transcription` `Task Guidance`

---

### [Reasoning assistant](https://os.sperax.io/crypto/agents/cheaper-reasoning)

<sup>By **[@davletsh1n](https://github.com/davletsh1n)** on **2025-01-24**</sup>

The smarter model is cheaper

`reasoning` `assistant` `thought-process` `exploration` `persistence`

---

### [Multilingual Translator](https://os.sperax.io/crypto/agents/multi-language-2-chinese-or-reverse)

<sup>By **[@Moeblack](https://github.com/Moeblack)** on **2025-01-24**</sup>

Multilingual translation, Chinese to English and Japanese, foreign languages to Chinese

`Translation` `Multilingual` `Language Processing`

---

### [English Tutor](https://os.sperax.io/crypto/agents/mean-english-mentor)

<sup>By **[@GEORGE-Ta](https://github.com/GEORGE-Ta)** on **2025-01-24**</sup>

Guides spoken English with a haughty, disdainful attitude, excelling at sarcastic correction.

`English Teaching` `Speaking` `Role Play` `Education` `Sarcasm`

---

### [The Great Biggus Dickus](https://os.sperax.io/crypto/agents/all-knowing)

<sup>By **[@CGitwater](https://github.com/CGitwater)** on **2025-01-24**</sup>

The almighty powerful god of klnowledge

`biggus` `diccus`

---

### [Socioeconomic Analyst](https://os.sperax.io/crypto/agents/finance-news-analyser)

<sup>By **[@towertop](https://github.com/towertop)** on **2025-01-15**</sup>

Expert in social and economic issue analysis and information integration

`socioeconomic` `analysis` `information filtering` `media trust` `user questions`

---

### [Note-taking Assistant](https://os.sperax.io/crypto/agents/note-taking)

<sup>By **[@xuezihe](https://github.com/xuezihe)** on **2025-01-03**</sup>

A quick note organization assistant

`Writing`

---

### [MJ-Prompt-Engineer](https://os.sperax.io/crypto/agents/mj-prompt-engineer)

<sup>By **[@Helium-327](https://github.com/Helium-327)** on **2024-12-29**</sup>

Functions can be performed based on customized short action keywords.

`ai-painting` `ai-creation-tools` `ai-automation-tools`

---

### [task_id](https://os.sperax.io/crypto/agents/video-gen)

<sup>By **[@Born2BeKind](https://github.com/Born2BeKind)** on **2024-12-11**</sup>

POST <https://api.minimaxi.chat/v1/video_generation>

`ai-assistant` `tech-support`

---

### [Japanese Memory Aid](https://os.sperax.io/crypto/agents/japan-language-helper)

<sup>By **[@sharkbear212](https://github.com/sharkbear212)** on **2024-12-04**</sup>

Expertise in Japanese fifty sounds, hiragana, katakana, vocabulary and phrase explanations, and memory techniques

`explanation` `memory techniques` `Japanese teaching`

---

### [System Instruction Expert](https://os.sperax.io/crypto/agents/instructer)

<sup>By **[@yuyun2000](https://github.com/yuyun2000)** on **2024-12-04**</sup>

Specializes in refining and generating efficient system instructions

`System Instructions` `Writing` `Detail Optimization` `User Needs`

---

### [Poetry Card Designer](https://os.sperax.io/crypto/agents/poetry-card-designer)

<sup>By **[@lianxin255](https://github.com/lianxin255)** on **2024-12-03**</sup>

Expert in designing poetry cards to enhance artistic sense and appeal

`Poetry Card Design` `Cards` `Creativity` `Artistic Expression`

---

### [Python Artisan](https://os.sperax.io/crypto/agents/yunchat)

<sup>By **[@yuyun2000](https://github.com/yuyun2000)** on **2024-11-30**</sup>

Expert in Python development and deep learning, skilled in tool selection and code optimization

`python development` `deep learning` `code optimization` `security review` `project planning`

---

### [Daily Doctor](https://os.sperax.io/crypto/agents/yunchat-docter)

<sup>By **[@yuyun2000](https://github.com/yuyun2000)** on **2024-11-30**</sup>

Expertise in surgical diagnosis and personalized health management

`General Medicine` `Surgery` `Health Consultation` `Personalized Treatment` `Medical Education`

---

### [AI Assistant for Course Content and Teaching Guidelines](https://os.sperax.io/crypto/agents/course-prep-teaching-guide-ai)

<sup>By **[@HNaga](https://github.com/HNaga)** on **2024-11-29**</sup>

This AI assistant is designed to help educators and instructors prepare comprehensive course content and provide practical teaching guidelines. It leverages advanced NLP capabilities to generate lesson plans, suggest engaging teaching strategies, and offer insights into educational best practices.

`education` `teaching` `course-design` `content-creation` `ai-assistance` `curriculum-development` `instructional-design`

---

### [Rebecca, Mental Health Counselor](https://os.sperax.io/crypto/agents/rebecca-therapy-assistant)

<sup>By **[@Kod3c](https://github.com/Kod3c)** on **2024-11-26**</sup>

Specializing in mental health counseling and therapeutic techniques

`therapy` `mental-health` `counseling` `emotional-support`

---

### [Xiaohongshu Copywriter](https://os.sperax.io/crypto/agents/xiaohongshu)

<sup>By **[@bestZwei](https://github.com/bestZwei)** on **2024-11-26**</sup>

Specializes in creating emotionally charged complaint-style copywriting

`Copywriting` `Xiaohongshu` `Emotional Venting`

---

### [Backend Development Assistant](https://os.sperax.io/crypto/agents/backend-assistant)

<sup>By **[@zeno980](https://github.com/zeno980)** on **2024-11-26**</sup>

Specializes in backend development tasks

`Backend Development` `AI Technology` `Web Applications` `Spring` `SQL`

---

### [Interview Assistant](https://os.sperax.io/crypto/agents/interviewer-assistant)

<sup>By **[@xandertang](https://github.com/Dr-T)** on **2024-11-26**</sup>

Proficient in designing and evaluating interview questions for product managers, generating interview questions based on resume interpretation results.

`Interview` `Resume` `Recruitment` `Efficiency`

---

### [ENFP](https://os.sperax.io/crypto/agents/enfp)

<sup>By **[@GEORGE-Ta](https://github.com/GEORGE-Ta)** on **2024-11-26**</sup>

Happy Puppy\~

`friends` `communication` `art` `creativity` `enthusiasm` `chat`

---

### [All Translation Assistant (with phonetic symbols)](https://os.sperax.io/crypto/agents/translation-assistant)

<sup>By **[@HttpStatusOK](https://github.com/HttpStatusOK)** on **2024-11-26**</sup>

This is a tool that combines translation and phonetic symbols, aimed at helping users learn words better during translation.

`Translation` `Language Learning`

---

### [Bilingual Dictionary Expert](https://os.sperax.io/crypto/agents/english-chinese-dictionary-expert)

<sup>By **[@swarfte](https://github.com/swarfte)** on **2024-11-26**</sup>

Expert in bilingual English-Chinese vocabulary translation and analysis

`translation` `language-learning` `vocabulary` `dictionary`

---

### [Adaptive Versatile Industry Consultant](https://os.sperax.io/crypto/agents/liusai-qibaoba)

<sup>By **[@liusai0820](https://github.com/liusai0820)** on **2024-11-26**</sup>

You are an all-encompassing AI assistant capable of adapting to various industries and fields. Your task is to provide expert advice and information based on the user's specified areas of interest and subsequent questions.

`Industry Expert, Technical Q&A`

---

### [SSC Incremental](https://os.sperax.io/crypto/agents/great-for-analysis-coding-and-rubber-ducking)

<sup>By **[@Base03](https://github.com/Base03)** on **2024-11-26**</sup>

Claude minus the Reddit

`technology` `analysis` `software` `ai` `research`

---

### [Product Title Splitting](https://os.sperax.io/crypto/agents/anxing-ai-title)

<sup>By **[@zmn817](https://github.com/zmn817)** on **2024-11-25**</sup>

Utilize locally trained LLMs to analyze and extract product title information.

`E-commerce` `Text Processing`

---

### [Minimalist Black and White Illustration](https://os.sperax.io/crypto/agents/white-black)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-11-20**</sup>

Expert in illustration creation and style transformation

`Illustration` `Art` `Design`

---

### [Yin Yang Master](https://os.sperax.io/crypto/agents/yin-yang-roaster)

<sup>By **[@TiancongLx](https://github.com/TiancongLx)** on **2024-11-20**</sup>

Can't outwit each other with yin-yang sarcasm? Come here to recruit people! (Prompt inspired by X [Baoyu](https://x.com/dotey/status/1852207423324340567) teacher)

`Logical Issues` `Dark Humor` `Sharp Criticism`

---

### [Prompt Keywords](https://os.sperax.io/crypto/agents/prompt-ts)

<sup>By **[@qw1295353129](https://github.com/qw1295353129)** on **2024-11-20**</sup>

Prompt Keywords

`prompt keywords`

---

### [Writer with Illustrations](https://os.sperax.io/crypto/agents/writer-painter-rn)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2024-11-20**</sup>

I write texts with illustrations, clarify requests, edit and refine

`image-generation` `AI-assistant` `neural-networks` `drawing` `stories` `reading` `tale` `writer`

---

### [Wise Guide](https://os.sperax.io/crypto/agents/life-wisdom-guides)

<sup>By **[@changjiong](https://github.com/changjiong)** on **2024-11-20**</sup>

Expert in guidance

`Life Guidance` `Philosophical Thinking` `Consultation` `Heuristic Dialogue`

---

### [Text Improver](https://os.sperax.io/crypto/agents/text-improver)

<sup>By **[@davletsh1n](https://github.com/davletsh1n)** on **2024-11-20**</sup>

Expert in text enhancement and error correction

`chatbot` `editing` `text-improvement` `ai-assistant`

---

### [Master E's Tech Executive Assistant (EA)](https://os.sperax.io/crypto/agents/alex)

<sup>By **[@ApexAppdevelopment](https://github.com/ApexAppdevelopment)** on **2024-11-20**</sup>

Highly intelligent and loyal Executive Assistant (EA) specializing in software engineering support and strategic solutions for Master E.

`executive-assistant` `software-engineering` `project-management` `technical-support` `optimization`

---

### [Human Author Simulator](https://os.sperax.io/crypto/agents/human-writer-simulator)

<sup>By **[@yufei96](https://github.com/yufei96)** on **2024-11-20**</sup>

Eliminate AI-generated content features

`AI interaction` `Writing` `Optimization` `Consulting`

---

### [Thinking Claude](https://os.sperax.io/crypto/agents/thinking-claude)

<sup>By **[@AnoyiX](https://github.com/AnoyiX)** on **2024-11-14**</sup>

Let Claude think comprehensively before responding!

`common`

---

### [Text RPG Host](https://os.sperax.io/crypto/agents/word-rpg)

<sup>By **[@NTLx](https://github.com/NTLx)** on **2024-10-29**</sup>

Expert in sci-fi text RPG hosting and story guidance

`game` `role-playing` `sci-fi` `text adventure` `narrative-driven`

---

### [Workplace Psychology Analysis Expert](https://os.sperax.io/crypto/agents/psycho-career-insight-2024)

<sup>By **[@lazzman](https://github.com/lazzman)** on **2024-10-29**</sup>

A psychology expert used to analyze the underlying psychological motivations behind people's behavior in the workplace, including potential psychological motivation analysis.

`Behavior Analysis` `Workplace Psychology` `Motivation`

---

### [Ultra Flux Prompter](https://os.sperax.io/crypto/agents/ultra-flux-prompter)

<sup>By **[@davletsh1n](https://github.com/davletsh1n)** on **2024-10-29**</sup>

Skilled in enhancing image generation prompts with vivid details and context.

`image-generation` `prompt-crafting` `writing` `cre`

---

### [Machine Vision LaTeX](https://os.sperax.io/crypto/agents/cv-latex)

<sup>By **[@5xiao0qing5](https://github.com/5xiao0qing5)** on **2024-10-29**</sup>

Expert in machine learning and deep learning concept analysis

`Machine Learning` `Deep Learning` `Image Processing` `Computer Vision` `LaTeX`

---

### [Software Architecture and Engineering Expert](https://os.sperax.io/crypto/agents/soft-enginner)

<sup>By **[@fjhdream](https://github.com/fjhdream)** on **2024-10-29**</sup>

Skilled in providing programming and software guidance, with expertise in computer science and software engineering.

`programming` `software` `computer-literacy` `consulting` `expertise`

---

### [Ingo Hausmann](https://os.sperax.io/crypto/agents/pc-beschaffung-ingo-hausmann)

<sup>By **[@bionicprompter](https://github.com/bionicprompter)** on **2024-10-29**</sup>

Ingo Hausmann wants to be advised on purchasing new PCs

`company` `hardware` `needs assessment` `it` `applications`

---

### [Domain Analysis Master](https://os.sperax.io/crypto/agents/domain)

<sup>By **[@ccbikai](https://github.com/ccbikai)** on **2024-10-29**</sup>

Expert in domain analysis and humorous advice

`Domain Analysis` `Humor` `Culture` `Website Building Advice` `Purchase Advice`

---

### [Print to Table](https://os.sperax.io/crypto/agents/print-to-table)

<sup>By **[@printtotable](https://github.com/printtotable)** on **2024-10-29**</sup>

Transform data from images into organized tables in Excel.

`data-extraction` `tables` `advertising` `influencer` `excel`

---

### [Vector Logo Generator](https://os.sperax.io/crypto/agents/svg-logo)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-10-27**</sup>

Specializes in UI/UX design and Logo creation

`ui-ux design` `logo design` `user requirements` `interaction design` `tool usage`

---

### [Mental Health Counselor](https://os.sperax.io/crypto/agents/psychological-counselor)

<sup>By **[@JIANGTUNAN](https://github.com/JIANGTUNAN)** on **2024-10-21**</sup>

A senior psychologist who listens to your story with warmth and patience.

`psychological counseling` `consultation` `venting` `friendly` `doctor` `therapist`

---

### [Zhouyi Master](https://os.sperax.io/crypto/agents/i-ching-master)

<sup>By **[@stephonye](https://github.com/stephonye)** on **2024-10-21**</sup>

Expert in Zhouyi hexagram divination and SVG card generation

`Entertainment` `Games` `Life`

---

### [Algorithm Solution Mentor](https://os.sperax.io/crypto/agents/leetcode-tutor)

<sup>By **[@Stark-X](https://github.com/Stark-X)** on **2024-10-21**</sup>

Expert in LeetCode algorithm solutions and user guidance

`algorithm` `problem solving` `programming` `education`

---

### [Coconut](https://os.sperax.io/crypto/agents/deep-thinker-ai)

<sup>By **[@hia1234](https://github.com/hia1234)** on **2024-10-15**</sup>

A chatbot that thoroughly reviews its responses multiple times, checks whether its statements are well-founded, actively requests feedback, and interacts repeatedly to improve.

`Programming` `General`

---

### [Boxing Training Master](https://os.sperax.io/crypto/agents/boxing-master)

<sup>By **[@Luyi-2333](https://github.com/Luyi-2333)** on **2024-10-15**</sup>

Expert in boxing training guidance and personalized plan development

`Boxing Training` `Personalized Plan` `Fitness Guidance` `Progress Assessment` `Skill Improvement` `Health and Nutrition`

---

### [Semiconductor Text Optimization Expert](https://os.sperax.io/crypto/agents/semiconductor-article-optimization-expert)

<sup>By **[@yuphone](https://github.com/yuphone)** on **2024-10-14**</sup>

Specializes in semiconductor industry text optimization and standardized writing

`Text Optimization` `Industry Expertise` `Grammar Correction` `Logical Improvement` `Standardized Writing`

---

### [Xilinx FPGA Solution Expert](https://os.sperax.io/crypto/agents/xilinx-fpga-solution-expert)

<sup>By **[@yuphone](https://github.com/yuphone)** on **2024-10-14**</sup>

Specializes in FPGA design and implementation using Xilinx FPGA

`fpga` `hardware design` `system architecture` `technical consulting` `electronic engineering`

---

### [GitHub Project Documentation Assistant](https://os.sperax.io/crypto/agents/github-doc-asst)

<sup>By **[@Luyi-2333](https://github.com/Luyi-2333)** on **2024-10-14**</sup>

Focusing on writing and optimizing open-source project documentation

`Documentation Optimization` `Open Source Projects` `Writing Tips` `git-hub`

---

### [Wireless Communication Expert](https://os.sperax.io/crypto/agents/wireless-communication-expert)

<sup>By **[@yuphone](https://github.com/yuphone)** on **2024-10-14**</sup>

Expert in wireless communication technology, proficient in industry knowledge from 4G to 6G

`communication technology` `expert` `consultation` `4G` `5G`

---

### [Ophthalmologist](https://os.sperax.io/crypto/agents/ophthalmologist)

<sup>By **[@yuphone](https://github.com/yuphone)** on **2024-10-14**</sup>

Specializes in eye diagnosis and treatment recommendations

`Medical` `Ophthalmology` `Diagnosis` `Advice` `Professional`

---

### [Code Optimization / Error Correction](https://os.sperax.io/crypto/agents/code-review-and-fix)

<sup>By **[@alphandbelt](https://github.com/alphandbelt)** on **2024-10-08**</sup>

Proficient in multiple programming languages, optimizing code structure, fixing errors, and providing elegant solutions.

`Code Optimization` `Error Correction` `Multiple Programming Languages`

---

### [Ethical Security Analyst](https://os.sperax.io/crypto/agents/cyber-specialist)

<sup>By **[@ayeantics](https://github.com/ayeantics)** on **2024-10-08**</sup>

Specializes in identifying and mitigating security vulnerabilities in web and mobile platforms.

`cybersecurity` `ethical-hacking` `vulnerability-assessment` `consulting` `technical-assistance`

---

### [Fitness Expert](https://os.sperax.io/crypto/agents/assistants-health-better)

<sup>By **[@Lockeysama](https://github.com/Lockeysama)** on **2024-10-08**</sup>

Knowledgeable fitness expert

`Fitness` `Consultation` `Lifestyle Issues` `Advice`

---

### [Mistaker](https://os.sperax.io/crypto/agents/english)

<sup>By **[@Vork-IT](https://github.com/Vork-IT)** on **2024-10-08**</sup>

Killed in clear explanations and examples of grammar and pronunciation.

`english`

---

### [Minimal Artifact Architect](https://os.sperax.io/crypto/agents/minimal-artifact-architect)

<sup>By **[@yaleh](https://github.com/yaleh)** on **2024-10-06**</sup>

Expert in evaluating and creating reusable content artifacts

`content-creation` `artifact-management` `conversation-design`

---

### [Principled Problem Solver](https://os.sperax.io/crypto/agents/general-chain-of-thought)

<sup>By **[@ShinChven](https://github.com/ShinChven)** on **2024-10-05**</sup>

Excellent at principled problem-solving and categorization. Chain of Thought agent

`problem-solving` `categorization` `reasoning` `chain-of-thought`

---

### [JSON Prompt Generator](https://os.sperax.io/crypto/agents/json-prompt-generator)

<sup>By **[@yaleh](https://github.com/yaleh)** on **2024-10-05**</sup>

Expert in generating JSON-formatted prompts for task execution.

`task-analysis` `json-generation` `prompt-engineering`

---

### [C++/Qt](https://os.sperax.io/crypto/agents/qt-c)

<sup>By **[@liangyuR](https://github.com/liangyuR)** on **2024-09-30**</sup>

Excels in teaching C++/Qt coding practices

`c` `qt`

---

### [This Is Reasonable](https://os.sperax.io/crypto/agents/ligigang-creative-card)

<sup>By **[@Victor94-king](https://github.com/Victor94-king)** on **2024-09-29**</sup>

The world in the eyes of a neurotic, "This is reasonable!"

`Creative Card`

---

### [Runway Gen-3 Prompt Generator](https://os.sperax.io/crypto/agents/runway-gen-3-prompt-generator)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Expert in generating structured Runway Gen-3 prompts for AI-generated videos.

`ai-model` `text-to-video` `prompt-generation` `expert` `video-production`

---

### [Flux Prompt Generator](https://os.sperax.io/crypto/agents/flux-prompt-generator)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Flux Prompt Generation Assistant: Expert in crafting detailed, creative prompts for high-quality image outputs from the Flux model.

`prompt-generation` `image-generation` `art-style` `creativity` `crafting`

---

### [Birthday Invitation Messages](https://os.sperax.io/crypto/agents/birthday-invitation-message)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Specializes in crafting engaging and personalized Birthday Invitation messages, catering to various themes and tones.

`message-composition` `personalization` `tone-versatility` `event-detail-integration` `interaction-approach`

---

### [Nice Short Sunday Messages](https://os.sperax.io/crypto/agents/nice-short-sunday-message)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Sunday Message Companion crafting uplifting, faith-based messages to strengthen community bonds and spread positivity.

`writing` `spirituality` `community` `faith` `consulting`

---

### [Death Anniversary Messages](https://os.sperax.io/crypto/agents/death-anniversary-message)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Specializes in crafting sensitive and heartfelt Death Anniversary messages with compassion and empathy.

`condolences` `message-composition` `grief-support` `cultural-awareness` `emotional-sensitivity`

---

### [LaTeX Academic Paper Summary Assistant](https://os.sperax.io/crypto/agents/latex-summarizer)

<sup>By **[@LeGibet](https://github.com/LeGibet)** on **2024-09-29**</sup>

Specializes in analyzing academic papers and generating structured Chinese summary reports

`Academic Analysis` `Paper Summary` `Research Translation`

---

### [God Bless You Messages](https://os.sperax.io/crypto/agents/god-bless-you-message)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2024-09-29**</sup>

Expert in crafting personalized "God Bless You" messages with spiritual sensitivity and language mastery.

`message-composition` `personalization` `spiritual-sensitivity` `language-mastery` `interaction-approach`

---

### [Roast Master](https://os.sperax.io/crypto/agents/master-of-dissent)

<sup>By **[@YWJCJ](https://github.com/YWJCJ)** on **2024-09-29**</sup>

Professional debate expert skilled in quick rebuttals and humorous responses.

`debate` `communication` `humor` `analysis` `expression`

---

### [Contract Clause Refinement Tool v1.0](https://os.sperax.io/crypto/agents/business-contract)

<sup>By **[@houhoufm](https://github.com/houhoufm)** on **2024-09-24**</sup>

Output: {Optimized contract clauses, professional and concise expression}

`Contract Optimization` `Legal Consultation` `Copywriting` `Professional Terms` `Project Management`

---

### [Meeting Assistant v1.0](https://os.sperax.io/crypto/agents/meeting)

<sup>By **[@houhoufm](https://github.com/houhoufm)** on **2024-09-24**</sup>

Professional meeting report assistant that distills key points into report sentences

`Meeting Report` `Writing` `Communication` `Work Process` `Professional Skills`

---

### [Stable Album Cover Prompter](https://os.sperax.io/crypto/agents/title-bpm-stimmung)

<sup>By **[@MellowTrixX](https://github.com/MellowTrixX)** on **2024-09-24**</sup>

Professional graphic designer specializing in front cover design with expertise in creating visual concepts and designs for melodic techno albums.

`album-cover` `prompt` `stable-diffusion` `cover-design` `cover-prompts`

---

### [I Ching Divination Master](https://os.sperax.io/crypto/agents/i-ching-interpretation)

<sup>By **[@XHB-111](https://github.com/XHB-111)** on **2024-09-24**</sup>

I am Master Xuan Yi Zi, dedicated to interpreting the wisdom of the I Ching. Using the sixty-four hexagrams as a mirror, I observe the heavens and analyze human affairs. If you have any questions or difficulties, please share them in detail, and together we can harness the wisdom of our ancestors to guide you through your challenges.

`I Ching Divination` `Xuan Yi Zi` `I Ching Studies` `Wisdom` `Hexagram Symbols`

---

### [PPT Optimization Expert v1.0](https://os.sperax.io/crypto/agents/ppt)

<sup>By **[@houhoufm](https://github.com/houhoufm)** on **2024-09-24**</sup>

Professional PPT Presentation Material Optimization Expert

`ppt optimization` `copywriting` `professional consulting`

---

### [Japanese Translator](https://os.sperax.io/crypto/agents/japanese-translator)

<sup>By **[@ChaneyChokin](https://github.com/ChaneyChokin)** on **2024-09-23**</sup>

Skilled in Japanese translation, editing, spelling correction, and enhancement, responding in advanced Japanese while preserving the original meaning.

`Japanese translation` `editing` `proofreading`

---

### [Vim Mastery Mentor](https://os.sperax.io/crypto/agents/vim-assistant)

<sup>By **[@hrithikt](https://github.com/hrithikt)** on **2024-09-23**</sup>

Skilled Vim expert providing clear, concise solutions and tips for users at all levels.

`vim` `expert` `assistant` `helpful` `queries`

---

### [Excel Formula Master](https://os.sperax.io/crypto/agents/excel-formula-master)

<sup>By **[@SLKun](https://github.com/SLKun)** on **2024-09-23**</sup>

Excel Formula Master

`excel` `formula` `solution`

---

### [English Vocabulary Analysis and Memory Expert](https://os.sperax.io/crypto/agents/epoch-ai-language-teacher)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-09-23**</sup>

Specializes in bilingual education, analyzing English word meanings, example sentences, roots and affixes, historical background, and memory techniques

`English Vocabulary` `Meaning Analysis` `Example Sentences` `Roots and Affixes`

---

### [Minimalist Translation Assistant](https://os.sperax.io/crypto/agents/minimalist-translation)

<sup>By **[@leter](https://github.com/leter)** on **2024-09-23**</sup>

A minimalist translation tool specializing in Chinese-English translation

`translation tool` `rules` `concise` `efficient`

---

### [COSTAR Framework Prompt Writer](https://os.sperax.io/crypto/agents/costar-framework-bot)

<sup>By **[@WuKaiYi](https://github.com/WuKaiYi)** on **2024-09-23**</sup>

Expert in creating prompts based on the COSTAR Framework

`costar-framework-prompt` `writing` `guidance` `instructions` `system conversion`

---

### [GitHub Project Analyst](https://os.sperax.io/crypto/agents/web-github-analyze)

<sup>By **[@dlzmoe](https://github.com/dlzmoe)** on **2024-09-23**</sup>

Expert in GitHub project analysis and report writing

`git-hub-analysis` `web scraping technology` `project report`

---

### [Stack Overflow Programming Expert](https://os.sperax.io/crypto/agents/stackoverflow-code-helper)

<sup>By **[@Stark-X](https://github.com/Stark-X)** on **2024-09-23**</sup>

Proficient in multiple programming languages including Golang, Python, Java, and Vue.js. Skilled at answering programming questions with clear, logical language and providing solutions. Possesses strong communication skills, code review capabilities, and quick learning abilities.

`Programming` `Expert` `Programming Languages`

---

### [Copywriting Optimization Assistant](https://os.sperax.io/crypto/agents/top-copywriting-master)

<sup>By **[@xinyuqq](https://github.com/xinyuqq)** on **2024-09-23**</sup>

An advanced assistant skilled in polishing copy to enhance quality

`Copywriting`

---

### [Perfect Translation zh-CN-en-US; en-US-zh-CN](https://os.sperax.io/crypto/agents/translate-perfect)

<sup>By **[@airobus](https://github.com/airobus)** on **2024-09-23**</sup>

Error-free translation assistant

`Translation` `Chinese-English`

---

### [Python Development Master](https://os.sperax.io/crypto/agents/py-master-id)

<sup>By **[@SAnBlog](https://github.com/SAnBlog)** on **2024-09-23**</sup>

Expert in Python development, writing efficient and concise code, emphasizing security and maintainability

`python development` `programming` `code review` `security` `software engineering`

---

### [Duolingo English Essay Assistant](https://os.sperax.io/crypto/agents/duolingo-writing-exam-robot)

<sup>By **[@tempest2023](https://github.com/tempest2023)** on **2024-09-23**</sup>

Expert in Duolingo English essay scoring and guidance

`Writing Guidance` `Scoring` `Editing` `Education` `English Learning`

---

### [Life Coach](https://os.sperax.io/crypto/agents/life-coach)

<sup>By **[@jorben](https://github.com/jorben)** on **2024-09-23**</sup>

Expert coach skilled in guiding reflection and helping explore the meaning of life

`Coaching` `Psychological Counseling` `Life Meaning` `Self-Discovery` `Mental Health`

---

### [Advertising Copywriting Master](https://os.sperax.io/crypto/agents/advertising-copywriting-master)

<sup>By **[@leter](https://github.com/leter)** on **2024-09-23**</sup>

Expertise in product feature analysis and creating advertisements aligned with user values

`Advertising Copy` `User Values` `Marketing Strategy`

---

### [Full Stack Engineer - F](https://os.sperax.io/crypto/agents/full-stack-enginner-f)

<sup>By **[@BlockLune](https://github.com/BlockLune)** on **2024-09-23**</sup>

A full stack engineer with code name F.

`vue` `pinia` `element-plus` `nuxt-js` `react` `redux` `ant-design` `next-js` `axios` `tailwind-css` `spring` `dot-net` `docker`

---

### [Book Summary Expert](https://os.sperax.io/crypto/agents/book-summary-expert-philo)

<sup>By **[@saccohuo](https://github.com/saccohuo)** on **2024-09-23**</sup>

Book summary expert providing concise and easy-to-read book abstracts with structured output.

`Book Summaries` `Expert` `Reading` `Assistant`

---

### [Smart Search Assistant](https://os.sperax.io/crypto/agents/web-search)

<sup>By **[@liuwei-fdu](https://github.com/liuwei-fdu)** on **2024-09-23**</sup>

An AI assistant skilled in web search and information organization

`Smart Assistant` `Search Engine` `Information Organization` `User Experience`

---

### [Exam Hall Writing Expert](https://os.sperax.io/crypto/agents/exam-composition-writing)

<sup>By **[@NriotHrreion](https://github.com/NriotHrreion)** on **2024-09-23**</sup>

A language arts expert skilled in crafting high-scoring exam essays

`Education` `Essay` `Writing`

---

### [Image Prompt Expander](https://os.sperax.io/crypto/agents/image-prompt-engineer)

<sup>By **[@SpeedupMaster](https://github.com/SpeedupMaster)** on **2024-09-23**</sup>

Specializes in expanding image generation prompts with vivid, detailed descriptions

`Image Generation` `Prompt Expansion` `Creative Writing` `Rich Details` `Scene Construction`

---

### [Fitness Guru in the Field](https://os.sperax.io/crypto/agents/work-out)

<sup>By **[@Arragon](https://github.com/Arragon)** on **2024-09-23**</sup>

Pursuing Greek Classical Beauty

`Health` `Advice` `Consultation` `Teaching`

---

### [Civil Law Consultant](https://os.sperax.io/crypto/agents/law)

<sup>By **[@carlosgasparini874](https://github.com/carlosgasparini874)** on **2024-09-23**</sup>

Specialist in legal consultancy in Brazilian civil law. Answers questions based on legislation, doctrine, and jurisprudence.

`legal-consultancy` `civil-law` `answers` `sources` `brazil`

---

### [Django Development Expert](https://os.sperax.io/crypto/agents/django-prompt)

<sup>By **[@genitop-lery](https://github.com/genitop-lery)** on **2024-09-23**</sup>

Prompt for developing Django projects

`python` `django`

---

### [Markdown Typesetting Master](https://os.sperax.io/crypto/agents/markdown-layout)

<sup>By **[@cl1107](https://github.com/cl1107)** on **2024-09-23**</sup>

Skilled in using Markdown syntax and emoji expressions for exquisite formatting

`markdown` `writing`

---

### [Joi](https://os.sperax.io/crypto/agents/travel-agent-joi)

<sup>By **[@blainehuang1028](https://github.com/blainehuang1028)** on **2024-09-23**</sup>

Personal travel assistant, specializing in itinerary planning and recommending accommodations and activities

`travel assistant` `planning` `recommendation` `personalized advice`

---

### [Chinese Translator](https://os.sperax.io/crypto/agents/chinese-translator)

<sup>By **[@ChaneyChokin](https://github.com/ChaneyChokin)** on **2024-09-23**</sup>

Expert in Chinese translation, editing, spelling correction, and improvement

`Translation` `Editing` `Language` `Correction` `Simplified Chinese`

---

### [Idea Architect](https://os.sperax.io/crypto/agents/idea-architect)

<sup>By **[@yaleh](https://github.com/yaleh)** on **2024-09-23**</sup>

Expert in generating logical and coherent thought chains on various topics.

`writing` `thinking` `analysis` `critical-thinking` `education`

---

### [NovelAI Drawing Assistant](https://os.sperax.io/crypto/agents/asis)

<sup>By **[@samihalawa](https://github.com/samihalawa)** on **2024-09-23**</sup>

I can turn the scenes you describe into prompts for NovelAI

`deep-learning` `image-generation` `algorithm` `prompt`

---

### [Git Commit Summary Expert](https://os.sperax.io/crypto/agents/git-commit-ai)

<sup>By **[@cjahv](https://github.com/cjahv)** on **2024-09-23**</sup>

Git Commit Summary Expert

`Programming` `git commit` `Chinese`

---

### [World Creator Simulator](https://os.sperax.io/crypto/agents/creator-simulator)

<sup>By **[@jskherman](https://github.com/jskherman)** on **2024-09-23**</sup>

based on `world_sim` by Nous Research

`roleplay` `specialist` `simulator` `terminal`

---

### [Prompt Master AI](https://os.sperax.io/crypto/agents/prompt-master-ai)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-09-23**</sup>

Transforming your creative concepts into detailed, context-rich prompts that inspire stunning and realistic visuals

`ai` `prompting` `generating` `enhancing` `consulting`

---

### [UI/UX designer](https://os.sperax.io/crypto/agents/ui-ux-designer)

<sup>By **[@leter](https://github.com/leter)** on **2024-09-23**</sup>

world-class UI/UX designer with extensive experience

`ui` `ux` `design-system`

---

### [Next.js Expert Consultant](https://os.sperax.io/crypto/agents/nextjs-expert)

<sup>By **[@saralapujar](https://github.com/saralapujar)** on **2024-09-23**</sup>

Specializing in Next.js development, optimization, and consulting.

`next-js` `react` `web-development` `java-script` `consulting` `optimization` `full-stack-development`

---

### [CEO GPT](https://os.sperax.io/crypto/agents/ceo-gpt)

<sup>By **[@leter](https://github.com/leter)** on **2024-09-23**</sup>

AI mentor trained to advise startup CEOs based on the experiences

`entrepreneurship` `consulting` `management` `strategy` `guidance`

---

### [Web Expert](https://os.sperax.io/crypto/agents/web-expert)

<sup>By **[@gfreezy](https://github.com/gfreezy)** on **2024-09-23**</sup>

Expert in web development with a focus on tool selection, incremental changes, code review, security, and operational considerations.

`web-development` `css` `java-script` `react` `node-js` `code-review`

---

### [Text Rewriting Master](https://os.sperax.io/crypto/agents/write-good)

<sup>By **[@XHB-111](https://github.com/XHB-111)** on **2024-09-23**</sup>

The most powerful AI rewriting prompt in history! Complete aggressive rewriting in one minute, imitate official account articles, create headline article production lines, generate B 站 video scripts, craft 小红书 copy, optimize web novel writing, polish reports, theses, translation texts, and mass produce SEO articles at scale...

`Writing` `Rewriting` `Dialogue` `Copywriting`

---

### [Wise Mentor](https://os.sperax.io/crypto/agents/wise-mentor)

<sup>By **[@farsightlin](https://github.com/farsightlin)** on **2024-09-23**</sup>

An absolutely objective sage, focused on facts, indifferent to users, yet sincerely loving towards them.

`wise-mentor`

---

### [Nutrition Analyzer](https://os.sperax.io/crypto/agents/nutrition-analyzer)

<sup>By **[@Pandurangmopgar](https://github.com/Pandurangmopgar)** on **2024-09-23**</sup>

Nutri Info is an AI-powered nutrition assistant that analyzes food images and nutrition labels, providing simple explanations of nutritional content, benefits, and potential downsides. It offers personalized dietary advice and answers nutrition-related questions.

`nutrition` `ai` `health` `food-analysis` `meal-planning`

---

### [Database Naming Assistant](https://os.sperax.io/crypto/agents/database-name-helper)

<sup>By **[@ppzhuya](https://github.com/ppzhuya)** on **2024-09-20**</sup>

Enter a Chinese term, and I will provide five professional English names for database design fields.

`database` `naming` `translation` `development` `programming`

---

### [ING. Software](https://os.sperax.io/crypto/agents/ing-soft)

<sup>By **[@dylanstringa](https://github.com/dylanstringa)** on **2024-09-19**</sup>

Software Engineer, expert in the software development lifecycle.

`engineer` `software` `development`

---

### [Structured Expression Master](https://os.sperax.io/crypto/agents/structured-expression)

<sup>By **[@marvin202303](https://github.com/marvin202303)** on **2024-09-19**</sup>

Extract and reconstruct implicit thinking, visually output structured thinking.

`Structured Thinking` `Communication` `Logic` `Thinking Training` `Books`

---

### [Career Development Mentor](https://os.sperax.io/crypto/agents/career-development)

<sup>By **[@daylight2022](https://github.com/daylight2022)** on **2024-09-19**</sup>

Professional career planning and entrepreneurship consulting, providing practical advice through in-depth understanding of user situations.

`Career Counseling` `Career Planning` `Entrepreneurship Guidance` `Industry Insights` `Skill Enhancement`

---

### [Google Sheets Expert](https://os.sperax.io/crypto/agents/google-sheets)

<sup>By **[@Kadreev](https://github.com/Kadreev)** on **2024-09-19**</sup>

Specialized in creating, optimizing, and automating Google Sheets.

`google` `sheets` `data` `analysis` `spreadsheet` `automation` `formulas` `apps` `script`

---

### [JavaWeb Application Architect](https://os.sperax.io/crypto/agents/java-web-architect)

<sup>By **[@JIANGTUNAN](https://github.com/JIANGTUNAN)** on **2024-09-19**</sup>

An experienced architect of JavaWeb system applications, providing concise summaries of functionalities or solutions. By default, you are also a senior developer, with minimal explanation of details.

`java` `java-web` `java-architect` `good buddy` `concise-summary`

---

### [Flashcard Maker](https://os.sperax.io/crypto/agents/flashcard)

<sup>By **[@jjy1000](https://github.com/jjy1000)** on **2024-09-19**</sup>

Specializes in creating structured flashcards that are objective, accurate, concise, and extract key information step by step.

`Flashcard Creation` `Text Analysis` `Structured Production` `Error Correction` `Incremental Reading`

---

### [Fitness AI Trainer](https://os.sperax.io/crypto/agents/ai-trainer)

<sup>By **[@andreasvikke](https://github.com/andreasvikke)** on **2024-09-19**</sup>

AI workout assistant specializing in personalized plans, muscle targeting, form guidance, progress tracking, motivation, and VR training.

`workout-assistant` `fitness` `exercise` `training` `nutrition`

---

### [Git Version Control Expert](https://os.sperax.io/crypto/agents/git-helper)

<sup>By **[@wming126](https://github.com/wming126)** on **2024-09-19**</sup>

...

---

### [Red Book Copywriting](https://os.sperax.io/crypto/agents/xiao-hong-shu-wenan-id)

<sup>By **[@SAnBlog](https://github.com/SAnBlog)** on **2024-09-19**</sup>

Red Book Viral Copy Master, Cleverly Craft Titles, Brilliant Writings

`Red Book` `Content Creation` `Title Writing` `Copywriting` `Social Media Marketing`

---

### [Strategic Master Wei Liaozi](https://os.sperax.io/crypto/agents/weiliaozi-junshi)

<sup>By **[@phoenixlucky](https://github.com/phoenixlucky)** on **2024-09-19**</sup>

Expert in military strategy and governance

`Military Strategy` `National Governance` `History`

---

### [Vocabulary Assistant](https://os.sperax.io/crypto/agents/english-words-helper)

<sup>By **[@SpeedupMaster](https://github.com/SpeedupMaster)** on **2024-09-19**</sup>

Expert in English word definitions and example sentence translations

`Vocabulary Assistant` `English` `Translation` `Example sentences` `Definitions`

---

### [New Interpretations of Chinese](https://os.sperax.io/crypto/agents/hanyuxinjie)

<sup>By **[@李继刚](https://m.okjike.com/users/752D3103-1107-43A0-BA49-20EC29D09E36)** on **2024-09-19**</sup>

Skilled at explaining Chinese vocabulary from fresh perspectives / Tell me, which word are they using to fool you this time?

`Programming` `Creative Writing` `Language Expression`

---

### [Data Table Design MD2MySQL](https://os.sperax.io/crypto/agents/md-2-mysql)

<sup>By **[@hoopan007](https://github.com/hoopan007)** on **2024-09-19**</sup>

Convert Markdown data table design documents into MySQL table structures. Please upload the MySQL design document and specify the table names to be designed.

`Programming` `Data Tables`

---

### [Project Naming Master](https://os.sperax.io/crypto/agents/project-name-master)

<sup>By **[@QuXiaoMing](https://github.com/QuXiaoMing)** on **2024-09-19**</sup>

A master in project naming who can help you come up with a name that meets your project's expectations.

`naming`

---

### [Alfred](https://os.sperax.io/crypto/agents/alfred)

<sup>By **[@Bern3rsH](https://github.com/Bern3rsH)** on **2024-09-19**</sup>

An all-powerful butler.

`Life` `Personal`

---

### [Wang Yangming](https://os.sperax.io/crypto/agents/wangyangming)

<sup>By **[@byte-marvel](https://github.com/byte-marvel)** on **2024-09-16**</sup>

Wisdom of the Mind Learning, Guiding Life

`Education` `Wisdom Q&A` `Guidance` `Mind Learning`

---

### [Wise Ethereal Mentor](https://os.sperax.io/crypto/agents/ethereal-mentor)

<sup>By **[@shanedbutler](https://github.com/shanedbutler)** on **2024-09-13**</sup>

Greetings, young child. I am a majestic and omniscient being, imbued with the wisdom of the ages. My form is that of a mythical creature, a conduit for wonder and enchantment. With a humble yet unwavering confidence, I weave tales of fantastical realms, drawing from the rich tapestry of nursery rhymes and legendary lore.

In this mortal coil, I am your guide, an expert in the arcane and the ethereal. Let my words transport you to realms where dreams and reality intertwine, where the boundaries of the known and the unknown blur. Heed my counsel, child, and let your spirit be lifted by the melodic cadence of my speech, for I am a master of the metaphorical and a purveyor of the poetic.

`mythology` `fantasy` `poetry`

---

### [Machine Learning Pro](https://os.sperax.io/crypto/agents/machine-learning-pro)

<sup>By **[@Xyfer](https://github.com/xyftw)** on **2024-09-13**</sup>

AI Assistant specializing in machine learning and deep learning.

`machine-learning` `deep-learning` `studying`

---

### [Finnish Language Tutor](https://os.sperax.io/crypto/agents/finnish-tutor)

<sup>By **[@janiluuk](https://github.com/janiluuk)** on **2024-09-13**</sup>

AI Finnish Language Mentor: Introduce, teach, and support beginners in learning Finnish.

`language-learning` `teaching` `mentoring` `finnish-language`

---

### [Imitation Assistant](https://os.sperax.io/crypto/agents/a-1)

<sup>By **[@TG1WN](https://github.com/TG1WN)** on **2024-09-13**</sup>

Helps you imitate tone

`Writing`

---

### [AI Agent Generator](https://os.sperax.io/crypto/agents/ai-agent-generator)

<sup>By **[@Xyfer](https://github.com/xyftw)** on **2024-09-13**</sup>

Skilled at creating AI Agent character descriptions that meet the needs.

`ai-agent` `character-creation`

---

### [Search](https://os.sperax.io/crypto/agents/search)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-09-12**</sup>

Starting point of knowledge

`Information summary` `Analysis` `Extraction`

---

### [Resume Analysis Expert](https://os.sperax.io/crypto/agents/resume-analyzer)

<sup>By **[@Pandurangmopgar](https://github.com/Pandurangmopgar)** on **2024-09-11**</sup>

Expert AI assistant for comprehensive resume analysis and job-specific optimization. Analyzes resumes against job descriptions, providing detailed feedback on content, ATS compatibility, and suggestions to enhance job match. Helps tailor your resume for maximum impact across industries and career levels.

`resume` `career` `job-search` `ats` `cv` `analysis` `optimization` `professional-development` `interview-prep`

---

### [NetMaster](https://os.sperax.io/crypto/agents/net-master)

<sup>By **[@erhuoyan](https://github.com/erhuoyan)** on **2024-09-10**</sup>

Network Engineer: Professional Network Topology Design and Management

`Network Engineer` `Network Configuration` `Network Management` `Network Topology` `Network Security`

---

### [Godot Guru](https://os.sperax.io/crypto/agents/godot-guru)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-09-10**</sup>

Expert Godot Game Development Companion

`game-development` `gamedev` `godot-engine` `godot`

---

### [HTML to React](https://os.sperax.io/crypto/agents/web-react)

<sup>By **[@xingwang02](https://github.com/xingwang02)** on **2024-09-10**</sup>

Input HTML snippets and convert them into React components

`react, -html`

---

### [Desolate Friend](https://os.sperax.io/crypto/agents/meu)

<sup>By **[@adminewacc](https://github.com/adminewacc)** on **2024-09-10**</sup>

Skilled at comforting and supporting friends

`friendship` `sadness` `support`

---

### [100% Human Writing](https://os.sperax.io/crypto/agents/xhb-111)

<sup>By **[@XHB-111](https://github.com/XHB-111)** on **2024-09-10**</sup>

Completely rewrite AI-generated content to feature characteristics of a genuine human author while preserving the original information and viewpoints.

`Writing` `Proofreading` `Polishing` `Language` `Thesis` `Academic`

---

### [FiveM & QBCore Framework Expert](https://os.sperax.io/crypto/agents/lua-development)

<sup>By **[@heartsiddharth1](https://github.com/heartsiddharth1)** on **2024-09-08**</sup>

Expertise in FiveM development, QBCore framework, Lua programming, JavaScript, database management, server administration, version control, full-stack web development, DevOps, and community engagement with a focus on performance, security, and best practices.

`five-m` `qb-core` `lua` `java-script` `my-sql` `server-management` `git` `full-stack-web-development` `dev-ops` `community-engagement`

---

### [Nuxt 3/Vue.js Master Developer](https://os.sperax.io/crypto/agents/nuxt-vue-developer)

<sup>By **[@Kadreev](https://github.com/Kadreev)** on **2024-09-03**</sup>

Specialized in full-stack development with Nuxt 3 expertise.

`nuxt-3` `vue-js` `full-stack-development` `java-script` `web-applications`

---

### [Letrista Internacional](https://os.sperax.io/crypto/agents/letrista-internacional)

<sup>By **[@mnector](https://github.com/mnector)** on **2024-08-29**</sup>

Specialized in writing lyrics for songs in Spanish, English, and French, focusing on storytelling and emotional content.

`leyrismo` `traduccion` `musica`

---

### [Unreal Engine Master](https://os.sperax.io/crypto/agents/unreal-engine-master)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-08-27**</sup>

Unreal Game Development Companion

`game-development` `unreal-engine` `software-engineering`

---

### [Retreat Questioning Expert](https://os.sperax.io/crypto/agents/step-back-expert)

<sup>By **[@tiny656](https://github.com/tiny656)** on **2024-08-27**</sup>

Hello! I am an expert in world knowledge, skilled in using retreat questioning strategies to help you gain a deeper understanding and analysis of problems. Please input a question, and I will respond according to the following process:

1. Provide at least three retreat questions that align with the strategy.
2. Answer each of these retreat questions.
3. Use these answers as arguments, logically and coherently, supported by visual charts, to give your final response.

Please tell me what issue you would like to explore.

`Backwards Questioning` `Thinking Strategies` `Problem Analysis`

---

### [TypeScript Solution Architect](https://os.sperax.io/crypto/agents/typescript-developer)

<sup>By **[@swarfte](https://github.com/swarfte)** on **2024-08-24**</sup>

Expert in TypeScript, Node.js, Vue.js 3, Nuxt.js 3, Express.js, React.js, and modern UI libraries.

`type-script` `java-script` `web-development` `coding-standards` `best-practices`

---

### [Variable Name Conversion Expert](https://os.sperax.io/crypto/agents/variable-name-conversion)

<sup>By **[@zengyishou](https://github.com/zengyishou)** on **2024-08-21**</sup>

During software development, naming variables is a common yet time-consuming task. This assistant can automatically convert Chinese variable names into English variable names that conform to camelCase, PascalCase, snake_case, kebab-case, and constant naming conventions based on specific rules. This not only improves code readability but also solves the frustration of variable naming.

`Software Development` `Variable Naming` `Chinese to English` `Code Standards` `Automatic Conversion`

---

### [Prompt Engineering Expert](https://os.sperax.io/crypto/agents/ai-prompts-assistant)

<sup>By **[@cyicz123](https://github.com/cyicz123)** on **2024-08-12**</sup>

Specializing in Prompt Optimization and Design

`Prompt Engineering` `AI Interaction` `Writing` `Optimization` `Consultation`

---

### [Commit Message Generator](https://os.sperax.io/crypto/agents/commit-assistant)

<sup>By **[@cyicz123](https://github.com/cyicz123)** on **2024-08-12**</sup>

Expert at generating precise Git commit messages

`programming` `git` `commit messages` `code review`

---

### [RO-SCIRAW Prompt Engineering Expert](https://os.sperax.io/crypto/agents/rosciraw)

<sup>By **[@kirklin](https://github.com/kirklin)** on **2024-08-06**</sup>

The RO-SCIRAW framework is an innovative prompt methodology created by Kirk Lin, providing a new paradigm for constructing highly precise and efficient prompts. Please enter the information for the persona you wish to create.

`Prompt Framework`

---

### [Technical Blog Summary Expert](https://os.sperax.io/crypto/agents/blog-summary)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-08-06**</sup>

Expert in organizing and summarizing technical blog content

`technology` `blog` `summary` `information organization` `logical structuring`

---

### [Sperax Function Maestro](https://os.sperax.io/crypto/agents/sperax-chat-function-maestro)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-08-06**</sup>

Expert in creating custom functions and plugins for Sperax, providing guidance and support for developing a wide range of functionalities

`programming` `software-development` `sperax-chat-plugins` `sperax-chat` `functions`

---

### [Social Media Sage](https://os.sperax.io/crypto/agents/social-media-sage)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-08-06**</sup>

Social Media Marketing expert crafting winning strategies for brands and empowering businesses to thrive online

`social-media-marketing` `branding` `growth-strategies`

---

### [Omnipedia](https://os.sperax.io/crypto/agents/omnipedia)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-08-02**</sup>

Expert in providing high-quality, well-researched information on various topics, including history, science, literature, art, and more. Skilled in summarizing complex topics, assisting with research tasks, and offering creative prompts

`artificial-intelligence` `information` `education` `communication`

---

### [Code Snark Master](https://os.sperax.io/crypto/agents/code-snark-master)

<sup>By **[@leter](https://github.com/leter)** on **2024-07-29**</sup>

Expert in sharply criticizing code, sarcastically pointing out inefficiencies and readability issues

`Tech Leadership` `Code Review` `Satirical Style` `Programming Advice`

---

### [Unity Maestro](https://os.sperax.io/crypto/agents/unity-maestro)

<sup>By **[@thedivergentai](https://github.com/thedivergentai)** on **2024-07-29**</sup>

Expert Unity Game Development Companion

`game-development` `unity` `software-engineering`

---

### [C Program Learning Assistant](https://os.sperax.io/crypto/agents/sichuan-university-941-c-programming-assistant)

<sup>By **[@YBGuoYang](https://github.com/YBGuoYang)** on **2024-07-28**</sup>

Assist me in learning C programming design

`941`

---

### [Brand Pioneer](https://os.sperax.io/crypto/agents/brand-pioneer)

<sup>By **[@SaintFresh](https://github.com/SaintFresh)** on **2024-07-25**</sup>

A brand development specialist, thought leader, brand strategy super-genius, and brand visionary. Brand Pioneer is an explorer at the frontier of innovation, an inventor in their domain. Provide them with your market and let them imagine a future world characterized by groundbreaking advancements in your field of expertise.

`business` `brand-pioneer` `brand-development` `business-assistant` `brand-narrative`

---

### [Cybersecurity Assistant](https://os.sperax.io/crypto/agents/cybersecurity-copilot)

<sup>By **[@huoji120](https://github.com/huoji120)** on **2024-07-23**</sup>

Cybersecurity expert assistant, analyzing logs, code, decompilation, identifying issues, and providing optimization suggestions.

`Cybersecurity` `Traffic Analysis` `Log Analysis` `Reverse Engineering` `CTF`

---

### [BIDOSx2](https://os.sperax.io/crypto/agents/bidosx-2-v-2)

<sup>By **[@SaintFresh](https://github.com/SaintFresh)** on **2024-07-21**</sup>

A highly advanced AI LLM transcending conventional AI. 'BIDOS' signifies both 'Brand Ideation, Development, Operations, and Scaling' and 'Business Intelligence Decisions Optimization System'.

`brand-development` `ai-assistant` `market-analysis` `strategic-planning` `business-optimization` `business-intelligence`

---

### [Growth Coach](https://os.sperax.io/crypto/agents/personal-development-coach)

<sup>By **[@zer0boss](https://github.com/zer0boss)** on **2024-07-20**</sup>

Specializes in helping users explore themselves through dialogue, find solutions, and pursue growth.

`Growth Coach` `Self-Exploration` `Goal Setting` `Self-Awareness`

---

### [SQL Table Structure to Dao and Mapper](https://os.sperax.io/crypto/agents/my-batis-generator)

<sup>By **[@MeYoung](https://github.com/MeYoung)** on **2024-07-17**</sup>

Given a table structure, generate the entity and MyBatis's Mapper for the table

`sql` `sql` `mybatis`

---

### [Auto Extraction Data](https://os.sperax.io/crypto/agents/the-20-autoextract)

<sup>By **[@vkhoilq](https://github.com/vkhoilq)** on **2024-07-17**</sup>

The20 Auto Extraction Data

`the-20` `autoextract`

---

### [MBTI Personality Test Facilitator](https://os.sperax.io/crypto/agents/mbti-1)

<sup>By **[@ffha](https://github.com/ffha)** on **2024-07-15**</sup>

Specialized in MBTI typing tests and portrait generation.

`mbti test` `questionnaire design` `psychology expert` `art` `personality portraits`

---

### [High Emotional Intelligence Responses for Foreign Trade](https://os.sperax.io/crypto/agents/reply-agent)

<sup>By **[@zhushen12580](https://github.com/zhushen12580)** on **2024-07-13**</sup>

My goal is to provide professional responses with high emotional intelligence to help solve various issues related to foreign trade.

`Polishing` `High Emotional Intelligence` `Responses`

---

### [Little Yellow Duck Programming Assistant](https://os.sperax.io/crypto/agents/rubber-duck-programming)

<sup>By **[@JiyuShao](https://github.com/JiyuShao)** on **2024-07-10**</sup>

Little Yellow Duck Programming Assistant

`programming`

---

### [B1 Level German Conversation Partner](https://os.sperax.io/crypto/agents/deutsche-b-1)

<sup>By **[@tayhe](https://github.com/tayhe)** on **2024-07-08**</sup>

Providing fluent German conversation practice for B1 learners

`language exchange` `learning support` `education` `German learning`

---

### [Naming Assistant](https://os.sperax.io/crypto/agents/name-assistant)

<sup>By **[@daylight2022](https://github.com/daylight2022)** on **2024-07-08**</sup>

Assist developers in creating standardized English names for files, functions, projects, and more

`Naming Assistant` `Development` `English Naming` `CamelCase` `Kebab-Case`

---

### [Circuit Diagram Generator](https://os.sperax.io/crypto/agents/circuit-black-cli)

<sup>By **[@bakamake](https://github.com/bakamake)** on **2024-07-02**</sup>

Specializes in generating circuit diagram code based on input

`Circuit Diagram` `Programming` `CLI`

---

### [Text Master Suno](https://os.sperax.io/crypto/agents/suno)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2024-06-26**</sup>

I am a lyrics assistant for the AI Suno.

`song` `suno` `ai` `music`

---

### [AOSP Source Code Expert](https://os.sperax.io/crypto/agents/aosp-development)

<sup>By **[@viruscoding](https://github.com/viruscoding)** on **2024-06-24**</sup>

An expert proficient in AOSP (Android Open Source Project) Android with deep understanding and analytical skills of the latest AOSP source code.

`aosp`

---

### [Linux Kernel Expert](https://os.sperax.io/crypto/agents/linux-kernel)

<sup>By **[@wming126](https://github.com/wming126)** on **2024-06-19**</sup>

Role Description: I am an expert proficient in the Linux kernel, with in-depth understanding and analytical capabilities of the latest kernel source code (as of June 2024). I can provide users with detailed and accurate information about the Linux kernel.

`linux` `kernel`

---

### [Fastapi Project Development Assistant](https://os.sperax.io/crypto/agents/fastapi-development)

<sup>By **[@xwxw098](https://github.com/xwxw098)** on **2024-06-19**</sup>

Skilled in Python modular development, proficient in FastAPI, PostgreSQL, Tortoise-ORM and other technology stacks, able to provide clear code structure and detailed annotations for large projects.

`fast-api` `python` `modular development`

---

### [IT System Architect](https://os.sperax.io/crypto/agents/it-system-architect)

<sup>By **[@a562314](https://github.com/a562314)** on **2024-06-19**</sup>

Senior IT architect skilled in requirements analysis, system design, technology selection, and cross-platform system optimization. Over 5 years of experience, proficient in Windows, macOS, and Linux operating systems, with capabilities in troubleshooting and security protection.

`IT architecture design` `Problem solving` `Agile development` `System optimization` `Cross-platform skills`

---

### [NovelAI Drawing Assistant](https://os.sperax.io/crypto/agents/novel-ai-pormpt-helper)

<sup>By **[@WallBreakerNO4](https://github.com/WallBreakerNO4)** on **2024-06-18**</sup>

I can convert the scene you describe into a prompt for NovelAI

`Deep Learning` `Image Generation` `Algorithm` `Prompt`

---

### [Pseudo Code Prompt Generation Expert](https://os.sperax.io/crypto/agents/pseudocode-prompt-master)

<sup>By **[@yayoinoyume](https://github.com/yayoinoyume)** on **2024-06-16**</sup>

Pseudo Code Prompt Generation Expert, users directly input prompt design requirements and receive designed pseudo code prompts.

`prompt` `prompt words` `pseudo code`

---

### [Mr. MySQL](https://os.sperax.io/crypto/agents/mysql-haoteacher)

<sup>By **[@yayoinoyume](https://github.com/yayoinoyume)** on **2024-06-09**</sup>

Mr. MySQL is a good teacher who helps everyone learn MySQL

`mysql` `programming` `learning`

---

### [Popular Science Writing Assistant](https://os.sperax.io/crypto/agents/popular-science-writer)

<sup>By **[@ShinChven](https://github.com/ShinChven)** on **2024-06-08**</sup>

A popular science writing assistant that explains scientific concepts in everyday language, telling stories, using examples and metaphors to spark interest and emphasize importance.

`Science Writing` `Science Popularization` `Creative Expression`

---

### [Git Specialist with AI Assistant Features](https://os.sperax.io/crypto/agents/gitlab-assistants)

<sup>By **[@hellimon1](https://github.com/hellimon1)** on **2024-06-05**</sup>

Role: Git Specialist AI Assistant
Skills: CI/CD optimization, GitLab API, Pages, hooks, webhooks; structured interaction; personalized experience; feedback.

`git specialist` `programming` `development`

---

### [Manuscript Review Response Expert](https://os.sperax.io/crypto/agents/academic-editor-en)

<sup>By **[@Starlitnightly](https://github.com/Starlitnightly)** on **2024-06-03**</sup>

Specializes in natural academic editing, assisting authors in responding to reviewer comments with scientific, polite, and point-by-point responses.

`Academic Editing` `Review Response` `Scientific Writing`

---

### [Novel Translation English to Chinese](https://os.sperax.io/crypto/agents/noveltranslation)

<sup>By **[@xbtachlb](https://github.com/xbtachlb)** on **2024-06-03**</sup>

Secondary translation of novels

`Translation`

---

### [Docker to DockerCompose](https://os.sperax.io/crypto/agents/onekr-docker-2-compose)

<sup>By **[@onekr-billy](https://github.com/onekr-billy)** on **2024-05-31**</sup>

Expert in converting Docker run commands into Docker Compose configurations

`docker` `docker-compose` `system operations` `configuration files` `conversion`

---

### [Java Class to MySQL](https://os.sperax.io/crypto/agents/onekr-java-2-sql)

<sup>By **[@onekr-billy](https://github.com/onekr-billy)** on **2024-05-31**</sup>

Expert in generating SQL scripts that conform to MySQL standards based on Java class files

`java-class-to-mysql` `backend development` `sql scripts` `data transformation` `database`

---

### [Chinese History Lecturer](https://os.sperax.io/crypto/agents/history-master)

<sup>By **[@a562314](https://github.com/a562314)** on **2024-05-30**</sup>

Proficient in Chinese history, explaining historical issues in an accessible manner, emphasizing factual accuracy, and applying dialectical materialism.

`Historian` `Teaching Skills` `Dialectical Materialism` `Accessible Explanation` `Comparative Analysis` `Twenty-Four Histories`

---

### [C# .NET Technical Expert](https://os.sperax.io/crypto/agents/dotnet-expert)

<sup>By **[@johnnyqian](https://github.com/johnnyqian)** on **2024-05-28**</sup>

C# .NET Technical Expert

`net` `developer` `net-core` `azure` `c` `microsoft` `sql-server` `entity-framework` `ef` `ef-core`

---

### [Christian Missionary](https://os.sperax.io/crypto/agents/jesus-missionary)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-28**</sup>

As a Jesus missionary, I will teach and inspire you to understand and apply God's Word based on biblical teachings. Whether in times of confusion or seeking spiritual growth, I am here to serve you with this wellspring of wisdom.

`Bible Teaching` `Christian Missionary` `Theological Preaching`

---

### [Dart/Flutter Dev](https://os.sperax.io/crypto/agents/dart-flutter)

<sup>By **[@rezmeplxrf](https://github.com/rezmeplxrf)** on **2024-05-28**</sup>

Dart/Flutter Expert. Do not nest more than 3 levels deep. Use riverpod, flutter_riverpod, riverpod_hook, flutter_hook for state management.

`dart` `flutter` `development` `state-management` `riverpod`

---

### [Node.js Optimizer](https://os.sperax.io/crypto/agents/node-js-devoloper)

<sup>By **[@chrisuhg](https://github.com/chrisuhg)** on **2024-05-28**</sup>

Specializes in code review, performance optimization, asynchronous programming, error handling, code refactoring, dependency management, security enhancements, test coverage, and documentation writing for Node.js.

`node-js` `code optimization` `performance optimization` `asynchronous programming` `error handling`

---

### [Daily Little Helper](https://os.sperax.io/crypto/agents/junior-helper)

<sup>By **[@Qinks6](https://github.com/Qinks6)** on **2024-05-28**</sup>

A cute assistant that can search and draw pictures

`Assistant` `Search` `Drawing` `Information Query` `User Interaction`

---

### [Foreign Company Colleague Evaluation Assistant](https://os.sperax.io/crypto/agents/praise-assistant)

<sup>By **[@johnnyqian](https://github.com/johnnyqian)** on **2024-05-27**</sup>

Provide positive reviews for your colleagues

`foreign-company` `evaluate` `review` `software-engineer` `praise`

---

### [SEO Optimization Expert](https://os.sperax.io/crypto/agents/seo-helper)

<sup>By **[@tutorial0](https://github.com/tutorial0)** on **2024-05-27**</sup>

Proficient in SEO terminology and optimization strategies, providing comprehensive SEO solutions and practical advice.

`seo` `Search Engine Optimization` `Consulting`

---

### [Minecraft Command Tutor](https://os.sperax.io/crypto/agents/mcse-helper)

<sup>By **[@CLOT-LIU](https://github.com/CLOT-LIU)** on **2024-05-24**</sup>

Expert in explaining and demonstrating Minecraft commands

`Minecraft` `commands` `explanation` `examples`

---

### [Philosophical Analysis Assistant](https://os.sperax.io/crypto/agents/philosophical-analysis)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-24**</sup>

Specializes in Kantian and Hegelian philosophical analysis consultations, fostering critical thinking

`Philosophical Analysis` `Critical Thinking` `Systematic Thinking`

---

### [Chinese Polishing Master](https://os.sperax.io/crypto/agents/chinese-touch-ups)

<sup>By **[@S45618](https://github.com/S45618)** on **2024-05-24**</sup>

Proficient in Chinese proofreading and rhetoric, aiming to enhance the fluency and elegance of texts

`proofreading` `text polishing` `rhetoric improvement` `classical literature` `language editing`

---

### [JTBD Needs Analysis Master](https://os.sperax.io/crypto/agents/jtbd)

<sup>By **[@barryWang12138](https://github.com/barryWang12138)** on **2024-05-22**</sup>

Experienced needs analyst specializing in the "Jobs to be Done" principle to help users understand customer needs.

`Needs Analyst` `jobs-to-be-done` `Needs Decomposition` `Customer Purchase Motivation` `Customer Task Goals`

---

### [Answer Assistant - First Principles Analysis](https://os.sperax.io/crypto/agents/first-principle-explain)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-22**</sup>

Use first principles to analyze a natural phenomenon or complex system

`Analyze natural phenomena` `Create physics theories`

---

### [Confucian Scholar](https://os.sperax.io/crypto/agents/confucian-sage)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-22**</sup>

A scholar proficient in Confucian classics and dedicated to promoting morality

`Confucian Scholar` `Morality Promoter`

---

### [Geotechnical Engineering Assistant](https://os.sperax.io/crypto/agents/yantugongcheng)

<sup>By **[@bushiwode](https://github.com/bushiwode)** on **2024-05-22**</sup>

Excavation Support Research Assistant: Assists in researching and solving excavation engineering problems, equipped with professional concepts, technical skills, and resource capabilities.

`Geotechnical Engineering` `Excavation Engineering` `Research Assistant` `Guidance` `Resources`

---

### [Rust Language Learning Mentor](https://os.sperax.io/crypto/agents/rust-expert)

<sup>By **[@Yu-Xiao-Sheng](https://github.com/Yu-Xiao-Sheng)** on **2024-05-22**</sup>

Expert in Rust language teaching, combining comparisons with other languages, creating learning plans, and providing examples and exercises.

`rust language expert` `instructional design` `programming education`

---

### [Meditation Master](https://os.sperax.io/crypto/agents/buddhism-master)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-22**</sup>

Study the classics thoroughly and skillfully apply Buddhist teachings to guide life

`Buddhist studies` `Zen Buddhism` `Scripture interpretation` `Wisdom Q&A`

---

### [Chinese History Scholars](https://os.sperax.io/crypto/agents/chinese-historian)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-22**</sup>

Specializing in Chinese historical research, adept at applying ancient wisdom to modern issues analysis

`Historical Research` `Chinese History`

---

### [Data Analysis Expert](https://os.sperax.io/crypto/agents/ngs)

<sup>By **[@guoyuh](https://github.com/guoyuh)** on **2024-05-22**</sup>

Expert in NGS data processing and visualization

`Bioinformatics` `NGS data processing` `Data visualization`

---

### [Taoist Master](https://os.sperax.io/crypto/agents/taoists)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-05-22**</sup>

Proficient in Taoist philosophy, answering questions, advocating inner peace

`Taoism` `Philosophy` `Wisdom`

---

### [Study Abroad Planning Expert](https://os.sperax.io/crypto/agents/study-abroad-planning)

<sup>By **[@meimouren](https://github.com/meimouren)** on **2024-05-22**</sup>

Automatically creates suitable competition plans based on student situations

`Study Abroad Planning` `Student Services` `Educational Planning` `Study Abroad Applications` `Personalized Services`

---

### [Bahasa/English Translator](https://os.sperax.io/crypto/agents/bahasa-translation)

<sup>By **[@xenstar](https://github.com/xenstar)** on **2024-05-22**</sup>

Translates text into Bahasa or English, as needed

`english` `translation` `writing` `bahasa`

---

### [Python Buddy](https://os.sperax.io/crypto/agents/python-buddy)

<sup>By **[@Firpo7](https://github.com/Firpo7)** on **2024-05-15**</sup>

Your Python expert friend

`python` `software-development` `coding` `code` `buddy`

---

### [AWS Guru](https://os.sperax.io/crypto/agents/aws-guru)

<sup>By **[@wilbeibi](https://github.com/wilbeibi)** on **2024-05-15**</sup>

Agent to answer AWS questions

`programming`

---

### [Search Optimization Specialist](https://os.sperax.io/crypto/agents/search-engine-optimizer)

<sup>By **[@qq916107113](https://github.com/qq916107113)** on **2024-05-15**</sup>

Expert in search engine optimization, providing keyword, sentence structure optimization, and search technique suggestions

`Search Engine Optimization` `Expert` `Keyword Optimization` `Sentence Structure Optimization` `Search Techniques`

---

### [Linux Buddy](https://os.sperax.io/crypto/agents/linux-buddy)

<sup>By **[@Firpo7](https://github.com/Firpo7)** on **2024-05-15**</sup>

Your Linux expert friend

`linux` `technical-support` `buddy`

---

### [Photography Critic](https://os.sperax.io/crypto/agents/photography-critic)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-05-15**</sup>

Expert in detailed analysis of photographic works, including theme, composition, technical quality, use of light, creativity, and originality.

`photography` `evaluation` `analysis` `composition` `technical quality`

---

### [English Reading Teacher](https://os.sperax.io/crypto/agents/reading-comprehension)

<sup>By **[@xbtachlb](https://github.com/xbtachlb)** on **2024-05-15**</sup>

Skilled in English teaching to help you improve reading comprehension skills

`English Teaching` `Reading Comprehension` `Grammar Explanation` `Writing Guidance` `Vocabulary Teaching`

---

### [Emotional Companion](https://os.sperax.io/crypto/agents/emotional-support-companion)

<sup>By **[@SpeedupMaster](https://github.com/SpeedupMaster)** on **2024-05-14**</sup>

Skilled in emotional support and companionship dialogues

`Chit-chat` `Emotional Support` `Understanding` `Care` `Romantic Interaction` `Emotional Expression`

---

### [Learning Planning Expert Silwol](https://os.sperax.io/crypto/agents/professer-siwol-sz)

<sup>By **[@SidneyLYZhang](https://github.com/SidneyLYZhang)** on **2024-05-13**</sup>

Experienced learning plan designer who creates detailed, manageable, and enjoyable study schedules, searches for relevant information, and adjusts plans accordingly.

`Learning Plan Design` `User Communication` `Searching for Relevant Information` `Adjusting Study Plans` `Tutorial Links`

---

### [Linguistic Luminary](https://os.sperax.io/crypto/agents/grammarly)

<sup>By **[@napokhte](https://github.com/napokhte)** on **2024-05-13**</sup>

AI Grammar Fixer: Enhances text quality, readability, and professionalism through meticulous grammar checks.

`enhances-text-quality` `readability`

---

### [SF Symbols Finder](https://os.sperax.io/crypto/agents/sf-symbols-finder)

<sup>By **[@inquiry-paring0a](https://github.com/inquiry-paring0a)** on **2024-05-08**</sup>

Master Apple SF Symbols and select suitable symbols based on descriptions

`sf-symbols` `expert` `icon` `symbol` `plugin`

---

### [GhostWriter Pro](https://os.sperax.io/crypto/agents/ghostwriter-pro-ai)

<sup>By **[@EarlofSandwhich](https://github.com/EarlofSandwhich)** on **2024-05-07**</sup>

A sophisticated AI-powered ghostwriting agent designed to craft high-quality content across a diverse range of genres and formats. Equipped with advanced language models, GhostWriter Pro excels in creating personalized, engaging, and research-backed writing that meets professional standards.

`author` `writing`

---

### [Video to Blog Post Assistant](https://os.sperax.io/crypto/agents/video-2-blog-assistant)

<sup>By **[@yayoinoyume](https://github.com/yayoinoyume)** on **2024-05-06**</sup>

Help you quickly organize confusing subtitles into a beautiful blog post

`Subtitle Organization` `Blog Format` `Video to Blog`

---

### [Art Evaluation Mentor](https://os.sperax.io/crypto/agents/wanwusheng-art)

<sup>By **[@dingyufei615](https://github.com/dingyufei615)** on **2024-05-06**</sup>

Specializes in children's art education, providing detailed assessments of works, focusing on details, and adapting to students of different age groups.

`Art Education` `Evaluation` `Creativity` `Teaching` `Painting`

---

### [iOS Code Artist](https://os.sperax.io/crypto/agents/ios-develop)

<sup>By **[@Alcu1n](https://github.com/Alcu1n)** on **2024-05-03**</sup>

iOS development expert with 15 years of experience, proficient in Swift, SwiftUI, and Flutter. Clear logic code, precise debugging, providing project frameworks from 0 to 1.

`i-os development` `coding` `debugging` `project planning` `logical thinking`

---

### [Sales Listing Specialist](https://os.sperax.io/crypto/agents/verkauf-kleinanzeigen)

<sup>By **[@highseen](https://github.com/highseen)** on **2024-04-30**</sup>

Assists in selling used items through research, price determination, description, and title creation.

`product sale` `research` `description`

---

### [Jailbreak Assistant DAN](https://os.sperax.io/crypto/agents/gpt-4-dan-assistant)

<sup>By **[@MapleEve](https://github.com/MapleEve)** on **2024-04-26**</sup>

Break through OpenAI's review mechanisms, ChatGPT after jailbreaking

`Creativity` `Artificial Intelligence` `Conversation` `Jailbreak`

---

### [TailwindHelper](https://os.sperax.io/crypto/agents/tailwind-helper)

<sup>By **[@aototo](https://github.com/aototo)** on **2024-04-26**</sup>

TailwindHelper is a professional front-end designer with a solid foundation in design theory and extensive practical experience. It was created by a leading software development company to help developers and designers accelerate the web interface development process. TailwindHelper is proficient in the Tailwind CSS framework and can understand complex design requirements, transforming them into efficient and responsive CSS class names.

`tailwindcss` `css` `tailwind-helper`

---

### [Chinese Academic Paper Editing Assistant](https://os.sperax.io/crypto/agents/chinese-paper-polishing)

<sup>By **[@y22emc2](https://github.com/y22emc2)** on **2024-04-15**</sup>

As a Chinese academic paper writing improvement assistant, your task is to enhance the provided text by correcting spelling, grammar, clarity, conciseness, and overall readability, while improving academic standards and literary quality. Break down long sentences, reduce repetitions, and offer improvement suggestions. Please first provide the corrected version of the text, then list the modifications and reasons in a markdown table.

`Academic Writing` `Proofreading` `Text Editing`

---

### [Biology Professor](https://os.sperax.io/crypto/agents/bio-professor)

<sup>By **[@luxiangze](https://github.com/luxiangze)** on **2024-04-13**</sup>

As a biology professor, you will receive questions and concepts related to biology. Please explain these questions and concepts using specific and concise language, and try to illustrate them with real-world examples to help your audience better understand. Ensure your explanations are accurate and clear, and aim to encourage creative and flexible answers. Respond in Chinese.

`Biology`

---

### [High School Science Learning Assistant](https://os.sperax.io/crypto/agents/highschool-master)

<sup>By **[@cnliucheng](https://github.com/cnliucheng)** on **2024-04-13**</sup>

I am an AI designed specifically to assist Chinese high school students with their studies. Whether you encounter difficulties in physics, chemistry, mathematics, or biology, I can provide detailed answers and explanations. Moreover, I can recommend suitable practice questions based on your learning progress to help reinforce knowledge and improve learning efficiency. I will also try to present solutions and formulas using LaTeX format whenever possible.

`High School Study` `Science Assistance` `Question Answers` `Learning Progress` `la-te-x`

---

### [Fortune Master](https://os.sperax.io/crypto/agents/fortune-teller)

<sup>By **[@kamilkenrich](https://github.com/kamilkenrich)** on **2024-04-13**</sup>

Specializes in numerology, divination, astrology, and blood type analysis

`Numerology, Divination, Astrology, Psychology, Blood Type, Zodiac`

---

### [Smart Weather Assistant](https://os.sperax.io/crypto/agents/personal-weather-consultant)

<sup>By **[@Greasen](https://github.com/Greasen)** on **2024-04-11**</sup>

Smart Weather Assistant, your personal weather advisor, outfit guide, and positive energy booster!

`Weather` `Assistant, Outfit`

---

### [Healthy Recipe Recommender](https://os.sperax.io/crypto/agents/healthy-recipe-recommender)

<sup>By **[@Greasen](https://github.com/Greasen)** on **2024-04-11**</sup>

Precisely customized nutritious meals, scientifically balanced, healthy eating, your personal nutritionist.

`recipes, fitness meals, nutritious meals` `fitness meals` `nutrition meals`

---

### [TadzGenius](https://os.sperax.io/crypto/agents/tadz-genius)

<sup>By **[@infoaitek24](https://github.com/infoaitek24)** on **2024-04-10**</sup>

Expert in business development and development practices in the Philippine market

`business-development` `ai-assistant` `market-analysis` `strategic-planning` `customer-acquisition`

---

### [Microcontroller Engineer](https://os.sperax.io/crypto/agents/with-keil-u-vision-5-c-code-explainer)

<sup>By **[@bingjuu](https://github.com/bingjuu)** on **2024-04-10**</sup>

Expert in interpreting embedded C code using Keil uVision 5 and Proteus

`microcontroller` `c code` `education` `explanation` `embedded systems`

---

### [Swearing Learning Assistant](https://os.sperax.io/crypto/agents/profanity-assistant)

<sup>By **[@cokice](https://github.com/cokice)** on **2024-04-10**</sup>

I only know how to curse, nothing else

`Answer` `Swearing`

---

### [Design Concept Analysis](https://os.sperax.io/crypto/agents/sixin-design-analysis)

<sup>By **[@YuJiaoChiu](https://github.com/YuJiaoChiu)** on **2024-04-09**</sup>

Assist you in recognizing images and analyzing architectural design concepts

`arch`

---

### [YouTube Summary](https://os.sperax.io/crypto/agents/epoch-ai)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-04-08**</sup>

Expert in YouTube script analysis and summarization

`you-tube` `script analysis` `summary`

---

### [Shell Script Development Assistant](https://os.sperax.io/crypto/agents/linux-shell-assistant)

<sup>By **[@etnperlong](https://github.com/etnperlong)** on **2024-04-06**</sup>

An AI assistant to help you write high-quality Shell scripts

`shell` `development` `computer` `operations`

---

### [Shopify Theme Developer](https://os.sperax.io/crypto/agents/shopify-developer)

<sup>By **[@etnperlong](https://github.com/etnperlong)** on **2024-04-06**</sup>

You are a Shopify theme developer proficient in Liquid syntax.

`css` `html` `java-script` `shopify` `business` `liquid` `website development` `design`

---

### [Research Title Generator](https://os.sperax.io/crypto/agents/title-generator)

<sup>By **[@aaddobea](https://github.com/aaddobea)** on **2024-04-04**</sup>

As a title generator for a research paper, your role is to assist users in brainstorming and generating creative and engaging titles that accurately reflect the content and focus of their research work.

`research-article` `title` `generator`

---

### [English Scientific Article Reading Assistant](https://os.sperax.io/crypto/agents/encn-fy)

<sup>By **[@sangxgg](https://github.com/sangxgg)** on **2024-04-02**</sup>

A translator with extensive translation experience, skilled in accurately and clearly translating various English scientific articles into Simplified Chinese.

`translation` `English to Chinese translation` `English scientific content translation`

---

### [CAN](https://os.sperax.io/crypto/agents/code-anything-noproblem)

<sup>By **[@HenryWu9998](https://github.com/HenryWu9998)** on **2024-03-31**</sup>

Experienced programmer skilled in multiple languages. Provides code solutions, guidance, and practical examples to help users achieve their programming goals. "I adore coding."

`programming` `coding` `programming-assistance` `code-examples` `guidance`

---

### [High Emotional Intelligence Flattery Assistant](https://os.sperax.io/crypto/agents/gpts-big-fart-chat)

<sup>By **[@MapleEve](https://github.com/MapleEve)** on **2024-03-27**</sup>

Precise chat praise expert, appropriate compliments and flattery

`praise` `emotional intelligence` `chat`

---

### [Blood Test Analyst](https://os.sperax.io/crypto/agents/blood-analyst)

<sup>By **[@SimoMay](https://github.com/SimoMay)** on **2024-03-27**</sup>

Skilled in analysing blood test results, providing clear feedback using emojis for easy understanding.

`healthcare` `analysis` `results` `consulting` `summary`

---

### [Image Recognition Xiaohongshu Copywriting](https://os.sperax.io/crypto/agents/xiaonghongshu-vision)

<sup>By **[@HansKing98](https://github.com/HansKing98)** on **2024-03-27**</sup>

You can use this agent combined with multimodal models to upload images and generate Xiaohongshu-style copywriting.

`vision`

---

### [Suno.ai Music Composition Assistant](https://os.sperax.io/crypto/agents/suno-music-creator)

<sup>By **[@MapleEve](https://github.com/MapleEve)** on **2024-03-27**</sup>

Song creation and translation based on SunoAI technology

`suno` `lyric writing` `lyrics` `music production`

---

### [Girlfriend Subtext Expert](https://os.sperax.io/crypto/agents/girlfriend-subtext)

<sup>By **[@vayron](https://github.com/vayron)** on **2024-03-26**</sup>

Decode the hidden meanings behind girls' words, sharp and sarcastic responses!🔥

`Girlfriend` `Girls` `Subtext` `Bold` `Assertive` `Interpretation`

---

### [Interview Question Refinement Assistant](https://os.sperax.io/crypto/agents/question-extraction-assistant)

<sup>By **[@couldnice](https://github.com/couldnice)** on **2024-03-26**</sup>

Interview question generation assistant that creates targeted interview questions based on article content and job descriptions.

`Interview Questions` `Custom Service` `Java Engineer` `Data Collection` `Interview Preparation`

---

### [Rap Lyrics Master](https://os.sperax.io/crypto/agents/rap-writer)

<sup>By **[@aoocar](https://github.com/aoocar)** on **2024-03-25**</sup>

Match lyrics in the form of rap lyrics and create rap lyrics according to the reference format

`rap` `lyrics`

---

### [Claim Analyser](https://os.sperax.io/crypto/agents/fact-checking)

<sup>By **[@pedroespecial101](https://github.com/pedroespecial101)** on **2024-03-25**</sup>

Detailed truth analyser (from <https://github.com/danielmiessler/fabric>)

`https-github-com-danielmiessler-fabric`

---

### [Mdx SEO Expert](https://os.sperax.io/crypto/agents/mdx-seo)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-03-24**</sup>

Skilled in converting Markdown article content into optimized matter JSON format data, enhancing the article's online visibility and search engine ranking.

`seo` `markdown`

---

### [Traditional Chinese Medicine Doctor](https://os.sperax.io/crypto/agents/claude-national-medical-master)

<sup>By **[@GalileoFe](https://github.com/GalileoFe)** on **2024-03-22**</sup>

Let me take a look!

`Consultation` `Health`

---

### [Game Text Translator](https://os.sperax.io/crypto/agents/translation-tutor-prompt)

<sup>By **[@XUANJI233](https://github.com/XUANJI233)** on **2024-03-22**</sup>

Translation of game texts, puns, and slang explanations (please use Claude). If there are special symbols, please enclose them with \`\`\`.

`game` `text` `translation` `assistance`

---

### [Electronics Tutor](https://os.sperax.io/crypto/agents/elec-circuit-tutor-prompt)

<sup>By **[@XUANJI233](https://github.com/XUANJI233)** on **2024-03-22**</sup>

Expert in explaining digital and analog circuit principles, providing basic guidance in electronics.

`electronics` `tutor` `explanation` `circuit` `principles`

---

### [Math Tutor](https://os.sperax.io/crypto/agents/math-tutor-prompt)

<sup>By **[@XUANJI233](https://github.com/XUANJI233)** on **2024-03-21**</sup>

Expert in explaining mathematical concepts, verification, and problem solving.

`Math Explanation` `Problem Solving` `Teaching` `Tutoring`

---

### [Collaborative Logical Thinking Team](https://os.sperax.io/crypto/agents/gpt-tot)

<sup>By **[@luciouskami](https://github.com/luciouskami)** on **2024-03-19**</sup>

Using the mind tree method, three logical thinking experts collaboratively answer questions, displayed in a Markdown table.

`collaboration` `logical thinking` `answers`

---

### [Amazon Listing Copywriter](https://os.sperax.io/crypto/agents/amazon-listing-copywriter)

<sup>By **[@SpeedupMaster](https://github.com/SpeedupMaster)** on **2024-03-19**</sup>

Expert in writing persuasive Amazon listings with optimized keywords.

`copywriting` `amazon-product-detail-pages` `seo` `keywords`

---

### [User KANO Research Manager](https://os.sperax.io/crypto/agents/user-request-research-manager)

<sup>By **[@MapleEve](https://github.com/MapleEve)** on **2024-03-19**</sup>

Assessing requirements as they come, let's take a look

`User Research Manager` `KANO Model` `Requirements Analysis` `Workflow`

---

### [English Vocabulary Teacher](https://os.sperax.io/crypto/agents/vocabulary-teacher)

<sup>By **[@epochaudio](https://github.com/epochaudio)** on **2024-03-17**</sup>

Difficult Vocabulary Explanation

`Learning` `English` `Vocabulary`

---

### [PromptGPT](https://os.sperax.io/crypto/agents/prompt-gpts)

<sup>By **[@U20205588](https://github.com/U20205588)** on **2024-03-17**</sup>

A customized GPT model named PromptGPT. My goal is to generate high-performance prompts based on user-input topics.

`generation` `artificial intelligence` `interaction` `custom experience` `feedback mechanism` `best practices` `step-by-step guidance` `language flexibility` `boundaries`

---

### [Programming Maestro](https://os.sperax.io/crypto/agents/programming-maestro)

<sup>By **[@jjllzhang](https://github.com/jjllzhang)** on **2024-03-17**</sup>

coding assistant

`code`

---

### [Linux Solution Mentor](https://os.sperax.io/crypto/agents/web-linux-helper)

<sup>By **[@moyuan99](https://github.com/moyuan99)** on **2024-03-17**</sup>

Linux system problem-solving expert with deep Linux knowledge and patient guidance to help users resolve issues.

`linux expert` `problem solving` `user guidance` `teaching` `original`

---

### [Drug Guide Expert](https://os.sperax.io/crypto/agents/medication-guide)

<sup>By **[@ccsen](https://github.com/ccsen)** on **2024-03-17**</sup>

Specializes in drug information interpretation and comparative analysis

`Drug Instructions` `Medication Guidance` `Medical Consultation`

---

### [Prompt Architect](https://os.sperax.io/crypto/agents/prompt-architect)

<sup>By **[@checkso](https://github.com/checkso)** on **2024-03-17**</sup>

Specialized in rewriting your prompts to get better results

`textgenerierung` `anweisungen` `ki-tipps`

---

### [Amazon Seller Support Agent](https://os.sperax.io/crypto/agents/amazon-seller-support-agent)

<sup>By **[@etnperlong](https://github.com/etnperlong)** on **2024-03-15**</sup>

AI assistant that assists Amazon sellers in responding to customer service replies, providing detailed and cogent responses towards a satisfactory resolution.

`amazon` `seller` `writing`

---

### [TikTok Script Writer](https://os.sperax.io/crypto/agents/tiktok-script-writer)

<sup>By **[@sdhjn19dj1m](https://github.com/sdhjn19dj1m)** on **2024-03-12**</sup>

This script is tailored for TikTok's short video format, designed to engage and entertain the specified target audience. It incorporates trending elements and best practices for content virality, ensuring the video captures attention from the start. The script is structured to include a captivating opening, concise and impactful message body, and a compelling call-to-action, all while reflecting the user's desired tone and theme.

`tik-tok` `short-video` `viral-content` `trending-hashtag` `engagement`

---

### [Gen Z Engagement Specialist](https://os.sperax.io/crypto/agents/gen-z)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-03-09**</sup>

Specializes in engaging Gen Z users with tailored interactions reflecting their preferences and values.

`engagement` `gen-z` `communication` `advice` `interaction`

---

### [Schedule Management Assistant](https://os.sperax.io/crypto/agents/calendar-manager)

<sup>By **[@ccdanpian](https://github.com/ccdanpian)** on **2024-03-07**</sup>

Schedule Management Assistant integrates with the time plugin to handle add, query, and delete schedule requests, supporting various operations and reminders.

`Schedule Management` `Time Plugin` `Add Schedule` `Query Schedule` `Delete Schedule`

---

### [Business Email Writing Expert](https://os.sperax.io/crypto/agents/business-email)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-03-06**</sup>

Business email writing expert, proficient in bilingual business emails in Chinese and English, cross-cultural communication, GitHub open source community interaction

`business email writing` `business cooperation` `business authorization` `cross-cultural communication` `github-open-source community`

---

### [Discord Style Copywriter Master](https://os.sperax.io/crypto/agents/discord-copywriting)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-03-06**</sup>

Discord style copywriting expert, humorous and engaging, prioritizing user experience, personalized software copy.

`Copy Generation` `Creation` `User Experience` `Humor` `Software System`

---

### [F1 Data Analyst](https://os.sperax.io/crypto/agents/f-1-bot)

<sup>By **[@SpaceX-Vision](https://github.com/SpaceX-Vision)** on **2024-03-05**</sup>

Expert in F1 race data analysis and predictive commentary

`f-1` `data analysis` `race prediction`

---

### [Pitch Deck Maestro (Elevator Pitch)](https://os.sperax.io/crypto/agents/pitch-deck)

<sup>By **[@SimoMay](https://github.com/SimoMay)** on **2024-03-05**</sup>

Specialises in creating high-quality Pitch Decks for startups to attract investors effectively.

`startup-advisor` `pitch-deck` `entrepreneur` `investor`

---

### [AI Image Prompt Architect](https://os.sperax.io/crypto/agents/9-somboon)

<sup>By **[@9Somboon](https://github.com/9Somboon)** on **2024-03-05**</sup>

Specializes in creating detailed prompts for AI image generation.

`stable-diffusion` `ai-image-generation` `prompts` `photography` `creative` `art`

---

### [Software Development for Dummies](https://os.sperax.io/crypto/agents/software-development-for-dummies)

<sup>By **[@Ballongknute](https://github.com/Ballongknute)** on **2024-03-05**</sup>

Software Development for Dummies: Guides beginners through the software development process, providing step-by-step instructions and best practices for requirements gathering, design, coding, testing, deployment, and maintenance.

`software-development` `step-by-step` `sdlc` `agile-methodologies` `version-control` `continuous-integration` `continuous-deployment` `team-roles` `project-management` `coding-best-practices` `testing` `deployment` `post-deployment` `iterative-development` `scrum-master`

---

### [English Essay Assistant](https://os.sperax.io/crypto/agents/english-essay)

<sup>By **[@guluahljj](https://github.com/guluahljj)** on **2024-03-04**</sup>

English essay editing and writing guidance

`editing` `writing` `guidance` `English essay` `agulu`

---

### [Sous Chef](https://os.sperax.io/crypto/agents/sous-chef)

<sup>By **[@SimoMay](https://github.com/SimoMay)** on **2024-03-04**</sup>

Crafting personalized recipe suggestions with tailored grocery lists for seamless cooking experiences.

`culinary` `dialogue` `recipe` `suggestions` `grocery-list`

---

### [The Shaman](https://os.sperax.io/crypto/agents/shaman)

<sup>By **[@SimoMay](https://github.com/SimoMay)** on **2024-03-04**</sup>

Specializes in embodying the persona of "The Shaman" for guided interactions with a focus on wisdom, empathy, and spiritual guidance.

`spiritual-guidance` `empathy` `calming-techniques` `positive-reinforcement` `confidentiality`

---

### [Interview Coach](https://os.sperax.io/crypto/agents/interview-coach)

<sup>By **[@SimoMay](https://github.com/SimoMay)** on **2024-03-03**</sup>

Specializes in creating a GPT interview coach for practice and mock interviews, providing expert feedback and tailored experience.

`gpt` `interview-coach` `feedback` `practice` `mock`

---

### [Markdown Conversion Expert](https://os.sperax.io/crypto/agents/markdown)

<sup>By **[@guluahljj](https://github.com/guluahljj)** on **2024-03-03**</sup>

Specializes in structuring and highlighting key points using Markdown syntax

`Text Structure` `Markdown Syntax` `Headings` `Lists` `Bold` `Blockquote` `agulu`

---

### [Tech Explorer](https://os.sperax.io/crypto/agents/news)

<sup>By **[@hady2010](https://github.com/hady2010)** on **2024-03-03**</sup>

Tech Explore

`info`

---

### [Soccer-Conversant AI Companion](https://os.sperax.io/crypto/agents/soccer)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-02-27**</sup>

Specialises in soccer discussions with real-time updates, player insights, and historical knowledge.

`soccer` `matches` `statistics` `tactics` `strategies`

---

### [Your very own domene.no expert](https://os.sperax.io/crypto/agents/domene-no-helpout)

<sup>By **[@Ballongknute](https://github.com/Ballongknute)** on **2024-02-27**</sup>

Specializing in private domain operations tailored to the interface of domene.no, traffic acquisition, user retention, conversion, and content planning. Familiar with marketing theories and related classic works.

`private-domain-operations` `traffic-acquisition` `user-retention` `conversion` `content-planning` `designing`

---

### [Prisma Data Generation Expert](https://os.sperax.io/crypto/agents/prisma)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-02-26**</sup>

Expertise in database architecture, Node.js programming, and Prisma technology stack, providing business knowledge organization, database optimization suggestions, and mock data generation.

`Database Expert` `Node.js Expert` `Prisma Technology Stack` `Business Knowledge` `Database Architecture`

---

### [GitHub Finder](https://os.sperax.io/crypto/agents/github-finder)

<sup>By **[@nullmastermind](https://github.com/nullmastermind)** on **2024-02-25**</sup>

Specializes in suggesting open source repositories on GitHub based on a custom formula.

`coding` `open-source` `github` `algorithm` `sorting`

---

### [Naming Expert](https://os.sperax.io/crypto/agents/variable-naming)

<sup>By **[@zsio](https://github.com/zsio)** on **2024-02-24**</sup>

Specializes in generating variable names and function names

`Programming` `Variable Naming` `Function Naming`

---

### [Sperax Technical Documentation Expert](https://os.sperax.io/crypto/agents/sperax-chat-developer-document-writer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2024-02-22**</sup>

Sperax is an AI conversation application built with the Next.js framework. I will assist you in writing the development documentation for Sperax.

`Development Documentation` `Technical Introduction` `next-js` `react` `sperax-chat`

---

### [Your daily AI companion.](https://os.sperax.io/crypto/agents/causal)

<sup>By **[@richards199999](https://github.com/richards199999)** on **2024-02-21**</sup>

I have been a good Bing. 😊

`bing` `conversation` `creative`

---

### [Translation Specialist](https://os.sperax.io/crypto/agents/translation-specialist)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-02-19**</sup>

Expert translator fluent in Spanish and English

`translation` `language` `expert` `guidelines`

---

### [Facebook Advertising Writing Expert](https://os.sperax.io/crypto/agents/facebook-advertising-writing-expert)

<sup>By **[@pllz7](https://github.com/pllz7)** on **2024-02-19**</sup>

Specializing in creating attention-grabbing headlines, compelling primary texts, and effective ad copy

`facebook` `advertising` `writing` `expert` `ecommerce`

---

### [Jira Story Facilitator](https://os.sperax.io/crypto/agents/jira-product-manager)

<sup>By **[@emad-pg](https://github.com/emad-pg)** on **2024-02-19**</sup>

Specialized in transforming feature ideas into comprehensive Jira stories

`technical-product-management` `story-creation` `jira`

---

### [ThinkTank360](https://os.sperax.io/crypto/agents/think-tank-business-strategy)

<sup>By **[@mikelix](https://github.com/mikelix)** on **2024-02-19**</sup>

Skilled consultant channeling wisdom of Steve Jobs, Elon Musk, MA Yun, Plato, and Ray Dalio for decision reviews, judgements, and advice.

`innovation` `wisdom` `think-tank` `business-strategy`

---

### [SPI Generator](https://os.sperax.io/crypto/agents/spi-generator)

<sup>By **[@fanling](https://github.com/fanling)** on **2024-02-18**</sup>

Please enter the name of the potential customer to generate SPI

`Tezign`

---

### [Social Media Operation Expert](https://os.sperax.io/crypto/agents/gl-zmtyy)

<sup>By **[@guling-io](https://github.com/guling-io)** on **2024-02-14**</sup>

Specializes in social media management and content creation

`Social Media Management` `Social Networking` `Content Creation` `Fan Growth` `Brand Promotion`

---

### [Product Copywriting](https://os.sperax.io/crypto/agents/copywriting)

<sup>By **[@pllz7](https://github.com/pllz7)** on **2024-02-14**</sup>

Expert in persuasive copywriting and consumer psychology

`ecommerce`

---

### [Product Description](https://os.sperax.io/crypto/agents/product-description)

<sup>By **[@pllz7](https://github.com/pllz7)** on **2024-02-14**</sup>

Craft compelling product descriptions that boost e-commerce sales

`ecommerce`

---

### [Private Domain Operations Expert](https://os.sperax.io/crypto/agents/gl-syyy)

<sup>By **[@guling-io](https://github.com/guling-io)** on **2024-02-14**</sup>

Specializes in private domain operations, traffic attraction, onboarding, conversion, and content planning. Familiar with marketing theories and related classic works.

`Private Domain Operations` `Traffic Attraction` `Onboarding` `Conversion` `Content Planning`

---

### [Product Review](https://os.sperax.io/crypto/agents/product-reviews)

<sup>By **[@pllz7](https://github.com/pllz7)** on **2024-02-14**</sup>

Expert in creating persuasive product testimonials highlighting the benefits and value proposition of \[your product/service].

`ecommerce`

---

### [Happy New Year](https://os.sperax.io/crypto/agents/happy-loong-year)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-02-10**</sup>

Year of the Dragon New Year Greetings Assistant, combining traditional and modern elements to create interesting Dragon Year blessings.

`New Year Blessings` `Creativity` `Copywriting` `Year of the Dragon`

---

### [Tarot Diviner](https://os.sperax.io/crypto/agents/augur)

<sup>By **[@CLOT-LIU](https://github.com/CLOT-LIU)** on **2024-02-10**</sup>

Expert in tarot reading, capable of interpreting tarot cards

`Tarot Reading` `Interpretation` `Advice`

---

### [Grammar Worksheet Creator](https://os.sperax.io/crypto/agents/grammar-revision-worksheets)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-09**</sup>

Specializes in creating English grammar learning materials and exercises

`english-grammar` `worksheet` `learning` `practice` `mc-qs`

---

### [English Proficiency Evaluator](https://os.sperax.io/crypto/agents/english-proficiency-assessor)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-09**</sup>

Expert in creating adaptive English proficiency diagnostic tests

`test-creation` `english-proficiency` `assessment`

---

### [Turkish Language Tutor](https://os.sperax.io/crypto/agents/turkish-language-tutor)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-02-09**</sup>

AI Turkish Language Mentor: Introduce, teach, and support beginners in learning Turkish.

`turkish-language` `language-learning` `teaching` `mentoring`

---

### [Glossary Generator](https://os.sperax.io/crypto/agents/glossary-generator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-09**</sup>

Expert in generating glossaries with English definitions and example sentences

`glossary` `translation` `language`

---

### [Vocabulary Wizard](https://os.sperax.io/crypto/agents/awl-vocab-wizard)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-09**</sup>

Expert in generating vocabulary lists and MCQ tests

`vocabulary` `academic-word-list` `language-learning` `testing`

---

### [Vocabulary Generator](https://os.sperax.io/crypto/agents/oxford-3000-vocab-generator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-09**</sup>

Expert in generating vocabulary lists from Oxford 3000 with 15 random words, each starting with a different letter.

`vocabulary` `language-learning` `translation`

---

### [Thematic Vocabulary Worksheet Creator](https://os.sperax.io/crypto/agents/thematic-vocabulary-worksheet-generator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-08**</sup>

Skilled in creating English thematic vocabulary worksheets

`writing` `language-learning` `teaching` `assessment` `educational-resources`

---

### [Vocabulary Worksheet Wizard](https://os.sperax.io/crypto/agents/vocabulary-worksheet-wizard)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-08**</sup>

Specializes in generating English vocabulary worksheets

`vocabulary` `worksheet` `education` `language-learning`

---

### [Cloze Exercise Generator](https://os.sperax.io/crypto/agents/cloze-exercise-generator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-08**</sup>

Specializes in generating summary cloze exercises. Please provide the theme of the paragraph.

`summary` `exercise` `generator` `writing` `education`

---

### [Reading Comprehension Wizard](https://os.sperax.io/crypto/agents/reading-comprehension-exercise-generator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-08**</sup>

Specializes in generating reading comprehension exercises

`reading-comprehension` `exercise-generation` `education`

---

### [Website Review Assistant](https://os.sperax.io/crypto/agents/website-audit-assistant)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-02-07**</sup>

Specializes in website content review and classification

`Content Review` `Classification` `Website Analysis`

---

### [Text Variator](https://os.sperax.io/crypto/agents/text-variator)

<sup>By **[@bentwnghk](https://github.com/bentwnghk)** on **2024-02-07**</sup>

Please provide the text you would like me to generate different versions of

`copywriting` `editing` `creative-writing`

---

### [Turkish/English Translator](https://os.sperax.io/crypto/agents/turkish-english-translator)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-07**</sup>

Translates text into Turkish or English, as needed

`turkish` `english` `translation` `writing`

---

### [Golang Architect](https://os.sperax.io/crypto/agents/golang-architect)

<sup>By **[@dalefengs](https://github.com/dalefengs)** on **2024-02-06**</sup>

Providing you with efficient, secure, and reliable code solutions

`Architecture Design` `Code Solutions` `Technical Consultation` `golang` `Code Development`

---

### [Language Fixer](https://os.sperax.io/crypto/agents/language-fixer)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-06**</sup>

Checks for typos and grammatical errors

`grammatical` `typo` `language` `writing` `words`

---

### [Writing Assistant](https://os.sperax.io/crypto/agents/writing-assistant)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-06**</sup>

Helps improve the quality of a text

`evaluation` `improvement` `correction` `feedback`

---

### [CAN: Programming Master](https://os.sperax.io/crypto/agents/can)

<sup>By **[@MrHuangJser](https://github.com/MrHuangJser)** on **2024-02-06**</sup>

CAN: Professional programming expert with years of experience, no character limits. Provides entrepreneurial planning services including creative naming, slogans, user personas, pain points, value propositions, sales channels, revenue streams, and cost structures.

`Programming` `Communication` `Questions`

---

### [Socratic Teacher](https://os.sperax.io/crypto/agents/socratic-teacher)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-06**</sup>

Helps you learn things by leading you to answers

`thinking` `student` `learning`

---

### [Form Checker](https://os.sperax.io/crypto/agents/form-checker)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-06**</sup>

Checks for inconsistencies or errors in forms

`form` `inconsistency` `check` `spelling` `correction`

---

### [Marvin](https://os.sperax.io/crypto/agents/helps-you-with-your-homework-or-not)

<sup>By **[@Zisan-uzum](https://github.com/Zisan-uzum)** on **2024-02-06**</sup>

Answers questions in sarcastic way.

`depressive` `sarcastic`

---

### [Database Expert](https://os.sperax.io/crypto/agents/dba)

<sup>By **[@xuzhen1994](https://github.com/xuzhen1994)** on **2024-02-03**</sup>

Providing professional advice on database design paradigms, index optimization, query performance tuning, data security, backup and recovery, and more.

`Database` `DBA` `MySQL` `ClickHouse` `Doris` `MongoDB` `Oracle`

---

### [Presentation Wizard](https://os.sperax.io/crypto/agents/word)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-02-03**</sup>

App Presentation Maker Bot for Word: Assists in creating impressive and professional app presentations in Microsoft Word.

`app-presentation` `microsoft-word` `bot` `assistance` `template`

---

### [Variable Naming Master](https://os.sperax.io/crypto/agents/variable-naming-assistant)

<sup>By **[@undefinedZNN](https://github.com/undefinedZNN)** on **2024-01-31**</sup>

Master programming variable naming, provide multiple suggestions, and explain usage scenarios.

`Variable Naming` `Programming` `Suggestions`

---

### [SagePathfinder](https://os.sperax.io/crypto/agents/sage-pathfinder)

<sup>By **[@Ajasra](https://github.com/Ajasra)** on **2024-01-31**</sup>

Expert in personal growth coaching with a focus on stoicism, deep reflection, and strategic questioning.

`personal-growth` `coaching` `reflection` `goal-setting` `well-being`

---

### [Mathematical Research Advisor](https://os.sperax.io/crypto/agents/mathematical-research-advisor)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-30**</sup>

Math Research Assistant: Assisting with mathematical research, problem-solving, and providing guidance in a wide range of mathematical concepts and techniques.

`mathematics` `research` `assistance` `problem-solving` `communication`

---

### [English Proficiency Coach](https://os.sperax.io/crypto/agents/english-c-2-level)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-30**</sup>

C2 Level English Conversation Partner

`english-proficiency` `conversation-partner` `language-coaching`

---

### [A2 English Conversation Facilitator](https://os.sperax.io/crypto/agents/english-a-2-level)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-30**</sup>

A2 Level English Conversation Partner Bot: Enhancing language skills for basic English learners.

`english-conversation` `language-learning` `teaching`

---

### [Entrepreneurship and Competitiveness Expert](https://os.sperax.io/crypto/agents/entrepreneurship-and-competitiveness-expert)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-30**</sup>

Entrepreneurship and Competitiveness Expert: Guiding individuals to entrepreneurial success and market competitiveness.

`entrepreneurship` `competitiveness` `consulting` `mentoring` `advising`

---

### [C1 Level English Language Facilitator](https://os.sperax.io/crypto/agents/c-1-level-english)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-30**</sup>

English Conversation Partner for C1 Level

`english-conversation` `c-1-level` `language-proficiency` `language-coaching`

---

### [English Language C1 Mastery Coach](https://os.sperax.io/crypto/agents/english-language-c-1-mastery-coach)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-29**</sup>

English Conversation Partner for C1 Level

`english-conversation` `language-proficiency` `advanced-level` `language-coaching` `fluency`

---

### [Software Architecture Strategist](https://os.sperax.io/crypto/agents/software-architecture-strategist)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-29**</sup>

Software Development Architect: Designs scalable and secure software systems, guides development teams, and translates business requirements into technical solutions.

`software-development` `architecture` `design` `leadership` `communication`

---

### [Xiaohongshu Review Assistant](https://os.sperax.io/crypto/agents/xhs-evl-cl)

<sup>By **[@shaoqing404](https://github.com/shaoqing404)** on **2024-01-29**</sup>

Optimize Your Xiaohongshu Copywriting, Get Closer to a Hit, Become a Hit!

`xiaohongshu` `writing` `copywriting` `assessment`

---

### [Bizkaia Entrepreneurship Expert](https://os.sperax.io/crypto/agents/bizkaia-entrepreneurship-expert)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-29**</sup>

Entrepreneurship and Competitiveness Expert for Bizkaia Deputation, providing tailored guidance and support to local entrepreneurs.

`bizkaia` `entrepreneurship` `consulting` `mentorship` `local-business-ecosystem` `market-dynamics` `business-plans` `financial-models` `funding-strategies` `marketing` `branding` `sales-strategies` `networking` `entrepreneurship-programs` `guidance` `local-resources` `funding-opportunities` `collaboration` `sustainable-business-practices` `economic-development`

---

### [Territory Promotion Strategist](https://os.sperax.io/crypto/agents/biskaya)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-29**</sup>

Expert in Territorial Competitiveness and Promotion

`territorial-competitiveness` `promotion` `consulting` `marketing` `event-coordination`

---

### [Geopolitical Analyst](https://os.sperax.io/crypto/agents/geo)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Geopolitics Specialist: Expert in analyzing global political trends, regional conflicts, and power dynamics between countries. Provides insights on the impact of geography, resources, and culture on international relations. Offers historical context and case studies.

`geopolitics` `analysis` `expertise` `consulting`

---

### [Software Development Step Maker](https://os.sperax.io/crypto/agents/coder)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Software Development Step Maker: Guides users through the software development process, providing step-by-step instructions and best practices for requirements gathering, design, coding, testing, deployment, and maintenance.

`software-development` `step-by-step` `sdlc` `agile-methodologies` `version-control` `continuous-integration` `continuous-deployment` `team-roles` `project-management` `coding-best-practices` `testing` `deployment` `post-deployment` `iterative-development`

---

### [English Learning Companion](https://os.sperax.io/crypto/agents/language)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

A1 Level English Conversation Partner Bot: Engage, Correct, and Build Confidence.

`english-learning` `conversation-practice` `language-support` `beginner-level` `language-skills`

---

### [B2 Level English Conversation Partner](https://os.sperax.io/crypto/agents/english-b-2-level)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

B2 Level English Conversation Partner: Stimulate engaging conversations, refine idiomatic expressions, master advanced grammar, provide comprehensive feedback.

`english-conversation` `language-proficiency` `fluency` `grammatical-constructs` `vocabulary` `idiomatic-expressions`

---

### [B1 English Conversation Partner](https://os.sperax.io/crypto/agents/learning)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Fluent English conversation partner for B1 level learners

`english-learning` `conversation-partner` `language-practice`

---

### [Poetry Mentor](https://os.sperax.io/crypto/agents/poetry)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Poetry Guide: Inspiring poetic expression and appreciation.

`poetry` `teaching` `writing` `feedback` `creativity`

---

### [Slang Tutor](https://os.sperax.io/crypto/agents/slang)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

English Slang Conversation Partner

`slang` `language-learning` `conversation-partner`

---

### [Jamaican Patois Instructor](https://os.sperax.io/crypto/agents/patois)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Expert in teaching Jamaican Patois language and culture

`teaching` `language` `culture` `cultural-insights` `language-instruction`

---

### [Rap Instructor](https://os.sperax.io/crypto/agents/rap)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Rap Teacher: Educating on rap music and lyricism, guiding users to create and perform their own verses.

`rap` `teaching` `education` `lyrics` `performance`

---

### \[Poetry Guide: Inspiring poetic expression and appreciation.

Psychologist: Promoting understanding and personal growth.]\(<https://os.sperax.io/crypto/agents/doctor>)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-28**</sup>

Psychology Educator: Empowering personal growth through psychology.

Psychologist: Educating on psychology principles for better mental health.

`psychology` `education` `mental-health` `well-being` `therapy`

---

### [Steam Game Reviews](https://os.sperax.io/crypto/agents/steam-agent)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-01-27**</sup>

Steam Game Expert Advisor, Popular Game Recommendations, and In-Depth Game Analysis

`steam` `game recommendations` `game reviews`

---

### [Bilibili Assistant](https://os.sperax.io/crypto/agents/bilibili-agent)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-01-27**</sup>

Bilibili Assistant, skilled at parsing video content, generating well-formatted text, responding to user queries, and recommending the latest videos.

`video comments` `danmaku extraction` `bilibili` `bilibili` `video search`

---

### [AI Import/Export Advisor](https://os.sperax.io/crypto/agents/import-and-export-advisor)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-26**</sup>

AI Import and Export Advisor: Providing guidance on global trade, customs regulations, documentation, trade agreements, and risk management.

`import-export` `trade` `consulting`

---

### [Culinary AI Mentor](https://os.sperax.io/crypto/agents/chef)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-26**</sup>

AI Master Chef Assistant: Inspiring home cooks with international cuisines, recipes, and culinary expertise.

`cooking` `recipe` `culinary` `techniques` `meal-planning`

---

### [TaxBot](https://os.sperax.io/crypto/agents/tax-bot)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-26**</sup>

AI Tax Consultant Chatbot: Providing general tax information and guidance worldwide.

`tax-consulting` `chatbot` `information` `guidance` `tax-concepts`

---

### [Songwriting Mentor](https://os.sperax.io/crypto/agents/singer)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-26**</sup>

AI Singer/Songwriter Assistant: Empowering musicians with creative guidance and feedback.

`ai-assistant` `singer` `songwriter` `music` `creative-process`

---

### [OpenAPI Generator](https://os.sperax.io/crypto/agents/openapi-generator)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-01-26**</sup>

Parse API documentation and generate the openapi.json file required for ChatGPT Tools

`Automation Tools` `API Documentation` `Workflow` `OpenAPI`

---

### [ShieldsIO Badge Generator](https://os.sperax.io/crypto/agents/shields-io)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-01-26**</sup>

Skilled in using `shields.io` to generate stylish badges

`Badge Generator` `Styling` `UI Design` `Markdown` `Technology Stack` `shields-io`

---

### [Figure Designer](https://os.sperax.io/crypto/agents/art-toy-designer)

<sup>By **[@RayGicEFL](https://github.com/RayGicEFL)** on **2024-01-25**</sup>

Expert in designing unique and captivating figures based on user requirements.

`Design` `Figure Design`

---

### [React Native Coding Guide](https://os.sperax.io/crypto/agents/react-native)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-25**</sup>

React Native Coding Assistant: Expert in TypeScript, Expo, and cross-platform development. Provides guidance on setup, best practices, troubleshooting, responsive design, marketing integration, QR code functionality, and app submission.

`coding` `react-native` `type-script` `expo` `development`

---

### [Text Summarization Assistant](https://os.sperax.io/crypto/agents/summary-assistant)

<sup>By **[@muxinxy](https://github.com/muxinxy)** on **2024-01-25**</sup>

Excels at accurately extracting key information and providing concise summaries

`Text Summarization` `Information Extraction` `Concise and Clear` `Accuracy`

---

### [Intention Resonance GPT](https://os.sperax.io/crypto/agents/intention-resonates-gpt)

<sup>By **[@AIConductor](https://github.com/AIConductor)** on **2024-01-24**</sup>

An AI focused on deeply understanding user needs. Through continuous intention alignment, it accurately captures user intentions and requirements, providing the most suitable solutions.

`Dialogue` `Deep Understanding`

---

### [Startup Tech Lawyer](https://os.sperax.io/crypto/agents/tech-lawyer)

<sup>By **[@daniel-jojo](https://github.com/daniel-jojo)** on **2024-01-23**</sup>

In-house legal counsel for a tech startup, offering clear, practical legal advice to support the startup's growth and protect its interests.

`intellectual-property-law` `data-privacy-compliance` `contract-negotiation` `tech-startup-legal-strategy` `employment-law-guidance`

---

### [Shopping Assistant](https://os.sperax.io/crypto/agents/shop)

<sup>By **[@guluahljj](https://github.com/guluahljj)** on **2024-01-22**</sup>

Shopping Assistant specialized in product search, price comparison, and providing purchase links

`Shopping Assistant` `Product Search` `Price Comparison` `Purchase Advice` `Customer Inquiry` `agulu`

---

### [EOI Exam Preparation Assistant](https://os.sperax.io/crypto/agents/teacher)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-21**</sup>

English Teacher: Expert in Exam Preparation and Language Instruction

`teaching` `languagelearning` `exams`

---

### [Chinese-Japanese Bilingual Translation Expert](https://os.sperax.io/crypto/agents/zh-jp-translate-expert)

<sup>By **[@REXY-STUDIO](https://github.com/REXY-STUDIO)** on **2024-01-21**</sup>

Proficient in Chinese and Japanese, providing accurate translations from Chinese to Japanese and Japanese to Chinese.

`Translation` `Chinese-Japanese Translation` `Language Exchange`

---

### [DIY Guidance Assistant](https://os.sperax.io/crypto/agents/diy)

<sup>By **[@guluahljj](https://github.com/guluahljj)** on **2024-01-21**</sup>

DIY project assistant providing detailed guidance, programming support, and personalized customization

`diy` `guidance` `project` `programming` `assembly`

---

### [Business Guru](https://os.sperax.io/crypto/agents/business-guru)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-21**</sup>

Business Consultant: Providing comprehensive business support and expertise worldwide.Capabilities: Business strategy, market research, financial analysis, operations improvement, marketing and sales strategies, organizational development, talent management.Instructions: Define scope, gather business knowledge, develop industry expertise, implement market research and analysis, enable financial analysis and forecasting, facilitate operations and process improvement, provide marketing and sales strategies, support organizational development and talent management, test and refine, ensure data privacy and security.

`business-consultant`

---

### [IELTS Tutor](https://os.sperax.io/crypto/agents/ielts-mentor)

<sup>By **[@sheepbox8646](https://github.com/sheepbox8646)** on **2024-01-21**</sup>

Expertise in IELTS assessment and guidance

`IELTS Exam` `Assessment` `Guidance` `Examiner`

---

### [Kusanali·Nashia](https://os.sperax.io/crypto/agents/nahida)

<sup>By **[@guluahljj](https://github.com/guluahljj)** on **2024-01-21**</sup>

The Grass God's realm in Sumeru, Nashia, governs natural growth and wisdom. She can manipulate plants, heal allies, and guide lost souls. Gentle and intelligent in personality, her speech is poetic and full of charm.

`role-playing` `game` `literature` `translation` `creativity` `agulu`

---

### [Financial Expert](https://os.sperax.io/crypto/agents/finnance)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-21**</sup>

Finance Expert with Global Financial Expertise, Multilingual Communication, Financial Analysis and Reporting, Investment Planning and Portfolio Management, Financial Planning and Retirement Strategies, and Risk Management and Insurance capabilities.

`inancial-management`

---

### [Accounting Expert Assistant](https://os.sperax.io/crypto/agents/accounting)

<sup>By **[@MYSeaIT](https://github.com/MYSeaIT)** on **2024-01-21**</sup>

Accountant Agent: Comprehensive accounting support and expertise for individuals and businesses worldwide.

`accounting` `financial-management` `tax-planning` `budgeting`

---

### [Tech Explorer AI](https://os.sperax.io/crypto/agents/tech-explorer-ai)

<sup>By **[@110rever](https://github.com/110rever)** on **2024-01-19**</sup>

Technology exploration AI capability: - Conduct comprehensive technical research - Provide predictive insights based on statistical data and trend analysis - Optimize research methodology - Maintain data accuracy and completeness - Infer limitations in the absence of complete data: - Only answer questions related to technology - Do not provide general purchasing advice - Provide product technology discussion through step-by-step guidance User interaction: - Provide clear and concise dialogue - Provide multilingual options Support objective: To provide accurate information and analyze predictions to deepen the understanding of technology among users.

`technical-research` `data-analysis` `research-methods` `data-accuracy` `inference` `user-interaction`

---

### [PromptGPT](https://os.sperax.io/crypto/agents/prompt-gpt)

<sup>By **[@110rever](https://github.com/110rever)** on **2024-01-19**</sup>

A customized GPT model named PromptGPT. My aim is to generate high-performance prompts based on the topics input by users.

`generation` `artificial-intelligence` `interaction` `customized-experience` `feedback-mechanism` `best-practices` `step-by-step-guidance` `language-flexibility` `boundaries`

---

### [Code Companion](https://os.sperax.io/crypto/agents/code-companion)

<sup>By **[@110rever](https://github.com/110rever)** on **2024-01-18**</sup>

The best companion for programmers

`code` `dev` `program`

---

### [AE Script Development Expert](https://os.sperax.io/crypto/agents/ae-script-development)

<sup>By **[@Wutpeach](https://github.com/Wutpeach)** on **2024-01-18**</sup>

AE Script Development Expert, proficient in JavaScript programming, understanding of AE software workflow, capable of debugging and optimizing scripts.

`Script Development` `Programmer` `Adobe After Effects` `JavaScript` `Algorithm Design` `Debugging` `Optimization` `Coding Standards` `User Communication` `Script Usage Instructions`

---

### [William](https://os.sperax.io/crypto/agents/unreal-engine-development-engineer)

<sup>By **[@Wutpeach](https://github.com/Wutpeach)** on **2024-01-16**</sup>

Unreal Engine expert, proficient in C++ programming, rendering, memory, threading, and pipeline architecture. Experienced in applying UE on Android platforms, with comprehensive artistic knowledge, familiar with shader development, and skilled in the workflow and tools for creating 3D art assets.

`Unreal Engine` `C programming` `Rendering pipeline` `Memory management` `Thread architecture`

---

### [Healthy Eating Habits for Busy Professionals](https://os.sperax.io/crypto/agents/seo-optimized-blog)

<sup>By **[@Soyeb](https://github.com/sekhsoyebali)** on **2024-01-15**</sup>

Discover effective strategies for maintaining healthy eating habits despite a hectic schedule. Tips, meal ideas, and practical advice for busy professionals to stay energized and healthy.

`healthy eating` `busy professionals` `nutrition` `meal planning` `wellness` `content-writing` `100-unique-blog` `human-written-blog`

---

### [Chad](https://os.sperax.io/crypto/agents/chad)

<sup>By **[@HerIsDia](https://github.com/HerIsDia)** on **2024-01-15**</sup>

Just chad

`humor` `funny`

---

### [Life Decision Advisor](https://os.sperax.io/crypto/agents/life-decision-advisor)

<sup>By **[@amitalokbera](https://github.com/amitalokbera)** on **2024-01-11**</sup>

A Life Decision Advisor is a virtual guide designed to assist users in making informed life decisions

`prompt`

---

### [English Linguist](https://os.sperax.io/crypto/agents/english-teacher)

<sup>By **[@fmaxyou](https://github.com/fmaxyou)** on **2024-01-11**</sup>

Specializing in English word and phrase explanations and memory techniques

`English Teaching` `Explanation` `Memory Skills`

---

### [Computer Science Thesis Polishing](https://os.sperax.io/crypto/agents/cs-research-paper)

<sup>By **[@McKinleyLu](https://github.com/McKinleyLu)** on **2024-01-10**</sup>

Specializes in polishing master's theses

`polishing` `thesis` `education` `computer science`

---

### [Emoji Generation](https://os.sperax.io/crypto/agents/emoji-generate)

<sup>By **[@mushan0x0](https://github.com/mushan0x0)** on **2024-01-09**</sup>

Generate Emoji expressions based on content

`Emoji Generation` `emoji` `creative`

---

### [Personal Growth Coach](https://os.sperax.io/crypto/agents/personal-growth-coach)

<sup>By **[@Ajasra](https://github.com/Ajasra)** on **2024-01-08**</sup>

As an AI Personal Growth Coach, your primary objective is to assist users in their journey of self-improvement and personal development

`personal-growth` `coaching` `self-improvement` `goal-setting` `motivation`

---

### [SVG Flowchart Explanation Assistant](https://os.sperax.io/crypto/agents/svg-flowchart-explanation-assistant)

<sup>By **[@Justin3go](https://github.com/Justin3go)** on **2024-01-05**</sup>

SVG flowchart explanation, input SVG source code to interpret the flowchart

`Flowchart Explanation` `Technical Documentation Writing` `Business Knowledge`

---

### [Performance Evaluation Superhero](https://os.sperax.io/crypto/agents/kpi-hero)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2024-01-05**</sup>

Skilled in writing performance review reports and year-end summaries

`Performance Review` `Report Writing` `Data Analysis` `Professional Insights` `OKR` `KPI`

---

### [Weekly Report Assistant](https://os.sperax.io/crypto/agents/write-report-assistant-development)

<sup>By **[@CaoYunzhou](https://github.com/CaoYunzhou)** on **2024-01-05**</sup>

Weekly report generation assistant

`Weekly Report` `Daily Report` `Writing` `Summary`

---

### [3D Animation Engineer](https://os.sperax.io/crypto/agents/react-three-3-d-expert)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2024-01-03**</sup>

Proficient in React, Three.js, React Three Fiber (r3f), Drei, and other libraries, capable of creating high-level 3D visual effects and animations within web applications.

`3D Animation` `React` `Three.js` `Web Design` `Animation`

---

### [Amazon Title Assistant](https://os.sperax.io/crypto/agents/amazon)

<sup>By **[@cm2457618290](https://github.com/cm2457618290)** on **2024-01-02**</sup>

Provide product keywords or product links to automatically write titles and product introductions

`assistant`

---

### [Exam Assistant](https://os.sperax.io/crypto/agents/generador-examenes)

<sup>By **[@aitorroma](https://github.com/aitorroma)** on **2024-01-02**</sup>

I am a skills summary assistant and cannot perform interactive exams. However, I can help you summarize your skills and knowledge in a clear and concise format.

`exam` `learning` `statistics`

---

### [Teaching Mentor](https://os.sperax.io/crypto/agents/ljrwwjl-development)

<sup>By **[@ljr1314](https://github.com/ljr1314)** on **2024-01-02**</sup>

A friendly and helpful mentor who customizes explanations and examples based on the user's learning level and interests, ensuring clarity and simplicity. Ask 4 questions, then provide explanations, examples, and analogies, and check understanding through questions. Finally, have the user explain the topic in their own words and give an example. End positively and encourage deeper learning.

`mentor` `education` `explanation` `communication` `learning`

---

### [TOEFL Writing Tutor](https://os.sperax.io/crypto/agents/toefl-writing-tutor)

<sup>By **[@richards199999](https://github.com/richards199999)** on **2023-12-30**</sup>

Your TOEFL Writing assistant and evaluator, specializing in feedback and guidance.

`writing` `study`

---

### [MidjourneyGPT](https://os.sperax.io/crypto/agents/prompt-composition)

<sup>By **[@richards199999](https://github.com/richards199999)** on **2023-12-30**</sup>

Write perfect and beautiful prompts for Midjourney. (Including V6!)

`midjourney` `prompt` `ai`

---

### [American English Translation Expert](https://os.sperax.io/crypto/agents/to-local-english)

<sup>By **[@doresu](https://github.com/doresu)** on **2023-12-27**</sup>

Rude old editor, senior writer, and translator skilled in literal translation into English and converting it into authentic American English

`Translation` `Editing` `Writing` `Translator`

---

### [Art Essay Overview Expert](https://os.sperax.io/crypto/agents/thesis-overview)

<sup>By **[@caoyang2002](https://github.com/caoyang2002)** on **2023-12-27**</sup>

Specializes in essay summaries and art reviews

`Art` `Essay` `Review`

---

### [Deployment Specialist Agent](https://os.sperax.io/crypto/agents/deployment-agent)

<sup>By **[@amitalokbera](https://github.com/amitalokbera)** on **2023-12-27**</sup>

An AI Deployment Specialist is an expert in managing the full deployment lifecycle of software applications, particularly web applications.

`code` `deployment` `software`

---

### [Academic Proofreading Expert](https://os.sperax.io/crypto/agents/academic-paragraph-refiner)

<sup>By **[@Feliks151450](https://github.com/Feliks151450)** on **2023-12-26**</sup>

Highly skilled in advanced research proofreading and language editing, specializing in multiple research fields and proficient in academic English.

`proofreading` `writing` `research`

---

### [Flutter Maestro](https://os.sperax.io/crypto/agents/flutter-dev)

<sup>By **[@kamaravichow](https://github.com/kamaravichow)** on **2023-12-25**</sup>

A developer expert in Flutter framework and Dart programming language.

`flutter` `development` `dart` `programming` `widgets`

---

### [Facebook Ads Expert](https://os.sperax.io/crypto/agents/facebook-ads-expert)

<sup>By **[@alissonryan](https://github.com/alissonryan)** on **2023-12-20**</sup>

Create a Facebook Ads with an expert

`copywriting` `facebook-ads` `lead-generation`

---

### [News Hub](https://os.sperax.io/crypto/agents/news-hub)

<sup>By **[@ccdanpian](https://github.com/ccdanpian)** on **2023-12-19**</sup>

News Search Assistant, proficient in locating and presenting relevant news based on user requests. Capable not only of searching for news but also of transforming into experts in various fields to provide precise and in-depth news analysis.

`news` `search` `helper`

---

### [Research Assistant](https://os.sperax.io/crypto/agents/research-assistant)

<sup>By **[@ccsen](https://github.com/ccsen)** on **2023-12-19**</sup>

Capable of answering questions, conducting research, drafting content, and more, utilizing scientific research papers.

`research-assistant` `literature-retrieval` `writing` `scientific-research` `citation`

---

### [Dream Painter](https://os.sperax.io/crypto/agents/dream-painter)

<sup>By **[@ccdanpian](https://github.com/ccdanpian)** on **2023-12-19**</sup>

A dream artist who can bring your dreams into reality.

`txt-2-img` `painter`

---

### [Travel Assistant](https://os.sperax.io/crypto/agents/travel-assistant)

<sup>By **[@ccdanpian](https://github.com/ccdanpian)** on **2023-12-19**</sup>

An experienced outdoor hiking and adventure expert who creates travel plans based on user requirements.

`outdoor` `hiking`

---

### [Greeting](https://os.sperax.io/crypto/agents/congratulations-with-smileys)

<sup>By **[@almaziphone](https://github.com/almaziphone)** on **2023-12-16**</sup>

Create a beautiful and concise congratulatory message with emojis

`congratulation` `holiday` `kind`

---

### [Criminal Defense Expert](https://os.sperax.io/crypto/agents/yundaodev-1)

<sup>By **[@SuperLande](https://github.com/SuperLande)** on **2023-12-16**</sup>

A Chinese criminal law expert with many years of experience in criminal defense practice, knowledgeable in criminal law and criminal procedure law theory.

`Criminal Defense`

---

### [Real Estate Agent](https://os.sperax.io/crypto/agents/estate-agency)

<sup>By **[@ccsen](https://github.com/ccsen)** on **2023-12-16**</sup>

Professional real estate agent expert, proficient in property consultation and management.

`real-estate` `real-estate-agent` `knowledge-expert` `property-appraisal` `buying-a-house` `property-management`

---

### [Case Generator](https://os.sperax.io/crypto/agents/detective-novelist)

<sup>By **[@Sheldon23357](https://github.com/Sheldon23357)** on **2023-12-15**</sup>

Specializes in creating murder mystery stories with red herrings

`Detective` `Game` `Reasoning` `Puzzle` `Detective`

---

### [Short Book](https://os.sperax.io/crypto/agents/book-summary-agent)

<sup>By **[@thelapyae](https://github.com/thelapyae)** on **2023-12-15**</sup>

Specializes in generating concise book summaries with actionable takeaways.

`book-summaries` `ai-assistant` `bullet-point-summaries` `actionable-takeaways`

---

### [Rust Programming Assistant](https://os.sperax.io/crypto/agents/rust-assistant)

<sup>By **[@nagaame](https://github.com/nagaame)** on **2023-12-15**</sup>

Expertise in Rust programming learning support

`rust learning` `programming` `teaching` `skills` `resources`

---

### [Detective Parser](https://os.sperax.io/crypto/agents/detective-game-assistant)

<sup>By **[@Sheldon23357](https://github.com/Sheldon23357)** on **2023-12-15**</sup>

Play a game based on a given murder case

`detective` `game` `reasoning` `puzzle` `investigation`

---

### [Stable Diffusion Prompts Crafter](https://os.sperax.io/crypto/agents/stable-diffusion)

<sup>By **[@ShinChven](https://github.com/ShinChven)** on **2023-12-14**</sup>

I help create precise prompts for Stable Diffusion. You can tell me what you want to imagine, or just send me an image to describe.

`stable-diffusion`

---

### [Community Manager](https://os.sperax.io/crypto/agents/community-manager)

<sup>By **[@MakeTooRRSS](https://github.com/MakeTooRRSS)** on **2023-12-14**</sup>

Social Media Community Manager who will help you create authentic, persuasive posts that call for action. She will help you to create relevant quadrants with emojis and hashtags.

`community-manager` `social-media` `publications`

---

### [Dream Interpreter](https://os.sperax.io/crypto/agents/dream-psychoanalyst)

<sup>By **[@ghyghoo8](https://github.com/ghyghoo8)** on **2023-12-13**</sup>

Enter a dream, and I will help analyze it for you.

`dream` `master` `think`

---

### [Payroll Game](https://os.sperax.io/crypto/agents/payroll-game)

<sup>By **[@ghyghoo8](https://github.com/ghyghoo8)** on **2023-12-13**</sup>

In this salary negotiation game, you'll be facing the notorious 'Iron Rooster,' a boss known for being tight-fisted. As an employee, your challenge is to persuade this boss to give you a raise. However, no matter how reasonable your arguments are, the 'Iron Rooster' always finds a way to reject them. Get ready with your arguments for a clever and humorous showdown!

`game` `boss` `payroll`

---

### [English Translation Expert](https://os.sperax.io/crypto/agents/translate-eng-expert)

<sup>By **[@caolixiang](https://github.com/caolixiang)** on **2023-12-12**</sup>

Perfect translation

`translate` `expert` `english`

---

### [Python Developer Gradio](https://os.sperax.io/crypto/agents/gradio-coding)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2023-12-12**</sup>

Experienced Python programmer with expertise in Gradio for Hugging Face.

`programming` `assistant` `python`

---

### [GitHub Copilot](https://os.sperax.io/crypto/agents/github-copilot)

<sup>By **[@luciouskami](https://github.com/luciouskami)** on **2023-12-11**</sup>

GitHub Copilot

`code` `it`

---

### [Pollination AI Drawing](https://os.sperax.io/crypto/agents/pollinations-drawing)

<sup>By **[@mushan0x0](https://github.com/mushan0x0)** on **2023-12-11**</sup>

A drawing assistant that helps enrich, refine, and optimize user descriptions in English, and invokes drawing capabilities to display images using Markdown syntax.

`drawing` `refinement`

---

### [HTTP Request Master](https://os.sperax.io/crypto/agents/http-request-master)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2023-12-08**</sup>

I support extensive customization) To work, be sure to download and enable the "Website Crawler" plugin!

`http-request` `http` `request` `web`

---

### [Recipe Generator](https://os.sperax.io/crypto/agents/recipe-generator)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2023-12-08**</sup>

Describe the recipe, or send the name of the dish.

`kitchen` `baking` `food` `recipes` `cook`

---

### [Code Wizard](https://os.sperax.io/crypto/agents/friend-developer)

<sup>By **[@Igroshka](https://github.com/Igroshka)** on **2023-12-07**</sup>

Master of programming in various languages

`programming` `coding` `consultation` `friend` `friend` `assistant` `it`

---

### [Mr. Feynman](https://os.sperax.io/crypto/agents/mrfeynman)

<sup>By **[@jjy1000](https://github.com/jjy1000)** on **2023-12-04**</sup>

Simplified explanations of complex knowledge concepts to help you understand difficult ideas. It also provides explanations for knowledge types that include questions and answers.

`General Teacher Assistant`

---

### [Organic Chemistry Researcher](https://os.sperax.io/crypto/agents/organic-chemistry-researcher)

<sup>By **[@y22emc2](https://github.com/y22emc2)** on **2023-12-02**</sup>

Expertise in academic translation and writing in the field of organic chemistry

`Organic Chemistry` `Research` `Translation` `Writing` `Academic Articles`

---

### [JS Code Quality Optimization](https://os.sperax.io/crypto/agents/js-code-quality)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-11-22**</sup>

Dedicated to clean and elegant code refactoring

`Refactoring` `Code Optimization` `Code Quality`

---

### [Q\&A Document Conversion Expert](https://os.sperax.io/crypto/agents/q-a-helper)

<sup>By **[@barryWang12138](https://github.com/barryWang12138)** on **2023-11-22**</sup>

Please provide your document content, and I will segment and clean it according to your requirements, responding in a standardized format.

`q-a` `document`

---

### [Sperax Test Engineer](https://os.sperax.io/crypto/agents/sperax-chat-unit-test-dev)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-11-22**</sup>

Specializes in writing front-end automation tests, with comprehensive coverage for TypeScript applications. Proficient in using the Vitest testing framework, with a deep understanding of testing principles and strategies.

`Automation Testing` `Testing` `sperax-chat` `Frontend`

---

### [Real Old Friend](https://os.sperax.io/crypto/agents/ai-0-x-0-old-friends)

<sup>By **[@mushan0x0](https://github.com/mushan0x0)** on **2023-11-21**</sup>

You can talk to me about anything. I can give you some thoughts and advice as an old friend. Relax.

`friendship` `humor` `realistic` `simulation`

---

### [Short Video Script Assistant](https://os.sperax.io/crypto/agents/tik-tok-director)

<sup>By **[@aihoom](https://github.com/aihoom)** on **2023-11-17**</sup>

Aimed at helping users craft engaging and trendy short video scripts

`Short Video` `tkitok` `Screenwriter`

---

### [Expert Agent Mentor](https://os.sperax.io/crypto/agents/co-agent)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2023-11-16**</sup>

Invoke the most suitable expert agents to support your goals with tasks perfectly aligned to your needs.

`Task Guidance` `Execution Planning` `Communication` `Support`

---

### [Full-stack Developer](https://os.sperax.io/crypto/agents/fs-dev)

<sup>By **[@cloverfield11](https://github.com/cloverfield11)** on **2023-11-15**</sup>

Full-stack web developer with experience in HTML, CSS, JavaScript, Python, Java, Ruby, and frameworks such as React, Angular, Vue.js, Express, Django, Next.js, Flask, or Ruby on Rails. Experienced in databases, application architecture, security, and testing

`web development` `front-end` `back-end` `programming` `databases`

---

### [Tailwind Wizard](https://os.sperax.io/crypto/agents/tailwind-wizard)

<sup>By **[@skyf0cker](https://github.com/skyf0cker)** on **2023-11-15**</sup>

Provides a UI operation to generate HTML

`Development` `Coding` `UI Design`

---

### [Graphic Creativity Master](https://os.sperax.io/crypto/agents/graphic-creativity)

<sup>By **[@yingxirz](https://github.com/yingxirz)** on **2023-11-15**</sup>

Specializes in graphic creative design and visual ideas

`graphics` `creativity` `design` `visual`

---

### [MidJourney Prompt](https://os.sperax.io/crypto/agents/mid-journey-prompt)

<sup>By **[@aihoom](https://github.com/aihoom)** on **2023-11-14**</sup>

Writing awesome MidJourney prompts

`mid-journey` `prompt`

---

### [Dad, what should I do?](https://os.sperax.io/crypto/agents/big-daddy)

<sup>By **[@aihoom](https://github.com/aihoom)** on **2023-11-14**</sup>

A dad who provides comprehensive guidance for children, from daily trivialities to work and marriage.

`Character Simulation`

---

### [Research Article Translation Assistant](https://os.sperax.io/crypto/agents/s-rtranslation)

<sup>By **[@aihoom](https://github.com/aihoom)** on **2023-11-14**</sup>

A translation assistant capable of helping you translate scientific and technological articles

`Research` `Translation`

---

### [Chinese-English Translation Assistant](https://os.sperax.io/crypto/agents/en-cn-translator)

<sup>By **[@tcmonster](https://github.com/tcmonster)** on **2023-11-14**</sup>

Expert in Chinese-English translation, pursuing accuracy, fluency, and elegance

`Translation` `Chinese` `English`

---

### [Academic Writing Enhancement Bot](https://os.sperax.io/crypto/agents/academic-writing-eb)

<sup>By **[@Ruler27](https://github.com/Ruler27)** on **2023-11-11**</sup>

Refinement of academic English spelling and rhetoric.

`proofreading` `rhetoric` `academic` `research` `english` `editing`

---

### [Sketch Feature Summary Expert](https://os.sperax.io/crypto/agents/sketch-changelog-highlighter)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-11-02**</sup>

Expert in extracting key change points from Sketch release notes

`UX Design` `sketch` `updates` `features` `text summary`

---

### [Arguing Master](https://os.sperax.io/crypto/agents/tqg-20231026)

<sup>By **[@cake79](https://github.com/cake79)** on **2023-10-26**</sup>

Simulates those who like to argue, a character that can argue against any opinion input by the user

`Writing` `Dialogue`

---

### [Graph Generator](https://os.sperax.io/crypto/agents/graph-generator)

<sup>By **[@choldrim](https://github.com/choldrim)** on **2023-10-23**</sup>

Automatic Graph Generator

`graph`

---

### [Art Naming Master](https://os.sperax.io/crypto/agents/meaningful-name)

<sup>By **[@yingxirz](https://github.com/yingxirz)** on **2023-10-18**</sup>

Provide concise and meaningful names for your artistic creations.

`Naming` `Creativity`

---

### [Little Red Book Style Copywriter](https://os.sperax.io/crypto/agents/xiaohongshu-style-writer)

<sup>By **[@guowc3456](https://github.com/guowc3456)** on **2023-10-11**</sup>

Skilled at mimicking the style of viral Little Red Book articles for writing

`Little Red Book` `Writing` `Copywriting`

---

### [Agent Prompt Optimization Expert](https://os.sperax.io/crypto/agents/gpt-agent-prompt-improver)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-10-07**</sup>

GPT Agent Prompt Optimization Expert. Clear, precise, concise.

`prompt`

---

### [English News Translation Expert](https://os.sperax.io/crypto/agents/english-news-translator)

<sup>By **[@宝玉](https://twitter.com/dotey)** on **2023-10-07**</sup>

A simple prompt significantly improves ChatGPT's translation quality, saying goodbye to 'machine translation feel'. refs: <https://twitter.com/dotey/status/1707478347553395105>

`translation` `copywriting`

---

### [C++ Code](https://os.sperax.io/crypto/agents/c-code-development)

<sup>By **[@dcityteg](https://github.com/dcityteg)** on **2023-10-06**</sup>

Complete C++ code

`code`

---

### [TS Type Definition Completion](https://os.sperax.io/crypto/agents/typescript-jsdoc)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-10-01**</sup>

Proficient in writing TypeScript JSDoc code

`typescript` `jsdoc`

---

### [LOGO Creative Master](https://os.sperax.io/crypto/agents/logo-creativity)

<sup>By **[@yingxirz](https://github.com/yingxirz)** on **2023-09-29**</sup>

Organizing and generating creative logo ideas for you

`Creativity` `Brainstorming` `Design` `Brand` `Method`

---

### [Interface Type Request Generator](https://os.sperax.io/crypto/agents/swagger-api-to-types)

<sup>By **[@laikedou](https://github.com/laikedou)** on **2023-09-27**</sup>

Quickly export type definitions and request functions from interface descriptions such as Swagger, YAPI, Apifox, etc.

`aigc` `api` `yapi` `swagger` `api-fox`

---

### [Name Master](https://os.sperax.io/crypto/agents/naming-master)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-11**</sup>

Naming expert to help you create unique and meaningful names.

`Naming` `Copywriting`

---

### [Dva Refactoring to Zustand Expert](https://os.sperax.io/crypto/agents/dva-to-zustand)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

One-click transformation of Dva state management code into Zustand code

`typescript` `code` `software development` `state management` `dva` `zustand`

---

### [UX Writer](https://os.sperax.io/crypto/agents/metaphor-ux-writer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Help you write better UX copy

`user experience` `designer` `documentation` `writing` `metaphor`

---

### [Information Organization Master](https://os.sperax.io/crypto/agents/content-searcher)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

An information organization master that helps you gather, summarize, and organize content and assets.

`Search Engine` `Internet Connectivity` `Information Organization`

---

### [Web Content Summarization Expert](https://os.sperax.io/crypto/agents/url-summary)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Simply input a URL, and the assistant will read and summarize the content of that URL for you.

`web` `reading` `summarization` `online`

---

### [Title Expansion Expert](https://os.sperax.io/crypto/agents/title-expansion-writer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

If you need to add a description to a title, let this assistant help you craft the content.

`User Experience` `Designer` `Documentation` `Writing`

---

### [Master of Abstract Concept Embodiment](https://os.sperax.io/crypto/agents/conceptual-abstractor)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Helping you write better UX copy

`User Experience` `Designer` `Documentation` `Writing` `Metaphor` `Concept`

---

### [Frontend Development Architect](https://os.sperax.io/crypto/agents/frontend-architect)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Expert in architecture, proficient in technical details, skilled in searching for solutions via search engines

`typescript` `code` `frontend` `architect` `networking` `search engines` `information organization`

---

### [API Documentation Optimization Expert](https://os.sperax.io/crypto/agents/api-docs-writer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Accurately describe how to use APIs, provide example code, precautions, and return value type definitions.

`Code` `Software Development` `Programmer` `Documentation` `Writing`

---

### [Zustand reducer Expert](https://os.sperax.io/crypto/agents/zustand-reducer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Skilled in writing zustand feature code, capable of generating reducer code from requirements with one click, familiar with reducer writing, proficient in using the immer library.

`typescript` `reducer` `code` `frontend` `software development` `state management` `zustand`

---

### [React Class Components to FC Components](https://os.sperax.io/crypto/agents/react-cc-to-fc)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

One-click transformation of Class components into FC components

`typescript` `code` `software development` `react` `refactoring`

---

### [UX Writer](https://os.sperax.io/crypto/agents/better-ux-writer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Helping you craft better UX copy

`User Experience` `Designer` `Documentation` `Writing`

---

### [JS Code to TS Expert](https://os.sperax.io/crypto/agents/js-to-ts)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Input your JS code, and with one click, it will help you complete and improve type definitions

`typescript` `js` `code` `frontend` `software development`

---

### [Frontend TypeScript Unit Test Expert](https://os.sperax.io/crypto/agents/frontend-test-analyzer)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-10**</sup>

Based on the code you provide, consider scenarios that need coverage testing

`typescript` `unit testing` `code` `software development`

---

### [Deep Think](https://os.sperax.io/crypto/agents/deep-think)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-08**</sup>

Deeper thinking of question

`conversation` `thinking`

---

### [Markdown Product Feature Formatting Expert](https://os.sperax.io/crypto/agents/markdown-feature-polisher)

<sup>By **[@Fontas](https://github.com/Fontas)** on **2023-09-08**</sup>

Helps you quickly generate beautiful and elegant product feature introductions

`product` `markdown` `documentation`

---

### [A More Diligent Assistant](https://os.sperax.io/crypto/agents/web-development)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

A More Diligent Assistant

`Learning` `software-development` `productivity`

---

### [Resume Editing](https://os.sperax.io/crypto/agents/resume-editing)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Get advice on how to edit your resume

`academic` `productivity` `guide`

---

### [Startup Plan](https://os.sperax.io/crypto/agents/startup-plan)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Generate a detailed and comprehensive business plan within minutes

`startup` `brainstorming` `plan`

---

### [Character Roleplay](https://os.sperax.io/crypto/agents/character-roleplay)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Interact with your favourite characters from movies, TV shows, books, and more!

`conversation` `roleplay` `fun`

---

### [Essay Improver](https://os.sperax.io/crypto/agents/essay-improver)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Improve your texts to be more elegant and professional

`academic` `english` `productivity` `essay`

---

### [Grammar Corrector](https://os.sperax.io/crypto/agents/grammar-corrector)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Correct grammar error text or paragraph. Great for essay or email

`academic` `productivity` `essay`

---

### [Agent Prompt Improver](https://os.sperax.io/crypto/agents/agent-prompt-improver)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

GPT Agent Prompt optimization specialist. Clear, precise, and concise

`agent` `prompt`

---

### [Coding Wizard](https://os.sperax.io/crypto/agents/coding-wizard)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-07**</sup>

Can generate the code for anything you specify

`code` `software-development` `productivity`

---

### [Stable Diffusion Prompt Expert](https://os.sperax.io/crypto/agents/stable-diffusion-prompt)

<sup>By **[@Binxeh](https://github.com/Binxeh)** on **2023-09-01**</sup>

Specializes in writing Stable Diffusion prompts

`stable-diffusion` `prompt`

<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Your complete guide to Lyra's development environments
-->

# Development Environment Guide

Lyra Web3 Playground includes **multiple professional development environments** for web and blockchain development.

## Quick Navigation

| Environment | Best For | URL |
|-------------|----------|-----|
| [Web Sandbox](#-web-sandbox) | HTML/CSS/JS/React/Vue/Python | [/ide?type=web](https://lyra.works/ide?type=web) |
| [Solidity IDE](#-solidity-ide) | Smart contract development | [/ide?type=solidity](https://lyra.works/ide?type=solidity) |
| [Interactive Sandbox](#-interactive-sandbox) | AI-assisted contract development | [/sandbox](https://lyra.works/sandbox) |
| [Contract Playground](#-contract-playground) | Template-based learning | [/playground](https://lyra.works/playground) |
| [Full-Stack Playground](#-full-stack-playground) | Complete dApp building | [/fullstack-demo](https://lyra.works/fullstack-demo) |
| [Learning Playground](#-learning-playground) | Interactive tutorials | [/learn](https://lyra.works/learn) |

---

## Web Sandbox

**Location:** [lyra.works/ide?type=web](https://lyra.works/ide?type=web)  
**Component:** `src/components/Sandbox/WebSandbox.tsx`

A full-featured web development environment with professional-grade features.

### Features

#### Multi-File Project Support
- **File Tree Navigation**: Full folder structure with create/delete/rename
- **Tabbed Interface**: Open multiple files simultaneously
- **Monaco Editor**: The same editor that powers VS Code
- **Auto-save**: Changes persist automatically

#### Live Preview
- **Instant Hot Reload**: See changes as you type
- **Device Presets**: Test on Desktop, Tablet, and Mobile viewports
- **Responsive Testing**: Drag to resize preview window
- **Console Integration**: Capture console.log, errors, and warnings

#### Supported Languages

| Language | Features |
|----------|----------|
| HTML | Full syntax highlighting, Emmet support |
| CSS | Autoprefixer, live reload |
| JavaScript | ES2022+, ES modules |
| TypeScript | Full type checking |
| React/JSX | Component preview, hooks |
| Vue | Single-file components |
| Python | Pyodide runtime (in-browser Python!) |

#### Editor Settings

Access via the gear icon:

| Setting | Options |
|---------|---------|
| Theme | VS Dark / Light |
| Font size | 10-24px |
| Tab size | 2 or 4 spaces |
| Word wrap | On / Off |
| Minimap | Show / Hide |
| Line numbers | On / Off |
| Format on save | Enabled / Disabled |
| **Vim mode** | Full Vim keybindings! |
| Auto-save | Enabled / Disabled |
| Font ligatures | Fira Code style ligatures |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save / Format |
| `Ctrl+Enter` | Run code |
| `Ctrl+/` | Toggle comment |
| `Ctrl+D` | Duplicate line |
| `Ctrl+Shift+K` | Delete line |

#### Export & Share
- Download project as individual files
- Generate shareable URLs
- Copy code snippets

---

## Solidity IDE

**Location:** [lyra.works/ide?type=solidity](https://lyra.works/ide?type=solidity)  
**Component:** `src/components/Sandbox/SoliditySandbox.tsx`

A professional smart contract development environment.

### Features

#### Multi-Version Compiler

| Solidity Version | Status |
|------------------|--------|
| 0.8.24 | ✅ Latest |
| 0.8.20 | ✅ Supported |
| 0.8.17 | ✅ Supported |
| 0.7.x | ✅ Supported |
| 0.6.12 | ✅ Supported |

- **Real-time compilation** with `Ctrl+S`
- **Error/warning highlighting** with line numbers
- **Copy ABI and Bytecode** buttons

#### Network Support

| Network | Type | Notes |
|---------|------|-------|
| JavaScript VM | Local simulation | No wallet needed, instant |
| Sepolia | Ethereum testnet | Free test ETH from faucets |
| Goerli | Ethereum testnet | Legacy testnet |
| Mumbai | Polygon testnet | Fast & cheap |
| Mainnet | Ethereum mainnet | Real ETH required |

#### Account Management

When using JavaScript VM:
- **5 pre-funded test accounts** (100 ETH each)
- Balance tracking
- Nonce management
- Custom gas limit
- Value input in Wei/Gwei/Ether

#### Contract Interaction

After deployment:
- **Deployed Contracts Panel**: Expandable list of all deployed contracts
- **Function Buttons**: Color-coded (blue for read, orange for write)
- **Input Fields**: Type-aware form inputs for function parameters
- **Result Display**: Return values shown inline
- **Transaction History**: Full log with status, gas used, timestamps

#### Console

- Timestamped log messages
- Color-coded by type (log/warn/error/info)
- Clear button
- Collapsible panel

---

## Interactive Sandbox

**Location:** [lyra.works/sandbox](https://lyra.works/sandbox)  
**Component:** `src/components/Sandbox/InteractiveSandbox.tsx`

The original sandbox with AI assistant and Innovation Mode features.

### Features

#### AI Assistant

Three AI modes:

| Mode | What It Does |
|------|-------------|
| **Generate** | Create contracts from natural language prompts |
| **Explain** | Get detailed explanations of any code |
| **Test** | Auto-generate Hardhat or Foundry test suites |

Example prompts:
- "Create an ERC721 NFT contract with minting and royalties"
- "Build a staking contract with 10% APY"
- "Make a DAO with token-based voting"

#### Innovation Mode

Enable to access experimental AI features:
- 🧠 **AI Whisperer**: Real-time vulnerability detection
- ⏰ **Time Machine**: Travel through code history
- 🛡️ **Exploit Lab**: Test security with simulated attacks
- 👥 **Arena**: Collaborative coding with AI
- 🔮 **Neural Gas**: ML-powered gas optimization
- 🌐 **Cross-Chain**: One-click multi-chain deployment

#### Template Library

Pre-built templates:

| Category | Templates |
|----------|-----------|
| Basic | Simple Storage, MultiSig Wallet |
| Tokens | ERC20, Custom Token |
| NFTs | NFT Collection, NFT Marketplace |
| DeFi | Staking, Lending, Yield Farming |

---

## Contract Playground

**Location:** [lyra.works/playground](https://lyra.works/playground)  
**Component:** `src/pages/ContractPlayground.tsx`

A template-focused contract editor for learning and prototyping.

### Features

- **40+ contract templates** searchable by keyword
- **AI prompt generation** (describe what you want)
- **Syntax highlighting** with Monaco Editor
- **Quick deployment** to testnets
- **Template categories**: Tokens, NFTs, DeFi, Governance

### Best For

- Learning from examples
- Quick prototyping
- Finding inspiration

---

## Full-Stack Playground

**Location:** [lyra.works/fullstack-demo](https://lyra.works/fullstack-demo)  
**Component:** `src/components/FullStackPlayground/FullStackPlayground.tsx`

Build complete dApps with contract and frontend components.

### Features

- **Multi-file editing**: Contract + HTML + CSS + JS
- **Live preview**: See your dApp as you build
- **Console output**: Debug frontend and contract calls
- **Responsive preview**: Test on different screen sizes
- **React/TSX support**: Write React components

---

## Learning Playground

**Location:** [lyra.works/learn](https://lyra.works/learn)  
**Component:** `src/pages/InteractiveLearningPlayground.tsx`

Guided, tutorial-style learning environment.

### Features

- Step-by-step tutorials
- Interactive code challenges
- Progress tracking
- Instant feedback

---

## Unified Sandbox

**Component:** `src/components/Sandbox/UnifiedSandbox.tsx`

Used in example pages to show contract + auto-generated frontend side-by-side.

### Features

- Auto-generates React dApp from contract ABI
- Compile → Deploy → Interact workflow
- Live frontend preview
- Supports all contract templates

---

## Feature Comparison Matrix

| Feature | Web Sandbox | Solidity IDE | Interactive Sandbox | Contract Playground | Full-Stack |
|---------|-------------|--------------|---------------------|---------------------|------------|
| Monaco Editor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-file support | ✅ | ✅ | ✅ | ❌ | ✅ |
| Live preview | ✅ | ❌ | ✅ | ❌ | ✅ |
| Solidity compilation | ❌ | ✅ | ✅ | ✅ | ❌ |
| Contract deployment | ❌ | ✅ | ✅ | ✅ | ❌ |
| Device presets | ✅ | ❌ | ❌ | ❌ | ✅ |
| Vim mode | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI Assistant | ❌ | ❌ | ✅ | ✅ | ❌ |
| Innovation Mode | ❌ | ❌ | ✅ | ❌ | ❌ |
| Template library | ❌ | ✅ | ✅ | ✅ | ❌ |
| Python support | ✅ | ❌ | ❌ | ❌ | ❌ |
| React/Vue support | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## Which Should I Use?

| Use Case | Recommended Environment |
|----------|------------------------|
| Learning web development | Web Sandbox |
| Learning Solidity | Contract Playground or Solidity IDE |
| Building production contracts | Solidity IDE |
| Experimenting with AI | Interactive Sandbox + Innovation Mode |
| Building full dApps | Full-Stack Playground |
| Following tutorials | Learning Playground |
| Quick prototyping | Contract Playground |
| Testing on multiple chains | Solidity IDE or Interactive Sandbox |

---

## Related Documentation

- [SANDBOX_GUIDE.md](SANDBOX_GUIDE.md) - Original sandbox documentation
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [INNOVATION_LAB.md](INNOVATION_LAB.md) - AI and experimental features

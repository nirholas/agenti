<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 The journey of a thousand apps begins with a single line 🛤️
-->

# Premium Code Sandbox - World-Class Development Environment

## Overview

The Lyra Playground features a **premium code sandbox** that rivals and exceeds tools like CodePen, JSFiddle, and Ethereum Remix. Our sandbox provides two specialized environments:

1. **Web Sandbox** - For HTML, CSS, JavaScript, React, Vue, and Python development
2. **Solidity IDE** - Professional smart contract development environment

Access both at `/ide` or through any example page.

---

## 🌐 Web Sandbox

A CodePen-like environment for web development with advanced features.

### Features

#### Multi-File Project Support
- **File Tree Navigation**: Full folder structure with create/delete/rename
- **Tabbed Interface**: Open multiple files simultaneously
- **Monaco Editor**: Professional code editor with syntax highlighting, autocomplete
- **Auto-save**: Changes persist automatically

#### Live Preview
- **Instant Hot Reload**: See changes as you type
- **Device Presets**: Test on Desktop, Tablet, and Mobile viewports
- **Responsive Testing**: Drag to resize preview window
- **Console Integration**: Capture console.log, errors, and warnings

#### Supported Languages
| Language | Features |
|----------|----------|
| HTML | Full syntax, Emmet support |
| CSS | Autoprefixer, live reload |
| JavaScript | ES2022+, modules |
| TypeScript | Full type checking |
| React/JSX | Component preview, hooks |
| Vue | Single-file components |
| Python | Pyodide runtime in-browser |

#### Editor Settings
- Theme (VS Dark / Light)
- Font size (10-24px)
- Tab size (2/4 spaces)
- Word wrap toggle
- Minimap toggle
- Line numbers toggle
- Format on save
- Vim mode
- Auto-save
- Font ligatures

#### Export & Share
- Download project as ZIP
- Generate shareable URLs
- Copy code snippets

---

## 🔷 Solidity IDE

A Remix-quality (or better!) smart contract development environment.

### Features

#### Multi-Version Compiler
- Solidity 0.6.12 through 0.8.24
- Real-time compilation (Ctrl+S)
- Error/warning highlighting with line numbers
- Copy ABI and Bytecode buttons

#### Network Support
| Network | Type |
|---------|------|
| JavaScript VM | Local simulation |
| Sepolia | Ethereum testnet |
| Goerli | Ethereum testnet |
| Mumbai | Polygon testnet |
| Mainnet | Ethereum mainnet |

#### Account Management
- 5 pre-funded test accounts (100 ETH each)
- Balance tracking
- Nonce management
- Custom gas limit
- Value in Wei/Gwei/Ether

#### Contract Interaction
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

## 🔀 Unified Sandbox

Every example on the platform now features an integrated sandbox view.

### Automatic Features
- **Contract.sol**: Pre-loaded with the example's smart contract
- **Frontend.jsx**: Auto-generated React dApp from contract ABI
- **Preview**: Live-rendered frontend
- **Deploy & Interact**: Full contract deployment and function calls

### View Toggle
Switch between:
- **Sandbox** (default): Full IDE experience
- **Tutorial**: Traditional step-by-step guide

---

## 🚀 Getting Started

### Access the Sandbox

1. **Direct Access**: Navigate to `/ide`
2. **From Examples**: Click any example, defaults to sandbox view
3. **Quick Links**:
   - `/ide?type=web` - Web Sandbox
   - `/ide?type=solidity` - Solidity IDE

### Quick Start - Web Development

1. Go to `/ide` and select "Web Sandbox"
2. Edit `index.html`, `style.css`, or `script.js`
3. See live preview update automatically
4. Add new files with the + button
5. Toggle device presets for responsive testing

### Quick Start - Smart Contracts

1. Go to `/ide` and select "Solidity IDE"
2. Write or paste your Solidity code
3. Press Ctrl+S or click "Compile"
4. Select network and account
5. Click the orange "Deploy" button
6. Interact with deployed contract in the right panel

---

## Legacy: Interactive Sandbox

The original Interactive Sandbox provides a full-featured, CodeSandbox-like development environment for smart contract development directly in your browser. It combines powerful editing capabilities with live compilation, deployment, and testing features.

## Legacy Features

### 🎨 Multi-File Editor
- **File Tree Navigation**: Browse and manage multiple files in your workspace
- **Tabbed Interface**: Switch between files with an intuitive tab system
- **Monaco Editor**: Full-featured code editor with syntax highlighting, autocomplete, and error detection
- **File Management**: Create, delete, and organize Solidity and other files
- **Auto-save**: Changes are automatically persisted to your workspace

### ⚡ Live Compilation & Deployment
- **One-Click Compilation**: Compile Solidity contracts with multiple compiler versions (0.8.17-0.8.20)
- **Optimization Options**: Enable/disable compiler optimizations
- **Real-time Feedback**: See compilation errors and warnings instantly
- **Testnet Deployment**: Deploy directly to Sepolia, Mumbai, and other testnets
- **Transaction Tracking**: Monitor deployment transactions with explorer links

### 🤖 AI Assistant
Three powerful AI modes to accelerate your development:

1. **Generate**: Create smart contracts from natural language descriptions
   - Example: "Create an ERC721 NFT contract with minting and royalties"
   - AI generates complete, production-ready contract code

2. **Explain**: Get detailed explanations of your code
   - Understand complex contract logic
   - Learn best practices and security patterns
   - Get line-by-line breakdowns

3. **Test**: Automatically generate test suites
   - Creates comprehensive unit tests for your contracts
   - Supports Hardhat and Foundry frameworks
   - Tests edge cases and security scenarios

### 🎯 Contract Interaction Panel
- **Function Discovery**: Automatically detects all public contract functions
- **Read/Write Operations**: Distinguish between view and state-changing functions
- **Form Inputs**: Type-safe input forms for function parameters
- **Result Display**: See function return values and transaction receipts
- **Gas Estimation**: Preview gas costs before sending transactions

### 📝 Console & Logs
- **Real-time Logging**: Track all compilation, deployment, and interaction events
- **Filterable Logs**: Filter by type (info, success, error, warning)
- **Search**: Quickly find specific log messages
- **Export**: Download log files for debugging
- **Timestamps**: Precise timing for all events

### 📚 Template Library
Pre-built templates to kickstart your project:

#### Basic Templates
- **Simple Storage**: State management fundamentals
- **MultiSig Wallet**: Multi-signature authorization patterns

#### Token Templates
- **ERC20 Token**: Fungible token with minting/burning
- **Custom Token**: Extended ERC20 with advanced features

#### NFT Templates
- **NFT Collection**: ERC721 with URI storage
- **NFT Marketplace**: Complete buying/selling platform

#### DeFi Templates
- **Staking Rewards**: Token staking with reward distribution
- **Lending Protocol**: Deposit and borrow functionality
- **Yield Farming**: LP token staking for rewards

### 🔗 Workspace Management
- **Persistent Storage**: Workspaces saved in browser localStorage
- **Export/Import**: Download and share workspace configurations
- **Share Links**: Generate shareable URLs for collaboration
- **Multiple Workspaces**: Switch between different projects

## Getting Started (Legacy)

### 1. Access the Sandbox
Navigate to `/sandbox` or click "Interactive Sandbox" in the navigation bar.

### 2. Choose Your Starting Point

#### Option A: Start with a Template
1. Click the "Template" button in the toolbar
2. Browse available templates by category
3. Select a template to load it into your workspace
4. The template files will be automatically created

#### Option B: Create from Scratch
1. Click the "+" button in the file tree
2. Enter a filename (e.g., `MyContract.sol`)
3. Start coding with full autocomplete support

#### Option C: Use AI to Generate
1. Open the AI Assistant panel (lightning bolt icon)
2. Select "Generate" mode
3. Describe your contract in natural language
4. AI generates the code, which you can insert as a new file

### 3. Develop Your Contract

#### Editing
- Use the Monaco editor with Solidity syntax highlighting
- Multiple files open in tabs
- Auto-complete and error detection
- Real-time syntax checking

#### Compilation
1. Select your desired Solidity version (0.8.17-0.8.20)
2. Click the "Compile" button
3. View any warnings or errors in the console
4. Green checkmark indicates successful compilation

### 4. Deploy to Testnet

#### Prerequisites
- MetaMask or compatible wallet installed
- Connected to a supported testnet (Sepolia, Mumbai)
- Sufficient testnet ETH for gas fees

#### Deployment Steps
1. Ensure your contract is compiled (see green checkmark)
2. Connect your wallet if not already connected
3. Click the "Deploy" button
4. Confirm the transaction in your wallet
5. Wait for deployment confirmation
6. Contract address and explorer link appear in console

### 5. Interact with Your Contract

#### Reading Data (View Functions)
1. Switch to the "Interact" panel
2. Find your function in the list (marked with eye icon)
3. Fill in any required parameters
4. Click "Read" to execute
5. Result displays below the function

#### Writing Data (State-Changing Functions)
1. Locate the function (marked with send icon)
2. Enter parameter values
3. Click "Write" to initiate transaction
4. Confirm in your wallet
5. Transaction hash and status appear in console

### 6. Debug and Monitor

#### Console Panel
- View all events chronologically
- Filter by type (info, success, error, warning)
- Search for specific messages
- Export logs for external analysis

#### Transaction Details
- View transaction hashes
- Click explorer links to see on-chain data
- Monitor gas usage
- See revert reasons for failed transactions

## Advanced Features

### Layout Options
- **Horizontal Layout**: Editor left, panels right (default)
- **Vertical Layout**: Editor top, panels bottom
- Toggle with the maximize/minimize button

### File Tree Customization
- Toggle visibility with the folder icon
- Create nested file structures
- Organize by contract type or feature

### Keyboard Shortcuts
- `Ctrl/Cmd + S`: Save file (auto-save enabled by default)
- `Ctrl/Cmd + F`: Find in editor
- `Ctrl/Cmd + H`: Find and replace
- `F1`: Command palette

### AI Best Practices
1. **Be Specific**: More detailed prompts yield better results
   - ❌ "Create a token"
   - ✅ "Create an ERC20 token with 1M supply, 18 decimals, and minting limited to owner"

2. **Iterate**: Use "Explain" to understand generated code, then refine

3. **Test Generation**: Generate tests after finalizing your contract logic

### Workspace Sharing
1. Click the share icon in toolbar
2. Link is automatically copied to clipboard
3. Share the URL with collaborators
4. Recipients can view and fork your workspace

## Troubleshooting

### Compilation Fails
- **Check Solidity version**: Ensure you're using a compatible version
- **Review imports**: Verify all import statements are correct
- **Check syntax**: Look for missing semicolons, brackets, etc.
- **View console**: Detailed error messages appear in the console

### Deployment Fails
- **Wallet connected**: Ensure MetaMask is connected
- **Correct network**: Switch to the intended testnet
- **Sufficient balance**: Get testnet ETH from faucets
- **Gas limits**: Try increasing gas limit manually in MetaMask

### Contract Interaction Fails
- **Contract deployed**: Verify deployment was successful
- **Correct parameters**: Check input types match function signature
- **Sufficient allowance**: For token interactions, ensure approval
- **Gas price**: Network congestion may require higher gas

## Tips & Tricks

### Development Workflow
1. Start with a template or AI generation
2. Compile frequently to catch errors early
3. Use AI explain to understand complex patterns
4. Deploy to testnet once stable
5. Interact thoroughly to test all functions
6. Generate tests with AI
7. Export workspace for backup

### Performance Optimization
- Close unused file tabs to reduce memory usage
- Clear console logs periodically
- Export and reimport workspaces to reset state

### Security Best Practices
- Always test on testnets before mainnet
- Use AI explain to identify potential vulnerabilities
- Follow compiler warnings
- Review generated code carefully
- Test edge cases in contract interaction

## API Integration

The sandbox integrates with the backend API for:
- **Compilation**: Server-side Solidity compilation
- **Deployment**: Contract deployment to testnets
- **AI Services**: OpenAI-powered features
- **IPFS**: File storage (coming soon)
- **Faucet**: Testnet funding (coming soon)

## Browser Compatibility

Tested and optimized for:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Storage & Privacy

- **Local Storage**: Workspaces saved in browser localStorage
- **No Server Storage**: Your code stays on your device
- **Share Links**: Encoded workspace data in URL
- **Privacy**: No tracking or analytics on code content

## Future Enhancements

Coming soon:
- [ ] Hardhat/Foundry fork sandboxes
- [ ] Gas profiling and optimization
- [ ] Contract verification
- [ ] Integrated testing framework
- [ ] Subgraph integration
- [ ] Multi-file debugging
- [ ] Version control integration
- [x] Cloud sync with authentication ✅
- [x] Community sharing ✅
- [ ] Collaborative editing
- [ ] Custom themes

---

## 🌍 Community Features

Share your creations with the world and discover projects from other developers.

### Wallet-Based Authentication

Community features use **wallet connect** instead of traditional login:

1. Connect your MetaMask or compatible wallet
2. Your wallet address serves as your identity
3. No email, password, or account creation required
4. Sign transactions to prove ownership

### Sharing Projects

1. Click the **Share** button in the sandbox header
2. If not connected, a wallet connect modal appears
3. Connect your wallet to proceed
4. Add a title and description
5. Choose a category (Sandbox, Template, Tutorial, Example)
6. Add tags for discoverability
7. Select visibility (Public or Unlisted)
8. Click **Share** to publish

### Explore Page (`/explore`)

Discover shared projects from the community:

- **Search**: Find projects by keyword
- **Categories**: Filter by Sandbox, Template, Tutorial, or Example
- **Sort**: By Most Recent, Most Viewed, or Most Liked
- **View modes**: Grid or List view

### Project Details (`/shared/:token`)

View any shared project with:

- **Full Code View**: Monaco editor with read-only access
- **Like & Fork**: Show appreciation or create your own copy
- **Comments**: Discuss with other developers
- **Stats**: Views, likes, and forks count
- **Embed Code**: Add projects to your own site
- **Open in IDE**: Continue working on any project

### Social Features

All social features require wallet connection:

- **Likes**: Connect wallet to like projects
- **Comments**: Connect wallet to leave feedback
- **Forks**: Connect wallet to create your own copy
- **Sharing**: Connect wallet to publish projects

### Embed Projects

Share projects on external sites with embed code:

```html
<iframe 
  src="https://lyra.works/embed/[share_token]?theme=dark"
  width="100%"
  height="500px"
  style="border: 1px solid #374151; border-radius: 8px;"
  loading="lazy"
  allow="clipboard-write"
></iframe>
```

---

## 📊 Market Data Integration

Real-time cryptocurrency and DeFi market data is available throughout the platform.

### Markets Page (`/markets`)

Comprehensive market dashboard with four tabs:

1. **Cryptocurrencies**: Top coins by market cap from CoinGecko
2. **DeFi Protocols**: Protocol TVL from DeFiLlama  
3. **Yields**: Top yield farming opportunities
4. **Chains**: TVL by blockchain

### Components

Use these components to add market data to your projects:

```tsx
import { TopProtocolsWidget, TopYieldsWidget, TopChainsWidget } from '@/components/DeFiWidgets';
import PriceTicker from '@/components/PriceTicker';

// Price ticker bar
<PriceTicker coins={['bitcoin', 'ethereum', 'solana']} />

// DeFi widgets
<TopProtocolsWidget limit={5} />
<TopYieldsWidget limit={5} />
<TopChainsWidget limit={5} />
```

### Hooks

Use market data hooks in your components:

```tsx
import { useTopCoins, useLivePrices, useTopProtocols } from '@/hooks/useMarketData';

function MyComponent() {
  const { data: coins, loading } = useTopCoins(10);
  const { data: prices } = useLivePrices(['bitcoin', 'ethereum'], 30000);
  const { data: protocols } = useTopProtocols(5);
}
```

---

## Support & Feedback

- **Issues**: Report bugs on GitHub
- **Feature Requests**: Open a discussion
- **Documentation**: Check the main README
- **Community**: Join our Discord (coming soon)

## License

MIT License - see LICENSE file for details

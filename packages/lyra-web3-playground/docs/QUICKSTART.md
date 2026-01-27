<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Your dedication inspires others 🌠
-->

# 🚀 Quick Start Guide

Choose your path based on what you want to do:

| I want to... | Time | What to do |
|--------------|------|------------|
| **Just learn** | 30 seconds | [Use the website](#option-1-just-use-the-website-no-install) |
| **Run locally** | 5 minutes | [Basic local setup](#option-2-basic-local-setup) |
| **Develop features** | 15 minutes | [Full developer setup](#option-3-full-developer-setup) |

---

## Option 1: Just Use the Website (No Install)

**Time: 30 seconds**

1. Go to **[lyra.works](https://lyra.works)**
2. That's it! Start learning or coding.

### Try these first:
- Click a **tutorial** to learn step-by-step
- Go to [lyra.works/ide](https://lyra.works/ide) to write Solidity
- Use "JavaScript VM" to deploy without real crypto

No wallet, no crypto, no account needed to start learning.

---

## Option 2: Basic Local Setup

**Time: 5 minutes | No API keys required**

This runs the frontend only. Perfect for learning and UI development.

### Prerequisites
- Node.js 18 or higher ([download](https://nodejs.org))
- A code editor (VS Code recommended)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/nirholas/lyra-web3-playground.git
cd lyra-web3-playground

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### What works without API keys?
- ✅ All tutorials and examples
- ✅ Solidity IDE with compilation
- ✅ JavaScript VM deployment (simulated blockchain)
- ✅ Dark mode, accessibility features, translations
- ❌ AI features (need OpenAI key)
- ❌ Real blockchain deployment (need wallet + testnet ETH)

---

## Option 3: Full Developer Setup

**Time: 15 minutes | Includes backend and all features**

### Prerequisites

```bash
# Check Node.js version (need 18+)
node --version

# Check npm version
npm --version

# MetaMask browser extension installed (optional but recommended)
```

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/nirholas/lyra-web3-playground.git
cd lyra-web3-playground

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Setup (Optional)

Create `.env` in the root directory:

```env
# Frontend Environment Variables
VITE_API_URL=http://localhost:3001/api

# OpenAI API (for AI features) - optional
VITE_OPENAI_API_KEY=sk-your-key-here

# Alchemy API (for RPC) - optional, has fallbacks
VITE_ALCHEMY_API_KEY=your-key-here
```

Create `server/.env`:

```env
# Backend Environment Variables
PORT=3001

# OpenAI - optional, for AI code generation
OPENAI_API_KEY=sk-your-key-here

# Alchemy - optional, for blockchain RPC
ALCHEMY_API_KEY=your-key-here
```

> 💡 **Don't have API keys?** That's fine! The app works without them - you just won't have AI features or premium RPC nodes.

### 3. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 4. Access the Application

Open your browser to:
```
http://localhost:5173
```

---

## First Steps After Setup

## First Steps

### Option 1: Use a Template

1. Click **"Template"** button in toolbar
2. Choose **"Simple Storage"** (beginner-friendly)
3. Files are automatically created
4. Click **"Compile"** → Success!
5. Connect MetaMask (Sepolia testnet)
6. Click **"Deploy"** → Confirm transaction
7. Interact with your deployed contract!

### Option 2: AI Generation

1. Click the **⚡ lightning bolt** icon
2. Select **"Generate"** mode
3. Type: `Create an ERC20 token with 1 million supply`
4. AI generates complete code
5. Click **"Insert as File"**
6. Compile and deploy!

### Option 3: Start from Scratch

1. Click **"+"** in file tree
2. Enter filename: `MyContract.sol`
3. Start coding with autocomplete
4. Save automatically persists
5. Compile when ready!

## Key Features to Try

### Multi-File Editing
- Create multiple `.sol` files
- Switch between tabs
- Organize by folder (future)

### Live Compilation
- Select Solidity version (0.8.17-0.8.20)
- Enable/disable optimizations
- View errors in console
- Get ABI and bytecode

### Contract Deployment
- One-click deploy to Sepolia
- Transaction tracking
- Etherscan links
- Address saved for interaction

### Interactive Testing
- Auto-generated function UI
- Type-safe inputs
- Read functions (no gas)
- Write functions (transactions)
- Result display

### AI Assistant
**Generate Mode:**
- Natural language → Contract code
- Production-ready output
- Insert as new file

**Explain Mode:**
- Understand complex code
- Security analysis
- Best practices

**Test Mode:**
- Auto-generate test suite
- Hardhat or Foundry
- Edge case coverage

### Console & Logs
- Real-time event tracking
- Filter by type
- Search logs
- Export to file
- Clear when needed

## Common Tasks

### Compile a Contract
```
1. Write Solidity code
2. Select compiler version
3. Click "Compile"
4. Check console for results
```

### Deploy to Testnet
```
1. Ensure compiled (green checkmark)
2. Connect MetaMask
3. Switch to Sepolia network
4. Click "Deploy"
5. Confirm in MetaMask
6. Wait for confirmation
```

### Call a Function
```
1. Go to "Interact" panel
2. Find your function
3. Enter parameters
4. Click "Read" or "Write"
5. View results below
```

### Share Your Work
```
1. Click share icon (🔗)
2. Link copied to clipboard
3. Share with anyone
4. They can view and fork
```

### Export Workspace
```
1. Click download icon (⬇️)
2. JSON file downloads
3. Import later or on different device
```

## Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill the process if needed
kill -9 <PID>

# Restart
cd server && npm run dev
```

### Frontend won't start
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try different port
PORT=3000 npm run dev
```

### Compilation fails
- Check Solidity syntax
- Verify pragma version
- Review import statements
- Check console for detailed errors

### Deployment fails
- Ensure wallet connected
- Check network (Sepolia)
- Verify ETH balance
- Try increasing gas limit

### MetaMask not connecting
- Refresh page
- Check MetaMask is unlocked
- Switch to correct network
- Clear site permissions and retry

## Getting Testnet ETH

### Sepolia Faucet
```
1. Copy your wallet address
2. Visit: https://sepoliafaucet.com
3. Paste address
4. Receive 0.5 ETH
5. Wait for confirmation
```

### Alternative Faucets
- Alchemy Faucet: https://sepoliafaucet.com
- Infura Faucet: https://www.infura.io/faucet/sepolia
- POW Faucet: https://sepolia-faucet.pk910.de

## Project Structure

```
lyra-web3-playground/
├── src/
│   ├── components/
│   │   └── Sandbox/          # Interactive Sandbox components
│   │       ├── InteractiveSandbox.tsx
│   │       ├── FileTree.tsx
│   │       ├── ContractInteraction.tsx
│   │       ├── ConsolePanel.tsx
│   │       ├── AIAssistant.tsx
│   │       └── TemplateSelector.tsx
│   ├── services/
│   │   └── api.ts            # Backend API client
│   ├── stores/
│   │   ├── workspaceStore.ts # File & workspace management
│   │   ├── walletStore.ts    # Web3 connection
│   │   └── themeStore.ts     # Dark mode
│   ├── utils/
│   │   └── sandboxTemplates.ts # Pre-built templates
│   └── pages/
│       └── ...
├── server/
│   ├── src/
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   └── middleware/       # Express middleware
│   └── ...
└── ...
```

## API Endpoints

```
POST /api/compile           # Compile Solidity
POST /api/deploy            # Deploy contract
POST /api/ai/generate       # Generate contract
POST /api/ai/explain        # Explain code
POST /api/ai/tests          # Generate tests
POST /api/faucet/request    # Request testnet funds
POST /api/ipfs/upload       # Upload to IPFS
```

## Keyboard Shortcuts

```
Ctrl/Cmd + S    Save file (auto-save enabled)
Ctrl/Cmd + F    Find in editor
Ctrl/Cmd + H    Find and replace
Ctrl/Cmd + /    Toggle comment
F1              Command palette
Alt + ↑/↓       Move line up/down
Ctrl/Cmd + D    Select next occurrence
```

## Development Tips

### Fast Iteration
1. Use templates as starting points
2. Compile frequently
3. Test on testnet thoroughly
4. Use AI to understand patterns

### Code Quality
1. Enable compiler warnings
2. Use AI explain for complex logic
3. Generate tests before mainnet
4. Follow security best practices

### Productivity
1. Learn keyboard shortcuts
2. Use multiple files for organization
3. Save workspaces for different projects
4. Leverage AI for boilerplate code

## Next Steps

1. **Explore Templates**: Try all 5 pre-built templates
2. **Experiment with AI**: Generate different contract types
3. **Build Something**: Create your own token or NFT
4. **Share & Collaborate**: Export and share workspaces
5. **Read Docs**: Check `SANDBOX_GUIDE.md` for advanced features

## Resources

- **User Guide**: `SANDBOX_GUIDE.md`
- **Implementation**: `SANDBOX_IMPLEMENTATION.md`
- **Architecture**: `ARCHITECTURE.md`
- **Accessibility**: `ACCESSIBILITY.md`
- **Completion Summary**: `COMPLETION_SUMMARY.md`

## Accessibility

This site is designed to be accessible to all users:

- **Keyboard Navigation**: Use Tab to navigate, Enter to activate
- **Skip Link**: Press Tab on page load to skip to main content
- **Screen Readers**: All actions are announced via ARIA live regions
- **Visual Feedback**: Toast notifications for deaf/hard-of-hearing users
- **Reduced Motion**: Respects your system motion preferences

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for detailed documentation.

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions  
- **Documentation**: Check the `/docs` folder
- **Examples**: Browse the template library

## License

MIT License - See LICENSE file

---

**Happy Coding!** 🚀

Built with ❤️ for the Web3 developer community.

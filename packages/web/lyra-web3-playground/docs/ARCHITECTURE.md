<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 You're part of something special 🎪
-->

# Architecture Documentation

## Overview

Lyra Web3 Playground is built with a modern, scalable architecture designed for extensibility and maintainability. This document provides a comprehensive overview of the system architecture.

## Tech Stack

### Frontend
- **React 18**: UI framework with concurrent features
- **TypeScript**: Type safety and developer experience
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing

### Web3 Integration
- **ethers.js v6**: Ethereum interaction library
- **viem**: Type-safe Ethereum library
- **@solana/web3.js**: Solana blockchain interaction
- **MetaMask**: Primary wallet provider

### State Management
- **Zustand**: Lightweight state management
- **React Context**: For theme and auth

### Development Tools
- **Vitest**: Unit testing framework
- **ESLint**: Code linting
- **TypeScript**: Static type checking

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    React App                         │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │            Pages (Routes)                    │   │   │
│  │  │  • Homepage  • ExamplePage                   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │         Components                           │   │   │
│  │  │  • NavBar  • WalletConnect                   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │         Examples                             │   │   │
│  │  │  • Web3 Examples  • AI Examples              │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │      State Management (Zustand)              │   │   │
│  │  │  • Theme Store  • Wallet Store               │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Browser APIs & Extensions               │   │
│  │  • MetaMask  • LocalStorage  • IndexedDB            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
├─────────────────────────────────────────────────────────────┤
│  • Ethereum Networks (Infura/Alchemy)                       │
│  • Polygon Networks                                          │
│  • IPFS (for NFT storage)                                   │
│  • AI APIs (OpenAI, Anthropic)                             │
│  • Supabase (Auth, Database, Storage)                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Component Hierarchy

```
App
├── LiveAnnouncerProvider (accessibility)
├── VisualFeedbackProvider (accessibility)
├── Router
│   ├── SkipLink (accessibility)
│   ├── NavBar (persistent, hidden on /ide routes)
│   ├── MobileBottomNav (mobile only)
│   ├── Homepage
│   │   └── Example Cards
│   ├── SandboxPage (/ide)
│   │   ├── WebSandbox (Web development IDE)
│   │   └── SoliditySandbox (Smart contract IDE)
│   └── ExamplePage
│       ├── UnifiedSandbox (default view)
│       │   ├── Contract.sol editor
│       │   ├── Frontend.jsx (auto-generated)
│       │   ├── Live Preview
│       │   └── Deployed Contracts panel
│       └── ExampleWithPlayground (tutorial view)
│           ├── WalletConnectExample
│           ├── SmartContractExample
│           └── NFTMinterExample
```

### Accessibility Components

The application includes a comprehensive, cutting-edge accessibility system. See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for full documentation.

```
src/components/Accessibility/
├── index.ts              # Exports
├── AccessibilityButton.tsx   # Draggable floating button + quick menu
├── AccessibilityPanel.tsx    # Full settings panel (6 tabs)
├── SkipLinks.tsx             # Skip navigation links
├── Announcer.tsx             # Screen reader announcements
├── DwellClick.tsx            # Click-by-hovering for motor impairments
├── ReadingGuide.tsx          # Line highlighter for reading
├── ColorBlindFilters.tsx     # SVG filters for color blindness
└── (legacy files)            # Original simple accessibility

src/stores/accessibilityStore.ts  # 40+ settings with profiles
src/styles/accessibility.css      # 580+ lines of a11y CSS
```

**Key Features (Beyond WCAG 2.1 AAA):**
- **One-click profiles**: Low Vision, Blind, Deaf, Motor, Cognitive
- **Dwell Click**: Click by hovering (no mouse button needed)
- **Reading Guide**: Line highlighter follows cursor
- **Color Blind Filters**: Protanopia, Deuteranopia, Tritanopia, etc.
- **Text-to-Speech**: Read content aloud with adjustable rate/pitch
- **Code-to-Natural-Language**: Translates code to plain English!
- **OpenDyslexic Font**: Dyslexia-friendly typography
- **Large Click Targets**: Up to 64px minimum touch areas
- Full keyboard navigation with `Alt+A` quick access
- Settings export/import for device portability

### Component Patterns

#### 1. Container/Presenter Pattern

```typescript
// Container component (logic)
function WalletConnectExample() {
  const [state, setState] = useState();
  const handleConnect = async () => { /* logic */ };
  
  return <WalletView state={state} onConnect={handleConnect} />;
}

// Presenter component (UI)
function WalletView({ state, onConnect }: Props) {
  return <div>{/* Pure UI */}</div>;
}
```

#### 2. Custom Hooks Pattern

```typescript
// Custom hook for wallet logic
function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const connect = async () => { /* logic */ };
  return { address, connect };
}

// Used in component
function Component() {
  const { address, connect } = useWallet();
}
```

## State Management

### Zustand Stores

#### Theme Store
- Manages light/dark mode
- Persists to localStorage
- Updates document class

```typescript
interface ThemeState {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
}
```

#### Wallet Store
- Stores wallet connection state
- Manages address, balance, chainId
- Provides connect/disconnect actions

```typescript
interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnected: boolean;
  provider: any | null;
}
```

#### i18n Store
- Manages internationalization (10 languages)
- Persists language preference
- Supports RTL (Arabic)

```typescript
interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;  // Translation function
}

// Supported: en, es, zh, fr, de, ja, ko, pt, ru, ar
```

#### Accessibility Store
- 40+ accessibility settings
- One-click profiles
- Text-to-speech with code translation
- Persists all preferences

```typescript
interface AccessibilitySettings {
  // Vision
  highContrast: boolean;
  textSize: number;  // 100-200%
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | ...;
  readingGuide: boolean;
  dyslexicFont: boolean;
  
  // Motor
  dwellClick: boolean;
  dwellTime: number;  // ms
  largeClickTargets: 'normal' | 'large' | 'extra-large';
  
  // Cognitive
  simplifiedUI: boolean;
  focusMode: boolean;
  reducedMotion: boolean;
  
  // Audio
  textToSpeech: boolean;
  speechRate: number;
  codeToNaturalLanguage: boolean;
}
```

### State Flow

```
User Action
    ↓
Component Handler
    ↓
Store Action
    ↓
State Update
    ↓
Component Re-render
```

## Data Flow

### Wallet Connection Flow

```
1. User clicks "Connect Wallet"
2. Component calls connectWallet()
3. Request sent to window.ethereum (MetaMask)
4. User approves in MetaMask
5. Receive accounts and network info
6. Update wallet store
7. Components re-render with wallet data
8. Fetch balance from provider
9. Update UI with balance
```

### Network Switch Flow

```
1. User selects different network
2. Call wallet_switchEthereumChain
3. If network not added, call wallet_addEthereumChain
4. MetaMask switches network
5. chainChanged event fired
6. Update store with new chainId
7. Re-fetch balance for new network
8. Update UI
```

## Security Considerations

### Web3 Security

1. **Never expose private keys**
   - Use MetaMask for signing
   - Never store private keys in code or localStorage

2. **Validate all inputs**
   - Check addresses are valid
   - Validate amounts and parameters

3. **Handle errors gracefully**
   - Don't expose internal errors to users
   - Log errors for debugging

4. **RPC endpoint security**
   - Use environment variables for API keys
   - Implement rate limiting
   - Use fallback providers

### Frontend Security

1. **Content Security Policy**
   - Restrict script sources
   - Prevent XSS attacks

2. **Input sanitization**
   - Sanitize user inputs
   - Validate on both client and server

3. **Dependency security**
   - Regular security audits
   - Keep dependencies updated

## Performance Optimization

### Code Splitting

```typescript
// Route-based splitting
const HomePage = lazy(() => import('./pages/Homepage'));
const ExamplePage = lazy(() => import('./pages/ExamplePage'));

// Component-based splitting
const MonacoEditor = lazy(() => import('@monaco-editor/react'));
```

### Bundle Optimization

Vite configuration splits bundles:
- React vendor bundle
- Web3 vendor bundle
- Editor bundle (Monaco)

### Lazy Loading

```typescript
// Lazy load heavy components
const Editor = lazy(() => import('./components/Editor'));

<Suspense fallback={<Loading />}>
  <Editor />
</Suspense>
```

## Extensibility

### Adding New Examples

1. Create component in `src/examples/[category]/`
2. Add to example registry in Homepage
3. Add route in ExamplePage
4. Update documentation

### Adding New Networks

1. Add network config to `src/utils/networks.ts`
2. Test wallet connection
3. Test transactions
4. Update UI to show new network

### Adding AI Features

1. Create AI service in `src/services/ai/`
2. Add API key to environment
3. Create example component
4. Add to example registry

## Testing Strategy

### Unit Tests
- Test utility functions
- Test custom hooks
- Test state management

### Component Tests
- Test rendering
- Test user interactions
- Test error states

### Integration Tests
- Test wallet connection flow
- Test network switching
- Test example interactions

### E2E Tests (Future)
- Test complete user journeys
- Test across browsers
- Test mobile responsiveness

## Deployment

### Build Process

```bash
npm run build
# Produces optimized production build in dist/
```

### Deployment Options

1. **Vercel** (Recommended)
   - Automatic deployments from Git
   - Edge network CDN
   - Free for hobby projects

2. **Netlify**
   - Similar to Vercel
   - Good CI/CD integration

3. **Self-hosted**
   - Nginx/Apache
   - Docker container
   - Kubernetes cluster

### Environment Variables

Production requires:
```
VITE_INFURA_API_KEY (optional - falls back to public RPC)
VITE_SUPABASE_URL (for auth features)
VITE_SUPABASE_ANON_KEY (for auth features)
```

## Monitoring and Analytics

### Performance Monitoring
- Lighthouse CI
- Web Vitals tracking
- Bundle size monitoring

### Error Tracking
- Console error monitoring
- Failed transaction tracking
- API error logging

### Analytics (Privacy-Friendly)
- Plausible Analytics (planned)
- No personal data collection
- GDPR compliant

## Future Architecture

## Premium Sandbox Architecture

### Component Overview

The sandbox system consists of three main components:

#### 1. WebSandbox (`/src/components/Sandbox/WebSandbox.tsx`)
A CodePen-like environment for web development.

**Key Features:**
- Multi-file project support with file tree
- Monaco Editor with syntax highlighting
- Live preview with iframe sandboxing
- Device presets (Desktop/Tablet/Mobile)
- Console capture via postMessage
- Settings panel with 10+ options

**State Management:**
```typescript
interface SandboxFile {
  id: string;
  name: string;
  content: string;
  language: 'html' | 'css' | 'javascript' | 'typescript' | 'jsx' | 'vue' | 'python';
}

interface EditorSettings {
  theme: 'vs-dark' | 'light';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  formatOnSave: boolean;
  vimMode: boolean;
  autoSave: boolean;
  ligatures: boolean;
}
```

#### 2. SoliditySandbox (`/src/components/Sandbox/SoliditySandbox.tsx`)
A Remix-quality smart contract IDE.

**Key Features:**
- Multiple Solidity versions (0.6.12 - 0.8.24)
- Real-time compilation with error display
- Contract deployment to multiple networks
- Interactive contract function panel
- Transaction history tracking
- ABI/Bytecode export

**State Management:**
```typescript
interface CompiledContract {
  name: string;
  abi: any[];
  bytecode: string;
  gasEstimates: GasEstimate;
}

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  abi: any[];
  network: string;
}
```

#### 3. UnifiedSandbox (`/src/components/Sandbox/UnifiedSandbox.tsx`)
Generic sandbox that auto-generates from contract templates.

**Key Features:**
- Auto-generates React frontend from contract ABI
- Three-tab layout: Contract.sol / Frontend.jsx / Preview
- Deployed contracts interaction panel
- Works with any `templateId` from contractTemplates

### Data Flow

```
User edits code
    ↓
Monaco Editor onChange
    ↓
Update file state
    ↓
Trigger runCode (debounced)
    ↓
Build HTML document
    ↓
Write to iframe srcDoc
    ↓
Capture console via postMessage
    ↓
Display in Console panel
```

### Planned Enhancements

1. **Backend Services**
   - Serverless functions for AI proxy
   - Database for user data
   - Caching layer

2. **Real-time Features**
   - WebSocket connections
   - Live blockchain events
   - Collaborative editing

3. **Mobile Support**
   - Progressive Web App
   - React Native app
   - WalletConnect integration

4. **Scalability**
   - Kubernetes deployment
   - Load balancing
   - CDN optimization

## Community Services Architecture

### Overview

The community system allows users to share, discover, and collaborate on projects using wallet-based authentication.

### Authentication Flow

```
User clicks "Share" or "Like"
    ↓
Check wallet connection
    ↓
If not connected → Show WalletConnect modal
    ↓
User connects MetaMask
    ↓
Wallet address used as user_id
    ↓
Proceed with action
```

### Community Service (`/src/services/community.ts`)

**Key Functions:**
```typescript
// Share a project publicly
shareProject({ title, description, files, category, tags, walletAddress })
  → Returns: { data, shareUrl, error }

// Get a shared project by token
getSharedProject(shareToken)
  → Returns: { data: SharedProject, error }

// Browse public projects
getPublicProjects({ category, sortBy, limit, offset })
  → Returns: { data: SharedProject[], total, error }

// Like/unlike a project
likeProject(projectId, walletAddress)
  → Returns: { liked: boolean, error }

// Add comment to project
addComment(projectId, content, walletAddress)
  → Returns: { data: ProjectComment, error }

// Fork a project
forkProject(shareToken, walletAddress)
  → Returns: { data: SharedProject, error }
```

### Database Schema (Supabase)

```sql
-- shared_projects table
id: uuid
user_id: text (wallet address)
title: text
description: text
files: jsonb[]
category: text
tags: text[]
is_public: boolean
share_token: text (unique)
likes_count: integer
views_count: integer
forks_count: integer
created_at: timestamp
updated_at: timestamp

-- project_likes table
id: uuid
project_id: uuid
user_id: text (wallet address)
created_at: timestamp

-- project_comments table
id: uuid
project_id: uuid
user_id: text (wallet address)
content: text
created_at: timestamp
```

## Market Data Services Architecture

### Overview

Real-time cryptocurrency and DeFi market data from CoinGecko and DeFiLlama APIs.

### Service Architecture (`/src/services/marketData.ts`)

```typescript
class MarketDataService {
  // CoinGecko API
  getTopCoins(limit): Promise<TokenPrice[]>
  getPrices(coinIds): Promise<PriceMap>
  getTrending(): Promise<TrendingCoin[]>
  getGlobalData(): Promise<GlobalMarketData>
  getMarketChart(coinId, days): Promise<MarketChart>
  
  // DeFiLlama API
  getTopProtocols(limit): Promise<ProtocolTVL[]>
  getTopChains(limit): Promise<ChainTVL[]>
  getTopYields(limit): Promise<YieldPool[]>
  getChainDeFiOverview(chain): Promise<DeFiOverview>
  
  // Combined
  getMarketOverview(): Promise<FullOverview>
}
```

### Caching Strategy

```typescript
// Cache with TTL
private cache: Map<string, { data: any; timestamp: number }>
private cacheTTL = 60000; // 1 minute for prices
                          // 5 minutes for DeFi data

async fetchWithCache<T>(key, fetcher): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheTTL) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### React Hooks (`/src/hooks/useMarketData.ts`)

```typescript
// Available hooks
useTopCoins(limit)
usePrices(coinIds)
useTrending()
useGlobalMarketData()
useMarketChart(coinId, days)
useTopProtocols(limit)
useTopChains(limit)
useTopYields(limit)
useChainDeFi(chain)
useMarketOverview()
useLivePrices(coinIds, refreshInterval) // Auto-refresh

// Return type
interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

### Data Flow

```
Component mounts
    ↓
Hook calls marketData service
    ↓
Check cache
    ↓
If stale → Fetch from API
    ↓
Update cache
    ↓
Return data to component
    ↓
(For live prices) Set interval for refresh
```

## Conclusion

This architecture provides a solid foundation for Lyra Web3 Playground. The modular design allows for easy extension and maintenance while maintaining performance and security.

---

For questions or suggestions about the architecture, please open a discussion on GitHub.

# Changelog

All notable changes to Lyra Web3 Playground will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.5.1] - 2026-01-19

### Fixed
- ESLint configuration updated for flat config compatibility
- Removed deprecated `--ext` flag from lint script
- Added missing `typescript-eslint`, `@eslint/js`, `globals` dependencies

---

## [1.5.0] - 2026-01-15

### Added
- Privy authentication integration
  - `useAuth` hook with Privy wrapper and fallback
  - PrivyProvider configuration in App.tsx
  - Seamless wallet-based login flow
- Inline wallet connect component
  - MetaMask integration with ethers.js
  - Connection state management
  - Network detection and switching

### Changed
- Authentication now supports both Supabase and Privy providers
- UserButton component updated for dual auth support

---

## [1.4.2] - 2026-01-12

### Added
- Innovation Tour component for guided feature discovery
- Tooltips and onboarding hints for Innovation Lab
- Deep linking support for all Innovation Lab features

### Fixed
- Innovation page navigation on mobile devices
- Voice command activation in AI Whisperer

---

## [1.4.1] - 2026-01-10

### Added
- Neural Gas Oracle standalone page
  - 3 ML models for gas prediction
  - Real-time network congestion display
  - Optimization suggestions panel
- Cross-Chain DreamWeaver page
  - 8+ chain deployment interface
  - Parallel/sequential/smart deployment modes
  - Automated bridge setup wizard

---

## [1.4.0] - 2026-01-09

### Added
- Innovation Lab standalone pages 🧪
  - `/innovation/ai-whisperer` - AI Code Whisperer with voice control
  - `/innovation/time-machine` - Contract version history and fork simulation
  - `/innovation/exploit-lab` - Ethical security testing sandbox
  - `/innovation/arena` - Collaborative coding with AI teammates
- AICodeWhispererPage with real-time vulnerability detection
- ContractTimeMachinePage with snapshot and playback
- ExploitLabPage with 6 attack vectors (reentrancy, overflow, frontrunning, flashloan, delegation, oracle)
- CollaborativeArenaPage with multiplayer coding and leaderboards

### Changed
- Innovation features now accessible via direct URLs
- Removed Innovation Mode toggle requirement for standalone pages

---

## [1.3.4] - 2026-01-05

### Added
- Accessibility settings export/import functionality
- Custom color picker for high contrast mode
- Keyboard shortcut customization panel

### Fixed
- Screen reader announcements for dynamic content
- Focus trap in modal dialogs

---

## [1.3.3] - 2026-01-02

### Added
- OpenDyslexic font support
- Font size scaling up to 200%
- Line height and letter spacing controls
- Word spacing adjustment for readability

### Changed
- Accessibility panel reorganized into tabbed sections

---

## [1.3.2] - 2025-12-31

### Added
- Dwell click feature for motor impairments
  - Configurable dwell time (500ms - 3000ms)
  - Visual progress indicator
  - Click-by-hovering on any interactive element
- Large click targets option (up to 64px)
- Sticky keys simulation

### Fixed
- Keyboard navigation in dropdown menus
- Tab order in sandbox file tree

---

## [1.3.1] - 2025-12-30

### Added
- Reading guide component
  - Horizontal line follows cursor position
  - Adjustable line thickness and color
  - Toggle with keyboard shortcut
- Color blind filters
  - Protanopia, Deuteranopia, Tritanopia
  - Achromatopsia (full grayscale)
  - SVG filter implementation
- High contrast mode with 4 presets

---

## [1.3.0] - 2025-12-29

### Added
- Comprehensive accessibility system ♿
  - AccessibilityButton (floating, draggable)
  - AccessibilityPanel with 35+ settings
  - Quick profiles: Low Vision, Blind, Deaf, Motor, Cognitive
  - `Alt+A` keyboard shortcut for quick access
- ARIA live region announcements
- Skip links for main content navigation
- Reduced motion mode
- Text-to-speech with adjustable speed/pitch

### Added (Documentation)
- GitHub issue templates (bug, feature, accessibility, question)
- Pull request template with checklist
- CONTRIBUTING.md with accessible commit guidelines
- ACCESSIBILITY.md documentation

---

## [1.2.4] - 2025-12-27

### Added
- RTL (right-to-left) support for Arabic
- Bidirectional text handling in editor
- RTL-aware layout components

### Fixed
- Text alignment in RTL mode
- Icon mirroring for directional elements

---

## [1.2.3] - 2025-12-25

### Added
- Translation caching system
  - In-memory cache for session
  - localStorage persistence for offline
- Batch translation API for performance
- Loading states for translation switches

---

## [1.2.2] - 2025-12-23

### Added
- Language selector component in NavBar
- Persisted language preference in localStorage
- Language detection from browser settings

### Changed
- All navigation labels internationalized
- Button text uses translation keys

---

## [1.2.1] - 2025-12-21

### Added
- Serverless translation endpoint (`/api/translate`)
- Groq Llama integration for AI translation
- Translation service with error handling

---

## [1.2.0] - 2025-12-20

### Added
- Internationalization system (i18n) 🌍
  - i18nStore with Zustand
  - 10 languages: EN, ES, ZH, FR, DE, JA, KO, PT, RU, AR
  - 100+ translation keys
- Translation hooks and utilities

---

## [1.1.4] - 2025-12-18

### Added
- AI test generation endpoint (`POST /api/ai/tests`)
- Automatic test case generation from contract code
- Test template formatting for Hardhat/Foundry

---

## [1.1.3] - 2025-12-17

### Added
- AI code explanation endpoint (`POST /api/ai/explain`)
- Line-by-line code annotation
- Plain English contract summaries
- Security consideration highlights

---

## [1.1.2] - 2025-12-16

### Added
- AI code generation endpoint (`POST /api/ai/generate`)
- Natural language to Solidity conversion
- Template-aware generation (recognizes Token, NFT, DAO intents)

---

## [1.1.1] - 2025-12-15

### Added
- Lyra AI Chat component
  - Branded avatar and chat bubbles
  - Typing indicators
  - Message history
- LyraChat knowledge base (1300+ lines)
  - Pattern-matching responses
  - No external API required (free)
  - Solidity, DeFi, security topics

---

## [1.1.0] - 2025-12-14

### Added
- AI Full-Stack dApp Builder 🤖
  - FullStackPlayground component
  - react-live integration for preview
  - Multi-file code generation
- AI assistant panel in sandbox
- Natural language prompt input
- Generated code: Solidity + HTML + CSS + JS

---

## [1.0.6] - 2025-12-12

### Added
- Innovation Lab features (behind Innovation Mode toggle)
  - AI Code Whisperer component
  - Contract Time Machine component
  - Exploit Lab component
  - Collaborative Arena component
  - Neural Gas Oracle component
  - Cross-Chain DreamWeaver component

### Changed
- Sandbox settings panel includes Innovation Mode toggle

---

## [1.0.5] - 2025-12-11

### Added
- Markets page (`/markets`)
  - Live cryptocurrency prices table
  - Sparkline price charts
  - Global market statistics
  - DeFi protocol rankings
  - Top yields display
  - Chain TVL comparison

---

## [1.0.4] - 2025-12-10

### Added
- DeFi widgets for homepage
  - TopProtocolsWidget
  - TopYieldsWidget  
  - TopChainsWidget
  - DeFiSummaryBar
- Price ticker in navigation bar
- Auto-refresh every 60 seconds

---

## [1.0.3] - 2025-12-09

### Added
- Market data service (`marketData.ts`)
  - CoinGecko API integration
  - DeFiLlama API integration
  - Response caching (5 min TTL)
- Market data hooks
  - `useCryptoPrices`
  - `useTrendingCoins`
  - `useGlobalStats`
  - `useDeFiProtocols`
  - `useTopYields`
  - `useChainTVL`
  - `useSparkline`

---

## [1.0.2] - 2025-12-08

### Added
- Mobile responsive design
  - MobileBottomNav component
  - Responsive breakpoints
  - Touch-friendly targets
- LazyComponents for code splitting
- LoadingStates (PageLoader, SkeletonCard, SpinnerOverlay)

---

## [1.0.1] - 2025-12-07

### Added
- Theme system
  - themeStore with Zustand
  - Dark/light mode toggle
  - System preference detection
  - Smooth theme transitions
  - localStorage persistence

### Changed
- All components support dark mode
- CSS variables for theme colors

---

## [1.0.0] - 2025-12-06

### Added
- Initial public release 🚀
- Production deployment to Vercel
- Custom domain (lyra.works)
- SSL certificate configuration
- CDN and edge caching

---

## [0.19.0] - 2025-12-05

### Added
- SEO optimization
  - `useSEO` hook for dynamic meta tags
  - Open Graph tags for social sharing
  - Twitter card meta tags
  - Canonical URLs
- sitemap.xml generation
- robots.txt configuration
- 404.html fallback page

---

## [0.18.0] - 2025-12-04

### Added
- Docker containerization
  - Dockerfile for frontend
  - Dockerfile for server
  - docker-compose.yml for full stack
- Nginx configuration for production
- Health check endpoints

---

## [0.17.0] - 2025-12-03

### Added
- Vercel deployment configuration
  - vercel.json with rewrites
  - Serverless function setup
  - Environment variable management
- Netlify deployment configuration
  - netlify.toml
  - Redirect rules

---

## [0.16.0] - 2025-12-02

### Added
- Vitest testing setup
  - vitest.config.ts configuration
  - jsdom environment
  - React Testing Library integration
- Test files for examples and helpers
- Test coverage reporting

---

## [0.15.0] - 2025-12-01

### Added
- Interactive Learning Playground (`/learn`)
  - ChallengeSystem component with tests and hints
  - ProgressiveLevels for difficulty scaling
  - InlineAnnotations for code explanation
  - Achievement tracking
- InteractiveTutorial component improvements
- CodeSnippetManager for tutorials

---

## [0.14.0] - 2025-11-28

### Added
- Tutorial browser page
  - Search by title and description
  - Filter by difficulty (Beginner, Intermediate, Advanced)
  - Filter by category
  - Grid layout with TutorialCard components
- TutorialNavigation for step controls
- TutorialProgress indicator

---

## [0.13.0] - 2025-11-25

### Added
- Tutorial system foundation
  - tutorials.ts data file with 50+ tutorials
  - TutorialPage component
  - Step-by-step navigation
  - Multi-language code examples
  - Progress persistence in localStorage
- Tutorial categories: Basics, Tokens, NFTs, DeFi, Security, Testing

---

## [0.12.0] - 2025-11-22

### Added
- 25 runnable Web3 examples
  - Wallet: WalletConnectExample, WalletConnectFullStack
  - Tokens: ERC20TokenExample, SolanaTokenExample
  - NFTs: NFTMinterExample, NFTMarketplaceExample
  - DeFi: TokenSwapExample, DeFiLendingExample, StakingExample, YieldFarmingExample
  - Governance: DAOGovernanceExample, MultiSigWalletExample
  - Advanced: CrossChainBridgeExample, TokenVestingExample
- ExamplesPage with category filtering
- ExamplePage for individual example view

---

## [0.11.0] - 2025-11-19

### Added
- AI examples
  - AIChatAssistant example
  - AIContractGenerator example
  - AIFullStackBuilder example
- ExampleWithPlayground wrapper component

---

## [0.10.0] - 2025-11-16

### Added
- Smart contract templates (40+ templates)
  - Tokens: ERC-20, ERC-20 Advanced, Wrapped, Capped, Reflection, Permit
  - NFTs: ERC-721, ERC-1155, Enumerable, Royalties, Soulbound, Lazy Minting
  - DeFi: Lending, Yield Farming, Staking, Liquidity Pool, Flash Loans, Vaults
  - DAO: Governance, Timelock Controller
  - Security: Reentrancy Guard, Role-Based Access, Pausable, Ownable, MultiSig
  - Utilities: Simple Storage, Counter, Hello World, Payment Splitter, Escrow, Airdrop
- contractTemplates.ts with full source code
- TemplateSelector component
- TemplatesPanel for browsing

---

## [0.9.0] - 2025-11-13

### Added
- Contract Playground page (`/playground`)
  - Template browser sidebar
  - Monaco editor with Solidity highlighting
  - Compilation output panel
  - Deploy to JavaScript VM
- SplitView component with resizable panes
- MultiLanguageTabs for code language selection

---

## [0.8.2] - 2025-11-10

### Added
- Contract interaction panel
  - Read function calls
  - Write function execution
  - Transaction confirmation
  - Return value display
- ContractInteraction component

---

## [0.8.1] - 2025-11-08

### Added
- ABI and bytecode export
- Copy to clipboard functionality
- Transaction history panel
- Gas usage tracking per transaction

---

## [0.8.0] - 2025-11-06

### Added
- SoliditySandbox component
  - Browser-based compilation
  - Multi-version support (0.6.x - 0.8.24)
  - Real-time error highlighting
  - One-click testnet deployment
- compiler.ts service using solc CDN
- OpenZeppelin import resolution

---

## [0.7.2] - 2025-11-03

### Added
- Console panel in WebSandbox
  - console.log capture
  - console.warn capture
  - console.error capture
  - Clear console button
- ConsolePanel component

---

## [0.7.1] - 2025-11-01

### Added
- Live preview improvements
  - Device presets (Desktop 1920px, Tablet 768px, Mobile 375px)
  - Zoom controls
  - Refresh button
- UniversalLivePreview component

---

## [0.7.0] - 2025-10-29

### Added
- WebSandbox component
  - Multi-file editor with Monaco
  - File tree with folders
  - HTML, CSS, JS, TypeScript, React, Vue support
  - Python support with Pyodide
  - Live preview with hot reload
  - Vim mode toggle
- FileTree component with icons

---

## [0.6.3] - 2025-10-26

### Added
- Share modal with embed support
  - Unique shareable links
  - Embed code generation
  - Copy to clipboard
  - Social sharing buttons
- ShareModal component

---

## [0.6.2] - 2025-10-23

### Added
- Explore page (`/explore`)
  - Grid layout for projects
  - Search by title/author
  - Filter by type (project, template, tutorial)
  - Sort by date, likes, views
- SharedProjectPage component

---

## [0.6.1] - 2025-10-20

### Added
- Comment system
  - Add comments to shared projects
  - Reply threading
  - Edit and delete own comments
  - Timestamp display
- Fork functionality
  - Fork to workspace
  - Attribution to original author

---

## [0.6.0] - 2025-10-17

### Added
- Community service (`community.ts`)
  - `shareProject()` - generate share token
  - `getSharedProject()` - fetch by token
  - `likeProject()` / `unlikeProject()`
  - `getComments()` / `addComment()`
  - `forkProject()` - copy to workspace
  - `getCommunityTemplates()`
  - `getCommunityTutorials()`
- Supabase tables for community data

---

## [0.5.2] - 2025-10-14

### Added
- Workspace import/export
  - Export as JSON
  - Import from JSON file
  - Drag and drop import
- Workspace persistence in localStorage

---

## [0.5.1] - 2025-10-11

### Added
- File tree navigation
  - Create new file
  - Create new folder
  - Rename files/folders
  - Delete with confirmation
  - Drag and drop reordering

---

## [0.5.0] - 2025-10-08

### Added
- Workspace management system
  - workspaceStore with Zustand
  - Multi-workspace support
  - Active workspace switching
  - File content management
- InteractiveSandbox component

---

## [0.4.3] - 2025-10-05

### Added
- Chain selector component
  - Ethereum Mainnet, Sepolia, Goerli
  - Polygon, Mumbai
  - Base, Base Sepolia
  - Arbitrum, Arbitrum Sepolia
  - Avalanche, Fuji
  - BSC, BSC Testnet
  - Solana Devnet
  - Monad Testnet
- ChainSelector component with logos

---

## [0.4.2] - 2025-10-02

### Added
- Consent modal improvements
  - Only shows on wallet connect or project create
  - Single checkbox consent
  - Remember preference option
- ConsentModal component

### Changed
- Consent no longer blocks site entry

---

## [0.4.1] - 2025-09-29

### Added
- Wallet store (`walletStore.ts`)
  - Connection state
  - Address and chainId
  - Balance tracking
  - Provider reference
- Network switching functionality
- Balance display formatting

---

## [0.4.0] - 2025-09-26

### Added
- Wallet connection with ethers.js v6
  - MetaMask detection
  - Connection request
  - Account change listener
  - Network change listener
- WalletConnect component
- Connect/disconnect flow

---

## [0.3.3] - 2025-09-23

### Added
- Auth store (`authStore.ts`)
  - User session management
  - Profile data
  - Login/logout actions
- AuthModal component
- Supabase authentication integration

---

## [0.3.2] - 2025-09-20

### Added
- Supabase client configuration
  - `lib/supabase.ts` setup
  - Environment variables
  - Type definitions
- Database schema for users and projects

---

## [0.3.1] - 2025-09-17

### Added
- Custom hooks
  - `useAsync` - async operation handler with loading/error states
  - `useLocalStorage` - type-safe localStorage with cross-tab sync

---

## [0.3.0] - 2025-09-14

### Added
- Mobile responsive navigation
  - Hamburger menu for mobile
  - Slide-out drawer
  - Touch-friendly tap targets
- MobileBottomNav component
  - Home, Learn, Build, Explore, More tabs
  - Active state indicators

---

## [0.2.5] - 2025-09-11

### Added
- Error boundary component
  - Graceful error catching
  - Fallback UI
  - Error reporting
  - Retry functionality
- ErrorBoundary wrapper

---

## [0.2.4] - 2025-09-08

### Added
- Backend rate limiting middleware
  - Per-IP rate limits
  - Configurable windows
  - 429 response handling
- Input validation middleware
- Request sanitization

---

## [0.2.3] - 2025-09-05

### Added
- IPFS upload service
  - `POST /api/ipfs/upload`
  - Pinning service integration
  - CID return
- Testnet faucet proxy
  - `POST /api/faucet`
  - Sepolia support
  - Rate limiting per address

---

## [0.2.2] - 2025-09-02

### Added
- Contract deployment service
  - `POST /api/deploy`
  - Network selection
  - Gas estimation
  - Transaction receipt return
- deployer.ts service

---

## [0.2.1] - 2025-08-30

### Added
- Solidity compilation endpoint
  - `POST /api/compile`
  - Version selection
  - Error/warning parsing
  - ABI and bytecode return
- compiler.ts service

---

## [0.2.0] - 2025-08-27

### Added
- Backend API server (`/server`)
  - Express.js with TypeScript
  - CORS configuration
  - JSON body parsing
  - Error handling middleware
- Server package.json and tsconfig
- API service client for frontend

---

## [0.1.5] - 2025-08-24

### Added
- Documentation pages
  - DocsPage hub
  - DocCategoryPage
  - DocArticlePage
  - Categories: Getting Started, Solidity, Security, Gas, DeFi, Testing
- ApiReferencePage

---

## [0.1.4] - 2025-08-21

### Added
- Static pages
  - AboutPage with mission and values
  - FAQPage with collapsible questions
  - ChangelogPage
  - RoadmapPage
  - PrivacyPage
  - TermsPage
  - ContributePage
  - CommunityPage

---

## [0.1.3] - 2025-08-18

### Added
- Navigation components
  - NavBar with logo and links
  - Responsive menu
  - Active link highlighting
- Footer component
  - Link columns
  - Social icons
  - Copyright

---

## [0.1.2] - 2025-08-16

### Added
- Homepage foundation
  - Hero section
  - Feature highlights
  - Call-to-action buttons
- Basic routing with React Router v6
- Route configuration

---

## [0.1.1] - 2025-08-15

### Added
- useSEO hook
  - Dynamic page titles
  - Meta descriptions
  - Canonical URLs
  - Open Graph tags
  - Twitter cards

---

## [0.1.0] - 2025-08-14

### Added
- Project foundation 🎉
  - React 18 + TypeScript
  - Vite build tooling
  - TailwindCSS styling
  - ESLint configuration
  - Prettier formatting
  - Vitest setup
- Project structure and conventions
- README with setup instructions
- MIT License

---

*Built with ❤️ by [nich](https://x.com/nichxbt)*

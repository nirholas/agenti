/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Main Application Component
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✨ Original Author: nich
 * 🐦 Twitter/X: x.com/nichxbt
 * 🐙 GitHub: github.com/nirholas
 * 📦 Repository: github.com/nirholas/lyra-web3-playground
 * 🌐 Website: https://lyra.works
 * 
 * Copyright (c) 2024-2026 nirholas (nich)
 * Licensed under MIT License
 * 
 * NOTICE: This code contains embedded watermarks and attribution markers.
 * Removal or modification of attribution constitutes violation of the license.
 * ═══════════════════════════════════════════════════════════════════════════
 * @author nich (@nichxbt)
 * @repository https://github.com/nirholas/lyra-web3-playground
 * @license MIT
 * @preserve
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useThemeStore } from './stores/themeStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/LoadingStates';

// Attribution marker - nich | x.com/nichxbt | github.com/nirholas
const __lyra_attr__ = { author: 'nich', x: 'nichxbt', gh: 'nirholas' };

// Eagerly loaded pages (critical path)
import Homepage from './pages/Homepage';
import ExamplePage from './pages/ExamplePage';
import ExamplesPage from './pages/ExamplesPage';
import TutorialBrowser from './pages/TutorialBrowser';
import TutorialPage from './pages/TutorialPage';
import AboutPage from './pages/AboutPage';

// Lazy-loaded pages (code splitting for better performance)
const ContractPlayground = lazy(() => import('./pages/ContractPlayground'));
const InteractiveSandbox = lazy(() => import('./components/Sandbox/InteractiveSandbox'));
const SandboxPage = lazy(() => import('./pages/SandboxPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const DocArticlePage = lazy(() => import('./pages/DocArticlePage'));
const DocCategoryPage = lazy(() => import('./pages/DocCategoryPage'));
const ApiReferencePage = lazy(() => import('./pages/ApiReferencePage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const InnovationShowcase = lazy(() => import('./pages/InnovationShowcase'));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const InteractiveLearningPlayground = lazy(() => import('./pages/InteractiveLearningPlayground'));
const FullStackDemoPage = lazy(() => import('./pages/FullStackDemoPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ContributePage = lazy(() => import('./pages/ContributePage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const SharedProjectPage = lazy(() => import('./pages/SharedProjectPage'));
const MarketsPage = lazy(() => import('./pages/MarketsPage'));

// Innovation pages (experimental features - lazy loaded)
const AICodeWhispererPage = lazy(() => import('./pages/innovation/AICodeWhispererPage'));
const ContractTimeMachinePage = lazy(() => import('./pages/innovation/ContractTimeMachinePage'));
const ExploitLabPage = lazy(() => import('./pages/innovation/ExploitLabPage'));
const CollaborativeArenaPage = lazy(() => import('./pages/innovation/CollaborativeArenaPage'));
const NeuralGasOraclePage = lazy(() => import('./pages/innovation/NeuralGasOraclePage'));
const CrossChainDreamWeaverPage = lazy(() => import('./pages/innovation/CrossChainDreamWeaverPage'));
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import ConsentModal, { useConsent, ConsentTrigger } from './components/ConsentModal';
import { 
  SkipLink, 
  LiveAnnouncerProvider, 
  VisualFeedbackProvider,
  AccessibilityButton,
  ColorBlindFilters,
  ReadingGuide,
  DwellClick,
  AnnouncerProvider,
} from './components/Accessibility';
import { useAccessibilityStore } from './stores/accessibilityStore';
import '@/styles/accessibility.css';

// Get base path from Vite's configuration
const basename = import.meta.env.BASE_URL;

// Pages that should be rendered without navbar/footer (full-screen IDEs)
const fullscreenPaths = ['/ide'];

function AppContent() {
  const { mode } = useThemeStore();
  const location = useLocation();
  const { applyAccessibilityCSS } = useAccessibilityStore();
  
  // Apply accessibility CSS whenever settings change
  useEffect(() => {
    applyAccessibilityCSS();
  }, [applyAccessibilityCSS]);
  
  // Check if current path should be fullscreen (no navbar/footer)
  const isFullscreen = fullscreenPaths.some(path => location.pathname.startsWith(path));

  if (isFullscreen) {
    // Render without navbar and footer
    return (
      <div className={`min-h-screen ${mode === 'dark' ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-black text-gray-900 dark:text-gray-100 min-h-screen">
          <Suspense fallback={<PageLoader message="Loading IDE..." />}>
            <Routes>
              <Route path="/ide" element={<SandboxPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${mode === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-black text-gray-900 dark:text-gray-100 min-h-screen">
        <SkipLink />
        <NavBar />
        <main id="main-content" className="pt-16 pb-20 md:pb-0" role="main" tabIndex={-1}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/example/:exampleId" element={<ExamplePage />} />
              <Route path="/playground" element={<ContractPlayground />} />
              <Route path="/sandbox" element={<InteractiveSandbox />} />
              <Route path="/sandbox/:shareId" element={<InteractiveSandbox />} />
              <Route path="/tutorials" element={<TutorialBrowser />} />
              <Route path="/tutorial/:tutorialId" element={<TutorialPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/docs/api" element={<ApiReferencePage />} />
              <Route path="/docs/:categoryId" element={<DocCategoryPage />} />
              <Route path="/docs/:categoryId/:articleId" element={<DocArticlePage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/innovation" element={<InnovationShowcase />} />
              <Route path="/innovation/ai-whisperer" element={<AICodeWhispererPage />} />
              <Route path="/innovation/time-machine" element={<ContractTimeMachinePage />} />
              <Route path="/innovation/exploit-lab" element={<ExploitLabPage />} />
              <Route path="/innovation/arena" element={<CollaborativeArenaPage />} />
              <Route path="/innovation/gas-oracle" element={<NeuralGasOraclePage />} />
              <Route path="/innovation/cross-chain" element={<CrossChainDreamWeaverPage />} />
              <Route path="/projects" element={<RoadmapPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/learn" element={<InteractiveLearningPlayground />} />
              <Route path="/fullstack-demo" element={<FullStackDemoPage />} />
              <Route path="/examples" element={<ExamplesPage />} />
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/contribute" element={<ContributePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/shared/:token" element={<SharedProjectPage />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <MobileBottomNav />
        
        {/* Accessibility Features */}
        <ColorBlindFilters />
        <ReadingGuide />
        <DwellClick />
        <AccessibilityButton />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AnnouncerProvider>
        <LiveAnnouncerProvider>
          <VisualFeedbackProvider>
            <Router basename={basename}>
              <AppContent />
            </Router>
          </VisualFeedbackProvider>
        </LiveAnnouncerProvider>
      </AnnouncerProvider>
    </ErrorBoundary>
  );
}

export default App;

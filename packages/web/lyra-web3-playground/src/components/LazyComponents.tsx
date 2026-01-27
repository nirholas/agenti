/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Load only what you need, when you need it ⚡
 */

import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { PageLoader, EditorSkeleton } from './LoadingStates';

/**
 * Lazy-loaded page components with code splitting
 * These components are loaded only when the route is visited
 */

// Heavy pages
export const LazyContractPlayground = lazy(() => import('@/pages/ContractPlayground'));
export const LazySandboxPage = lazy(() => import('@/pages/SandboxPage'));
export const LazyFullStackDemoPage = lazy(() => import('@/pages/FullStackDemoPage'));
export const LazyInteractiveLearningPlayground = lazy(() => import('@/pages/InteractiveLearningPlayground'));
export const LazyMarketsPage = lazy(() => import('@/pages/MarketsPage'));

// Innovation pages (experimental features)
export const LazyInnovationShowcase = lazy(() => import('@/pages/InnovationShowcase'));
export const LazyAICodeWhispererPage = lazy(() => import('@/pages/innovation/AICodeWhispererPage'));
export const LazyContractTimeMachinePage = lazy(() => import('@/pages/innovation/ContractTimeMachinePage'));
export const LazyExploitLabPage = lazy(() => import('@/pages/innovation/ExploitLabPage'));

// Documentation pages
export const LazyDocsPage = lazy(() => import('@/pages/DocsPage'));
export const LazyApiReferencePage = lazy(() => import('@/pages/ApiReferencePage'));

// Community pages
export const LazyCommunityPage = lazy(() => import('@/pages/CommunityPage'));
export const LazyExplorePage = lazy(() => import('@/pages/ExplorePage'));

/**
 * Suspense wrapper with default loading state
 */
interface SuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SuspenseWrapper({ children, fallback }: SuspenseWrapperProps) {
  return (
    <Suspense fallback={fallback || <PageLoader />}>
      {children}
    </Suspense>
  );
}

/**
 * Suspense wrapper specifically for editor components
 */
export function EditorSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<EditorSkeleton className="h-[500px]" />}>
      {children}
    </Suspense>
  );
}

/**
 * Higher-order component to wrap any component with Suspense
 */
export function withSuspense<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithSuspenseWrapper(props: P) {
    return (
      <Suspense fallback={fallback || <PageLoader />}>
        <WrappedComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Prefetch a lazy component (call this on hover/focus for faster navigation)
 */
export function prefetchComponent(lazyComponent: ReturnType<typeof lazy>) {
  // Trigger the import
  const componentModule = lazyComponent as unknown as { _payload?: { _result?: unknown } };
  if (componentModule._payload && !componentModule._payload._result) {
    // Force the lazy component to start loading
    try {
      // This is a bit hacky but works to prefetch
      const promise = (lazyComponent as unknown as () => Promise<unknown>)();
      if (promise && typeof promise.then === 'function') {
        promise.catch(() => {
          // Silently ignore prefetch errors
        });
      }
    } catch {
      // Silently ignore
    }
  }
}

/**
 * Hook to prefetch routes on link hover
 * 
 * Usage:
 * const prefetch = usePrefetch();
 * <Link onMouseEnter={() => prefetch(LazyContractPlayground)}>Playground</Link>
 */
export function usePrefetch() {
  return (lazyComponent: ReturnType<typeof lazy>) => {
    prefetchComponent(lazyComponent);
  };
}

export default {
  // Lazy components
  LazyContractPlayground,
  LazySandboxPage,
  LazyFullStackDemoPage,
  LazyInteractiveLearningPlayground,
  LazyMarketsPage,
  LazyInnovationShowcase,
  LazyDocsPage,
  LazyApiReferencePage,
  LazyCommunityPage,
  LazyExplorePage,
  
  // Utilities
  SuspenseWrapper,
  EditorSuspense,
  withSuspense,
  prefetchComponent,
  usePrefetch,
};

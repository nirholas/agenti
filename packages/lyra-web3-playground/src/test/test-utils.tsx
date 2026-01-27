/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Test like you code - with passion! 🧪
 */

import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

/**
 * Mock stores for testing
 */
export const mockThemeStore = {
  mode: 'dark' as const,
  toggleMode: vi.fn(),
  setMode: vi.fn(),
};

export const mockWalletStore = {
  address: null as string | null,
  isConnected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  setAddress: vi.fn(),
};

export const mockAccessibilityStore = {
  reducedMotion: false,
  highContrast: false,
  fontSize: 16,
  applyAccessibilityCSS: vi.fn(),
};

/**
 * Setup mocks for common stores
 */
export function setupStoreMocks() {
  vi.mock('@/stores/themeStore', () => ({
    useThemeStore: () => mockThemeStore,
  }));

  vi.mock('@/stores/walletStore', () => ({
    useWalletStore: () => mockWalletStore,
  }));

  vi.mock('@/stores/accessibilityStore', () => ({
    useAccessibilityStore: () => mockAccessibilityStore,
  }));
}

/**
 * Reset all mock functions
 */
export function resetMocks() {
  mockThemeStore.toggleMode.mockClear();
  mockThemeStore.setMode.mockClear();
  mockWalletStore.connect.mockClear();
  mockWalletStore.disconnect.mockClear();
  mockWalletStore.setAddress.mockClear();
  mockAccessibilityStore.applyAccessibilityCSS.mockClear();
}

/**
 * Create a connected wallet state
 */
export function mockConnectedWallet(address: string = '0x1234...abcd') {
  mockWalletStore.address = address;
  mockWalletStore.isConnected = true;
}

/**
 * Create a disconnected wallet state
 */
export function mockDisconnectedWallet() {
  mockWalletStore.address = null;
  mockWalletStore.isConnected = false;
}

/**
 * All providers wrapper for testing
 */
interface AllProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

/**
 * Custom render function that wraps components with all necessary providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  // Set initial route
  window.history.pushState({}, 'Test page', route);
  
  const user = userEvent.setup();
  
  return {
    user,
    ...render(ui, {
      wrapper: AllProviders,
      ...options,
    }),
  };
}

/**
 * Wait for async operations with timeout
 */
export async function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock fetch response
 */
export function mockFetchResponse<T>(data: T, status: number = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  } as Response);
}

/**
 * Mock console methods for testing error handling
 */
export function mockConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  const mockError = vi.fn();
  const mockWarn = vi.fn();
  const mockLog = vi.fn();

  beforeEach(() => {
    console.error = mockError;
    console.warn = mockWarn;
    console.log = mockLog;
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
    mockError.mockClear();
    mockWarn.mockClear();
    mockLog.mockClear();
  });

  return { mockError, mockWarn, mockLog };
}

/**
 * Create a mock Ethereum provider
 */
export function createMockProvider() {
  return {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    isMetaMask: true,
    selectedAddress: null,
    chainId: '0x1',
  };
}

/**
 * Mock window.ethereum
 */
export function mockEthereum() {
  const mockProvider = createMockProvider();
  
  Object.defineProperty(window, 'ethereum', {
    value: mockProvider,
    writable: true,
    configurable: true,
  });

  return mockProvider;
}

/**
 * Clean up window.ethereum mock
 */
export function cleanupEthereum() {
  // @ts-ignore - cleaning up mock
  delete window.ethereum;
}

/**
 * Test accessibility - basic checks
 */
export async function testA11y(container: HTMLElement) {
  // Check for main landmark
  const main = container.querySelector('main, [role="main"]');
  
  // Check all images have alt text
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    expect(img).toHaveAttribute('alt');
  });
  
  // Check all buttons have accessible names
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    const hasText = button.textContent?.trim();
    const hasAriaLabel = button.getAttribute('aria-label');
    const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
    expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
  });
  
  // Check form inputs have labels
  const inputs = container.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const associatedLabel = id ? container.querySelector(`label[for="${id}"]`) : null;
    expect(ariaLabel || ariaLabelledBy || associatedLabel).toBeTruthy();
  });

  return { main, images, buttons, inputs };
}

/**
 * Wait for element to appear with custom timeout
 */
export async function waitForElement(
  container: HTMLElement,
  selector: string,
  timeout: number = 5000
): Promise<Element | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = container.querySelector(selector);
    if (element) return element;
    await waitForAsync(50);
  }
  
  return null;
}

/**
 * Simulate viewport resize
 */
export function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

/**
 * Common viewport presets
 */
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  wide: { width: 2560, height: 1440 },
};

/**
 * Test that component renders without crashing
 */
export function itShouldRenderWithoutCrashing(
  name: string,
  Component: () => ReactElement
) {
  it(`${name} renders without crashing`, () => {
    expect(() => renderWithProviders(<Component />)).not.toThrow();
  });
}

/**
 * Test that component matches snapshot
 */
export function itShouldMatchSnapshot(
  name: string,
  Component: () => ReactElement
) {
  it(`${name} matches snapshot`, () => {
    const { container } = renderWithProviders(<Component />);
    expect(container).toMatchSnapshot();
  });
}

/**
 * Re-export testing library utilities for convenience
 */
export { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
export { userEvent };
export { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

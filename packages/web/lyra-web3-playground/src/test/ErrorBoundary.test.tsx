/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Test error handling like a pro 🛡️
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error during tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We're sorry/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalled();
  });

  it('shows Try Again button that resets error state', () => {
    // Use a ref to control throwing behavior
    let shouldThrowRef = { current: true };
    
    const ThrowOnDemand = () => {
      if (shouldThrowRef.current) {
        throw new Error('Test error');
      }
      return <div>No error</div>;
    };
    
    render(
      <ErrorBoundary>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    
    // Error UI should be shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Change the ref so it won't throw on next render
    shouldThrowRef.current = false;
    
    // Click Try Again - this should reset the error state and re-render children
    fireEvent.click(screen.getByText('Try Again'));
    
    // Should show content again since shouldThrowRef.current is now false
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('shows Go Home button', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('shows reload option', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Or reload the page')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    const TestComponent = () => <div>Test content</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);
    
    render(<WrappedComponent />);
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches errors in wrapped component', () => {
    const ErrorComponent = withErrorBoundary(ThrowError);
    
    render(<ErrorComponent />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    const ErrorComponent = withErrorBoundary(
      ThrowError,
      <div data-testid="hoc-fallback">HOC fallback</div>
    );
    
    render(<ErrorComponent />);
    
    expect(screen.getByTestId('hoc-fallback')).toBeInTheDocument();
  });
});

/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Buttons that speak to everyone ♿
 */

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useAnnounce } from './LiveAnnouncer';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Loading state - announces to screen readers */
  isLoading?: boolean;
  /** Loading text for screen readers (default: "Loading") */
  loadingText?: string;
  /** Icon to display before text */
  leftIcon?: LucideIcon;
  /** Icon to display after text */
  rightIcon?: LucideIcon;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
  /** Announce action completion to screen readers */
  announceOnClick?: string;
}

const variants = {
  primary: `
    bg-gradient-to-r from-primary-600 to-secondary-600 text-white
    hover:from-primary-700 hover:to-secondary-700
    focus:ring-primary-500
    disabled:from-gray-400 disabled:to-gray-400
  `,
  secondary: `
    bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white
    hover:bg-gray-200 dark:hover:bg-gray-600
    focus:ring-gray-500
  `,
  ghost: `
    bg-transparent text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-gray-700
    focus:ring-gray-500
  `,
  danger: `
    bg-red-600 text-white
    hover:bg-red-700
    focus:ring-red-500
  `,
  success: `
    bg-green-600 text-white
    hover:bg-green-700
    focus:ring-green-500
  `,
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
};

const iconSizes = {
  sm: 16,
  md: 18,
  lg: 20,
};

/**
 * AccessibleButton Component
 * 
 * A fully accessible button with:
 * - Loading states announced to screen readers
 * - Proper disabled handling
 * - Focus management
 * - Icon support
 * 
 * WCAG 2.1 Compliance:
 * - 2.1.1 Keyboard: Fully keyboard accessible
 * - 4.1.2 Name, Role, Value: Proper button semantics
 * - 1.4.1 Use of Color: Doesn't rely on color alone
 * 
 * @example
 * <AccessibleButton
 *   isLoading={isSaving}
 *   loadingText="Saving your changes"
 *   onClick={handleSave}
 *   announceOnClick="Changes saved successfully"
 * >
 *   Save Changes
 * </AccessibleButton>
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      children,
      isLoading = false,
      loadingText = 'Loading',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      announceOnClick,
      className,
      disabled,
      onClick,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const { announce } = useAnnounce();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || disabled) {
        e.preventDefault();
        return;
      }
      
      onClick?.(e);
      
      if (announceOnClick) {
        // Delay announcement slightly so screen reader finishes reading button
        setTimeout(() => {
          announce(announceOnClick, 'polite');
        }, 100);
      }
    };

    const isDisabled = disabled || isLoading;
    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onClick={handleClick}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-200',
          // Focus styles - always visible for keyboard users
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'dark:focus:ring-offset-gray-900',
          // Disabled styles
          'disabled:cursor-not-allowed disabled:opacity-60',
          // Variant and size
          variants[variant],
          sizes[size],
          // Full width
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {/* Loading spinner or left icon */}
        {isLoading ? (
          <Loader2 
            size={iconSize} 
            className="animate-spin" 
            aria-hidden="true"
          />
        ) : LeftIcon ? (
          <LeftIcon size={iconSize} aria-hidden="true" />
        ) : null}

        {/* Button text - hidden when loading for visual, but visible to screen readers */}
        <span className={isLoading ? 'opacity-70' : ''}>
          {children}
        </span>

        {/* Loading announcement for screen readers */}
        {isLoading && (
          <span className="sr-only" role="status">
            {loadingText}
          </span>
        )}

        {/* Right icon */}
        {RightIcon && !isLoading && (
          <RightIcon size={iconSize} aria-hidden="true" />
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

/**
 * LinkButton Component
 * 
 * For links that look like buttons but navigate to a new page.
 * Uses proper anchor semantics for accessibility.
 */
interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  external?: boolean;
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  external = false,
}: LinkButtonProps) {
  const externalProps = external
    ? {
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'dark:focus:ring-offset-gray-900',
        variants[variant],
        sizes[size],
        className
      )}
      {...externalProps}
    >
      {children}
      {external && (
        <span className="sr-only">(opens in new tab)</span>
      )}
    </a>
  );
}

export default AccessibleButton;

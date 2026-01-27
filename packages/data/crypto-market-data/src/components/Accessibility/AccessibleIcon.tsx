/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Icons for everyone, seen and heard ♿
 */

import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface AccessibleIconProps {
  /** The Lucide icon component to render */
  icon: LucideIcon;
  /** Accessible label for screen readers. If not provided, icon is decorative */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Icon size (default: 20) */
  size?: number;
  /** Whether this is a decorative icon (no label needed) */
  decorative?: boolean;
}

/**
 * AccessibleIcon Component
 * 
 * Renders icons with proper accessibility attributes:
 * - Decorative icons: hidden from screen readers with aria-hidden
 * - Meaningful icons: announced with sr-only text
 * 
 * WCAG 2.1 Requirements:
 * - 1.1.1 Non-text Content: Icons must have text alternatives
 * - 4.1.2 Name, Role, Value: Interactive icons need accessible names
 * 
 * @example
 * // Decorative icon (next to visible text)
 * <AccessibleIcon icon={Home} decorative />
 * 
 * // Meaningful icon (standalone, needs label)
 * <AccessibleIcon icon={Settings} label="Settings menu" />
 */
export function AccessibleIcon({
  icon: Icon,
  label,
  className,
  size = 20,
  decorative = false,
}: AccessibleIconProps) {
  // If decorative or no label, hide from screen readers
  if (decorative || !label) {
    return (
      <Icon
        className={className}
        size={size}
        aria-hidden="true"
        focusable="false"
      />
    );
  }

  // Meaningful icon with accessible label
  return (
    <span className="inline-flex items-center">
      <Icon
        className={className}
        size={size}
        aria-hidden="true"
        focusable="false"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * IconButton Component
 * 
 * A button that contains only an icon, with proper accessibility.
 * This is crucial for icon-only buttons like close, menu, settings.
 * 
 * @example
 * <IconButton 
 *   icon={X} 
 *   label="Close dialog" 
 *   onClick={onClose}
 * />
 */
interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  size?: number;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'default' | 'ghost' | 'danger';
}

const variantStyles = {
  default: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',
  ghost: 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400',
  danger: 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400',
};

export function IconButton({
  icon: Icon,
  label,
  onClick,
  className,
  size = 20,
  disabled = false,
  type = 'button',
  variant = 'default',
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'p-2 rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        'dark:focus:ring-offset-gray-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        className
      )}
    >
      <Icon size={size} aria-hidden="true" focusable="false" />
    </button>
  );
}

export default AccessibleIcon;

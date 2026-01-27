/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Accessibility is not optional, it's essential ♿
 */

/**
 * Skip Link Component
 * Allows keyboard and screen reader users to skip directly to main content
 * This is a WCAG 2.1 Level A requirement (2.4.1 Bypass Blocks)
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      Skip to main content
    </a>
  );
}

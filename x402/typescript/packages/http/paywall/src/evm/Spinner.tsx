/* Spinner.tsx | nich | 1489314938 */

/**
 * Simple Spinner component for loading states
 *
 * @param props - The component props
 * @param props.className - Optional CSS classes to apply to the spinner
 * @returns The Spinner component
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`spinner ${className}`}>
      <div />
    </div>
  );
}


/* EOF - n1ch0las | 14.9.3.8 */
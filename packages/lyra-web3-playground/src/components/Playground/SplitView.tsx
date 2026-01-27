/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Creating connections through code 🔗
 */

import { useState, useRef, useEffect } from 'react';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // 0-100, percentage for left panel
  minLeftWidth?: number;
  minRightWidth?: number;
  orientation?: 'horizontal' | 'vertical';
  showResizer?: boolean;
}

export default function SplitView({
  left,
  right,
  defaultSplit = 50,
  minLeftWidth = 300,
  minRightWidth = 300,
  orientation = 'horizontal',
  showResizer = true
}: SplitViewProps) {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const [isLeftMaximized, setIsLeftMaximized] = useState(false);
  const [isRightMaximized, setIsRightMaximized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = orientation === 'horizontal';

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newSplit: number;

      if (isHorizontal) {
        const containerWidth = rect.width;
        const mouseX = e.clientX - rect.left;
        newSplit = (mouseX / containerWidth) * 100;

        // Apply min width constraints
        const minLeftPercent = (minLeftWidth / containerWidth) * 100;
        const minRightPercent = (minRightWidth / containerWidth) * 100;
        newSplit = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newSplit));
      } else {
        const containerHeight = rect.height;
        const mouseY = e.clientY - rect.top;
        newSplit = (mouseY / containerHeight) * 100;

        // Apply min height constraints
        const minTopPercent = (minLeftWidth / containerHeight) * 100;
        const minBottomPercent = (minRightWidth / containerHeight) * 100;
        newSplit = Math.max(minTopPercent, Math.min(100 - minBottomPercent, newSplit));
      }

      setSplit(newSplit);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minLeftWidth, minRightWidth]);

  const handleMaximizeLeft = () => {
    if (isLeftMaximized) {
      setSplit(defaultSplit);
      setIsLeftMaximized(false);
    } else {
      setSplit(95);
      setIsLeftMaximized(true);
      setIsRightMaximized(false);
    }
  };

  const handleMaximizeRight = () => {
    if (isRightMaximized) {
      setSplit(defaultSplit);
      setIsRightMaximized(false);
    } else {
      setSplit(5);
      setIsRightMaximized(true);
      setIsLeftMaximized(false);
    }
  };

  const leftStyle = isHorizontal
    ? { width: `${split}%` }
    : { height: `${split}%` };

  const rightStyle = isHorizontal
    ? { width: `${100 - split}%` }
    : { height: `${100 - split}%` };

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full overflow-hidden`}
    >
      {/* Left/Top Panel */}
      <div
        style={leftStyle}
        className="relative overflow-hidden"
      >
        {/* Maximize Button */}
        {showResizer && (
          <button
            onClick={handleMaximizeLeft}
            className="absolute top-2 right-2 z-10 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={isLeftMaximized ? 'Restore' : 'Maximize'}
          >
            {isLeftMaximized ? (
              <Minimize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        )}
        <div className="h-full w-full overflow-auto">
          {left}
        </div>
      </div>

      {/* Resizer */}
      {showResizer && (
        <div
          onMouseDown={() => setIsDragging(true)}
          className={`
            flex-shrink-0 relative group
            ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
            ${isDragging ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}
            hover:bg-primary-400 transition-colors
          `}
        >
          <div
            className={`
              absolute bg-gray-300 dark:bg-gray-600 rounded-full
              flex items-center justify-center
              opacity-0 group-hover:opacity-100 transition-opacity
              ${isHorizontal
                ? 'w-6 h-12 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'w-12 h-6 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
              }
            `}
          >
            <GripVertical
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${isHorizontal ? '' : 'rotate-90'}`}
            />
          </div>
        </div>
      )}

      {/* Right/Bottom Panel */}
      <div
        style={rightStyle}
        className="relative overflow-hidden"
      >
        {/* Maximize Button */}
        {showResizer && (
          <button
            onClick={handleMaximizeRight}
            className="absolute top-2 right-2 z-10 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={isRightMaximized ? 'Restore' : 'Maximize'}
          >
            {isRightMaximized ? (
              <Minimize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        )}
        <div className="h-full w-full overflow-auto">
          {right}
        </div>
      </div>
    </div>
  );
}

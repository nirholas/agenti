/**
 * PlaygroundLayout Component - Main layout structure for playground
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlaygroundLayoutProps {
  /** Header content (connection status, etc.) */
  header: React.ReactNode;
  /** Sidebar content (transport config, etc.) */
  sidebar: React.ReactNode;
  /** Main content area (tools/resources/prompts panels) */
  main: React.ReactNode;
  /** Footer content (execution logs, etc.) */
  footer?: React.ReactNode;
  /** Default sidebar width in pixels */
  defaultSidebarWidth?: number;
  /** Minimum sidebar width in pixels */
  minSidebarWidth?: number;
  /** Maximum sidebar width in pixels */
  maxSidebarWidth?: number;
  /** Default footer height in pixels */
  defaultFooterHeight?: number;
  /** Minimum footer height in pixels */
  minFooterHeight?: number;
  /** Maximum footer height in pixels */
  maxFooterHeight?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PlaygroundLayout - Responsive layout with resizable panels
 */
export default function PlaygroundLayout({
  header,
  sidebar,
  main,
  footer,
  defaultSidebarWidth = 320,
  minSidebarWidth = 280,
  maxSidebarWidth = 500,
  defaultFooterHeight = 200,
  minFooterHeight = 100,
  maxFooterHeight = 400,
  className = '',
}: PlaygroundLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [footerHeight, setFooterHeight] = useState(defaultFooterHeight);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingFooter, setIsDraggingFooter] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle sidebar resize
  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      setSidebarWidth(
        Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth))
      );
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSidebar, minSidebarWidth, maxSidebarWidth]);

  // Handle footer resize
  useEffect(() => {
    if (!isDraggingFooter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      setFooterHeight(
        Math.max(minFooterHeight, Math.min(maxFooterHeight, newHeight))
      );
    };

    const handleMouseUp = () => {
      setIsDraggingFooter(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingFooter, minFooterHeight, maxFooterHeight]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // Toggle footer
  const toggleFooter = useCallback(() => {
    setIsFooterCollapsed((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-col h-full overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* Main area with sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-r border-neutral-800 overflow-hidden"
              style={{ width: sidebarWidth }}
            >
              <div className="h-full overflow-y-auto">{sidebar}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar resize handle */}
        {!isSidebarCollapsed && (
          <div
            onMouseDown={() => setIsDraggingSidebar(true)}
            className={cn(
              'w-1 flex-shrink-0 bg-transparent hover:bg-white/10 cursor-col-resize transition-colors',
              isDraggingSidebar && 'bg-white/20'
            )}
          />
        )}

        {/* Sidebar toggle + Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sidebar toggle button */}
          <div className="absolute top-[70px] left-0 z-10">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-r-lg bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-400 hover:text-white transition-colors"
              title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 min-h-0 overflow-hidden">{main}</div>
        </div>
      </div>

      {/* Footer resize handle */}
      {footer && !isFooterCollapsed && (
        <div
          onMouseDown={() => setIsDraggingFooter(true)}
          className={cn(
            'h-1 flex-shrink-0 bg-transparent hover:bg-white/10 cursor-row-resize transition-colors flex items-center justify-center',
            isDraggingFooter && 'bg-white/20'
          )}
        >
          <GripVertical className="w-4 h-4 text-neutral-600 rotate-90" />
        </div>
      )}

      {/* Footer */}
      {footer && (
        <AnimatePresence initial={false}>
          {!isFooterCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: footerHeight, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-t border-neutral-800 overflow-hidden"
              style={{ height: footerHeight }}
            >
              <div className="h-full overflow-hidden">{footer}</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Footer toggle (when collapsed) */}
      {footer && isFooterCollapsed && (
        <div className="flex-shrink-0 border-t border-neutral-800">
          <button
            onClick={toggleFooter}
            className="w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Show execution log
          </button>
        </div>
      )}
    </div>
  );
}

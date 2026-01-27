/**
 * ResourcesPanel Component - Display and read MCP resources
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  FolderOpen,
  Eye,
  Loader2,
  AlertCircle,
  File,
  Image,
  Database,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import JsonViewer from './JsonViewer';
import type { McpResource, ResourceContents } from './types';

export interface ResourcesPanelProps {
  /** List of available resources */
  resources: McpResource[];
  /** Currently selected resource */
  selectedResource: McpResource | null;
  /** Callback when a resource is selected */
  onSelectResource: (resource: McpResource) => void;
  /** Callback when a resource is read */
  onRead: (uri: string) => void;
  /** Whether a resource read is in progress */
  isReading?: boolean;
  /** Last read contents */
  lastContents?: ResourceContents | null;
  /** Last read error */
  lastError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon for resource based on URI or mimeType
 */
function getResourceIcon(resource: McpResource): React.ReactNode {
  const uri = resource.uri.toLowerCase();
  const mimeType = resource.mimeType?.toLowerCase() || '';

  if (mimeType.startsWith('image/')) {
    return <Image className="w-4 h-4" />;
  }
  if (mimeType.includes('json') || uri.endsWith('.json')) {
    return <Database className="w-4 h-4" />;
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return <Globe className="w-4 h-4" />;
  }
  if (uri.startsWith('file://') || uri.includes('/')) {
    return <File className="w-4 h-4" />;
  }
  return <FileText className="w-4 h-4" />;
}

/**
 * Get scheme from URI
 */
function getScheme(uri: string): string {
  const match = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  return match ? match[1].toLowerCase() : 'other';
}

/**
 * ResourcesPanel - Browse and read MCP resources
 */
export default function ResourcesPanel({
  resources,
  selectedResource,
  onSelectResource,
  onRead,
  isReading = false,
  lastContents,
  lastError,
  className = '',
}: ResourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const query = searchQuery.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.uri.toLowerCase().includes(query) ||
        resource.name?.toLowerCase().includes(query) ||
        resource.description?.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

  // Group resources by scheme
  const groupedResources = useMemo(() => {
    const groups: Record<string, McpResource[]> = {};
    for (const resource of filteredResources) {
      const scheme = getScheme(resource.uri);
      if (!groups[scheme]) {
        groups[scheme] = [];
      }
      groups[scheme].push(resource);
    }
    return groups;
  }, [filteredResources]);

  // Handle resource read
  const handleRead = () => {
    if (!selectedResource) return;
    onRead(selectedResource.uri);
  };

  // Render contents
  const renderContents = (contents: ResourceContents) => {
    if (contents.text !== undefined) {
      // Try to parse as JSON
      try {
        const json = JSON.parse(contents.text);
        return <JsonViewer data={json} maxHeight={400} />;
      } catch {
        // Not JSON, render as text
        return (
          <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono bg-neutral-950 p-4 rounded-lg border border-neutral-800 max-h-[400px] overflow-auto">
            {contents.text}
          </pre>
        );
      }
    }
    if (contents.blob !== undefined) {
      const mimeType = contents.mimeType || 'application/octet-stream';
      if (mimeType.startsWith('image/')) {
        return (
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <img
              src={`data:${mimeType};base64,${contents.blob}`}
              alt={contents.uri}
              className="max-w-full max-h-[400px] object-contain"
            />
          </div>
        );
      }
      return (
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
          <p className="text-sm text-neutral-400">
            Binary content ({mimeType})
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {Math.round((contents.blob.length * 3) / 4 / 1024)} KB (base64 encoded)
          </p>
        </div>
      );
    }
    return (
      <p className="text-sm text-neutral-500 italic">No content available</p>
    );
  };

  return (
    <div className={cn('flex h-full', className)}>
      {/* Resources List */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-800 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-neutral-800">
          <Input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-sm"
          />
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(groupedResources).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <FolderOpen className="w-8 h-8 text-neutral-600 mb-2" />
              <p className="text-sm text-neutral-500">
                {searchQuery
                  ? 'No resources match your search'
                  : 'No resources available'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {Object.entries(groupedResources).map(([scheme, schemeResources]) => (
                <div key={scheme}>
                  <div className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {scheme}://
                  </div>
                  {schemeResources.map((resource) => {
                    const isSelected = selectedResource?.uri === resource.uri;

                    return (
                      <button
                        key={resource.uri}
                        onClick={() => onSelectResource(resource)}
                        className={cn(
                          'w-full px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-white/10 border-l-2 border-white'
                            : 'hover:bg-white/5 border-l-2 border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex-shrink-0',
                              isSelected ? 'text-white' : 'text-neutral-500'
                            )}
                          >
                            {getResourceIcon(resource)}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-medium truncate',
                              isSelected ? 'text-white' : 'text-neutral-300'
                            )}
                          >
                            {resource.name || resource.uri.split('/').pop()}
                          </span>
                          {resource.mimeType && (
                            <Badge
                              variant="secondary"
                              className="ml-auto text-xs px-1.5"
                            >
                              {resource.mimeType.split('/').pop()}
                            </Badge>
                          )}
                        </div>
                        {resource.description && (
                          <p
                            className={cn(
                              'mt-1 text-xs truncate',
                              isSelected ? 'text-neutral-400' : 'text-neutral-500'
                            )}
                          >
                            {resource.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource Count */}
        <div className="px-3 py-2 border-t border-neutral-800 text-xs text-neutral-500">
          {filteredResources.length} of {resources.length} resources
        </div>
      </div>

      {/* Resource Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedResource ? (
          <>
            {/* Resource Header */}
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate flex items-center gap-2">
                    {getResourceIcon(selectedResource)}
                    {selectedResource.name || selectedResource.uri.split('/').pop()}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-400 font-mono truncate">
                    {selectedResource.uri}
                  </p>
                  {selectedResource.description && (
                    <p className="mt-2 text-sm text-neutral-500">
                      {selectedResource.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {selectedResource.mimeType && (
                  <Badge variant="blue">
                    {selectedResource.mimeType}
                  </Badge>
                )}
              </div>
            </div>

            {/* Read Button */}
            <div className="p-4 border-b border-neutral-800">
              <Button
                onClick={handleRead}
                disabled={isReading}
                loading={isReading}
                variant="secondary"
                leftIcon={!isReading && <Eye className="w-4 h-4" />}
              >
                {isReading ? 'Reading...' : 'Read Resource'}
              </Button>
            </div>

            {/* Contents */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {lastError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                  >
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Error reading resource</span>
                    </div>
                    <p className="text-sm text-red-300">{lastError}</p>
                  </motion.div>
                ) : lastContents ? (
                  <motion.div
                    key="contents"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h4 className="text-sm font-medium text-neutral-300 mb-3">
                      Contents
                    </h4>
                    {renderContents(lastContents)}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <Eye className="w-8 h-8 text-neutral-600 mb-3" />
                    <p className="text-sm text-neutral-500">
                      Click &quot;Read Resource&quot; to view contents
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* No resource selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <FolderOpen className="w-12 h-12 text-neutral-700 mb-4" />
            <h3 className="text-lg font-medium text-neutral-400 mb-2">
              No resource selected
            </h3>
            <p className="text-sm text-neutral-500 max-w-xs">
              Select a resource from the list to view its details and read its
              contents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

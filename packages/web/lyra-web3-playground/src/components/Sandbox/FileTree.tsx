/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 May your builds always succeed 🍀
 */

import { useState } from 'react';
import {
  FileCode,
  Folder,
  Plus,
  Trash2
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface FileTreeProps {
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}

export default function FileTree({ onLog }: FileTreeProps) {
  const { 
    getCurrentWorkspace, 
    addFile, 
    deleteFile, 
    setActiveFile,
    getActiveFile 
  } = useWorkspaceStore();
  
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const workspace = getCurrentWorkspace();
  const activeFile = getActiveFile();

  const handleCreateFile = () => {
    if (!workspace) return;
    
    if (!newFileName.trim()) {
      onLog('error', 'File name cannot be empty');
      return;
    }

    const fileId = addFile(workspace.id, {
      name: newFileName,
      path: newFileName,
      content: getDefaultContent(newFileName),
      language: getLanguageFromExtension(newFileName)
    });

    onLog('success', `Created ${newFileName}`);
    setNewFileName('');
    setIsCreating(false);
    setActiveFile(workspace.id, fileId);
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (!workspace) return;
    
    if (confirm(`Delete ${fileName}?`)) {
      deleteFile(workspace.id, fileId);
      onLog('info', `Deleted ${fileName}`);
    }
  };

  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'sol': 'solidity',
      'js': 'javascript',
      'ts': 'typescript',
      'json': 'json',
      'md': 'markdown',
      'txt': 'plaintext'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const getDefaultContent = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (ext === 'sol') {
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${filename.replace('.sol', '')} {
    // Your code here
}`;
    }
    
    if (ext === 'js' || ext === 'ts') {
      return `// ${filename}\n\n`;
    }
    
    return '';
  };

  if (!workspace) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No workspace loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
            Files
          </h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="New file"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isCreating && (
          <div className="flex gap-1">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFile();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFileName('');
                }
              }}
              placeholder="filename.sol"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              autoFocus
            />
            <button
              onClick={handleCreateFile}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {workspace.files.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No files yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-2 text-blue-600 hover:underline"
            >
              Create your first file
            </button>
          </div>
        ) : (
          <div className="py-2">
            {workspace.files.map((file) => (
              <div
                key={file.id}
                onClick={() => setActiveFile(workspace.id, file.id)}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  file.id === activeFile?.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileCode className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  {file.isModified && (
                    <span className="text-blue-500 text-xs">●</span>
                  )}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id, file.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Info */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Folder className="w-3 h-3" />
          <span className="truncate">{workspace.name}</span>
        </div>
        <div className="mt-1">
          {workspace.files.length} file{workspace.files.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Never stop learning, never stop growing 🌱
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isModified: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  files: WorkspaceFile[];
  activeFileId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  
  // Workspace actions
  createWorkspace: (name: string) => string;
  deleteWorkspace: (id: string) => void;
  setCurrentWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  
  // File actions
  addFile: (workspaceId: string, file: Omit<WorkspaceFile, 'id' | 'isModified'>) => string;
  updateFile: (workspaceId: string, fileId: string, content: string) => void;
  deleteFile: (workspaceId: string, fileId: string) => void;
  renameFile: (workspaceId: string, fileId: string, newName: string, newPath: string) => void;
  setActiveFile: (workspaceId: string, fileId: string) => void;
  
  // Utility actions
  getCurrentWorkspace: () => Workspace | null;
  getActiveFile: () => WorkspaceFile | null;
  exportWorkspace: (id: string) => string;
  importWorkspace: (data: string) => string;
}

const defaultWorkspace = (): Workspace => ({
  id: Date.now().toString(),
  name: 'New Workspace',
  files: [
    {
      id: 'default-1',
      name: 'Contract.sol',
      path: 'Contract.sol',
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyContract {
    // Your code here
}`,
      language: 'solidity',
      isModified: false
    }
  ],
  activeFileId: 'default-1',
  createdAt: Date.now(),
  updatedAt: Date.now()
});

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      const initialWorkspace = defaultWorkspace();
      
      return {
        workspaces: [initialWorkspace],
        currentWorkspaceId: initialWorkspace.id,

      createWorkspace: (name: string) => {
        const newWorkspace: Workspace = {
          id: Date.now().toString(),
          name,
          files: [],
          activeFileId: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
          currentWorkspaceId: newWorkspace.id
        }));
        
        return newWorkspace.id;
      },

      deleteWorkspace: (id: string) => {
        set((state) => {
          const filtered = state.workspaces.filter(w => w.id !== id);
          const newCurrent = state.currentWorkspaceId === id
            ? (filtered.length > 0 ? filtered[0].id : null)
            : state.currentWorkspaceId;
          
          return {
            workspaces: filtered,
            currentWorkspaceId: newCurrent
          };
        });
      },

      setCurrentWorkspace: (id: string) => {
        set({ currentWorkspaceId: id });
      },

      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === id ? { ...w, name, updatedAt: Date.now() } : w
          )
        }));
      },

      addFile: (workspaceId: string, file) => {
        const fileId = `file-${Date.now()}`;
        
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId
              ? {
                  ...w,
                  files: [...w.files, { ...file, id: fileId, isModified: false }],
                  activeFileId: fileId,
                  updatedAt: Date.now()
                }
              : w
          )
        }));
        
        return fileId;
      },

      updateFile: (workspaceId: string, fileId: string, content: string) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId
              ? {
                  ...w,
                  files: w.files.map(f =>
                    f.id === fileId ? { ...f, content, isModified: true } : f
                  ),
                  updatedAt: Date.now()
                }
              : w
          )
        }));
      },

      deleteFile: (workspaceId: string, fileId: string) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId
              ? {
                  ...w,
                  files: w.files.filter(f => f.id !== fileId),
                  activeFileId: w.activeFileId === fileId
                    ? (w.files.length > 1 ? w.files.find(f => f.id !== fileId)?.id || null : null)
                    : w.activeFileId,
                  updatedAt: Date.now()
                }
              : w
          )
        }));
      },

      renameFile: (workspaceId: string, fileId: string, newName: string, newPath: string) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId
              ? {
                  ...w,
                  files: w.files.map(f =>
                    f.id === fileId ? { ...f, name: newName, path: newPath } : f
                  ),
                  updatedAt: Date.now()
                }
              : w
          )
        }));
      },

      setActiveFile: (workspaceId: string, fileId: string) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId ? { ...w, activeFileId: fileId } : w
          )
        }));
      },

      getCurrentWorkspace: () => {
        const { workspaces, currentWorkspaceId } = get();
        return workspaces.find(w => w.id === currentWorkspaceId) || null;
      },

      getActiveFile: () => {
        const workspace = get().getCurrentWorkspace();
        if (!workspace || !workspace.activeFileId) return null;
        return workspace.files.find(f => f.id === workspace.activeFileId) || null;
      },

      exportWorkspace: (id: string) => {
        const workspace = get().workspaces.find(w => w.id === id);
        if (!workspace) throw new Error('Workspace not found');
        return JSON.stringify(workspace, null, 2);
      },

      importWorkspace: (data: string) => {
        try {
          const workspace: Workspace = JSON.parse(data);
          workspace.id = Date.now().toString(); // New ID to avoid conflicts
          
          set((state) => ({
            workspaces: [...state.workspaces, workspace],
            currentWorkspaceId: workspace.id
          }));
          
          return workspace.id;
        } catch (error) {
          throw new Error('Invalid workspace data');
        }
      }
    };
  },
    {
      name: 'workspace-storage',
      version: 1
    }
  )
);

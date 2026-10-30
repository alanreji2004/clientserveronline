import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  Folder,
  FolderPlus,
  FilePlus,
  Trash2,
  Code
} from 'lucide-react';
import type { FileItem } from '../../types';

interface FileExplorerProps {
  files: FileItem[];
  activeFile: string | null;
  dirtyFiles: Set<string>;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string, isDirectory: boolean) => void;
  onDeleteFile: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFile,
  dirtyFiles,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}) => {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const [newPath, setNewPath] = useState('');

  const handleCreateSubmit = (e: React.FormEvent, isDir: boolean) => {
    e.preventDefault();
    if (!newPath.trim()) return;
    onCreateFile(newPath.trim(), isDir);
    setNewPath('');
    setIsCreatingFile(false);
    setIsCreatingDir(false);
  };

  const getFileIcon = (file: FileItem) => {
    if (file.is_directory) {
      return <Folder size={14} color="#f59e0b" fill="#fef3c7" />;
    }
    if (file.name.endsWith('.py')) {
      return <Code size={14} color="#3b82f6" />;
    }
    if (file.name.endsWith('.c')) {
      return <FileCode size={14} color="#10b981" />;
    }
    if (file.name.endsWith('.h')) {
      return <FileCode size={14} color="#8b5cf6" />;
    }
    return <FileText size={14} color="var(--text-secondary)" />;
  };

  return (
    <div
      className="file-explorer-sidebar"
      style={{
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        minWidth: 0
      }}
    >
      {/* Explorer Header */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          Explorer
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => { setIsCreatingFile(true); setIsCreatingDir(false); }}
            title="New File"
            style={{ padding: '2px', color: 'var(--text-secondary)' }}
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => { setIsCreatingDir(true); setIsCreatingFile(false); }}
            title="New Folder"
            style={{ padding: '2px', color: 'var(--text-secondary)' }}
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* New File / Folder Input Form */}
      {(isCreatingFile || isCreatingDir) && (
        <form
          onSubmit={(e) => handleCreateSubmit(e, isCreatingDir)}
          style={{ padding: '6px 12px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
            {isCreatingDir ? 'Folder Name:' : 'File Name (e.g. client.py):'}
          </div>
          <input
            autoFocus
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsCreatingFile(false);
                setIsCreatingDir(false);
              }
            }}
            placeholder={isCreatingDir ? 'src' : 'worker.py'}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid var(--accent-color)',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          />
        </form>
      )}

      {/* Files List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {files.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
            No files in workspace
          </div>
        ) : (
          files.map((file) => {
            const isSelected = activeFile === file.path;
            const isDirty = dirtyFiles.has(file.path);

            return (
              <div
                key={file.path}
                onClick={() => !file.is_directory && onSelectFile(file.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 12px',
                  cursor: file.is_directory ? 'default' : 'pointer',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                  {getFileIcon(file)}
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  {isDirty && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-color)',
                      display: 'inline-block'
                    }} />
                  )}
                </div>

                {!file.is_directory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${file.name}?`)) {
                        onDeleteFile(file.path);
                      }
                    }}
                    title="Delete file"
                    style={{
                      opacity: 0.3,
                      padding: '2px',
                      color: 'var(--danger-color)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Help / Shortcut footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        Ctrl+S to save files
      </div>
    </div>
  );
};

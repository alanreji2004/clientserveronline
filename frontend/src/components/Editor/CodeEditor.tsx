import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco, OnMount } from '@monaco-editor/react';
import { X, Code, FileCode, FileText } from 'lucide-react';
import type { Diagnostic } from '../../types';

interface CodeEditorProps {
  openTabs: string[];
  activeFile: string | null;
  fileContents: Record<string, string>;
  dirtyFiles: Set<string>;
  diagnostics: Diagnostic[];
  theme: 'light' | 'dark';
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, newContent: string) => void;
  onSave: (path: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  openTabs,
  activeFile,
  fileContents,
  dirtyFiles,
  diagnostics,
  theme,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSave,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const getLanguage = (path: string | null): string => {
    if (!path) return 'plaintext';
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.c') || path.endsWith('.h')) return 'c';
    if (path.endsWith('.cpp') || path.endsWith('.hpp')) return 'cpp';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add Ctrl+S save action
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFile) {
        onSave(activeFile);
      }
    });

    updateMarkers();
  };

  const updateMarkers = () => {
    if (!monacoRef.current || !editorRef.current || !activeFile) return;

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    // Filter diagnostics for the active file
    const fileDiagnostics = diagnostics.filter(
      (d) => d.file === activeFile || activeFile.endsWith(d.file)
    );

    const markers = fileDiagnostics.map((d) => ({
      startLineNumber: d.line,
      startColumn: d.column || 1,
      endLineNumber: d.line,
      endColumn: d.column ? d.column + 10 : 80,
      message: d.message,
      severity:
        d.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : d.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
    }));

    monaco.editor.setModelMarkers(model, 'gcc', markers);
  };

  useEffect(() => {
    updateMarkers();
  }, [diagnostics, activeFile]);

  const activeContent = activeFile ? fileContents[activeFile] ?? '' : '';

  const getTabIcon = (path: string) => {
    if (path.endsWith('.py')) return <Code size={13} color="#3b82f6" />;
    if (path.endsWith('.c')) return <FileCode size={13} color="#10b981" />;
    if (path.endsWith('.h')) return <FileCode size={13} color="#8b5cf6" />;
    return <FileText size={13} color="var(--text-secondary)" />;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tabs Header */}
      <div style={{
        height: '35px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
      }}>
        {openTabs.map((tabPath) => {
          const isActive = tabPath === activeFile;
          const isDirty = dirtyFiles.has(tabPath);
          const fileName = tabPath.split('/').pop() || tabPath;

          return (
            <div
              key={tabPath}
              onClick={() => onSelectTab(tabPath)}
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                backgroundColor: isActive ? 'var(--tab-active-bg)' : 'var(--tab-inactive-bg)',
                borderRight: '1px solid var(--border-color)',
                borderTop: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {getTabIcon(tabPath)}
              <span>{fileName}</span>

              {isDirty && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-color)',
                  marginLeft: '2px'
                }} />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tabPath);
                }}
                style={{
                  padding: '2px',
                  borderRadius: '3px',
                  marginLeft: '4px',
                  opacity: 0.5,
                  display: 'flex',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeFile ? (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={activeContent}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            onChange={(val) => {
              if (activeFile && val !== undefined) {
                onChangeContent(activeFile, val);
              }
            }}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: true, scale: 0.75 },
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              lineNumbers: 'on',
              lineHeight: 20,
              renderWhitespace: 'selection',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
            }}
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            gap: '8px'
          }}>
            <FileCode size={36} strokeWidth={1.5} />
            <p>Select a file from the explorer to begin editing</p>
          </div>
        )}
      </div>
    </div>
  );
};

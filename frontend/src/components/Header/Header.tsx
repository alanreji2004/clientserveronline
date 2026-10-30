import React from 'react';
import {
  Play,
  Square,
  Cpu,
  Layers,
  Terminal as TerminalIcon,
  Sun,
  Moon,
  Plus,
  FolderOpen
} from 'lucide-react';
import type { Project, ProjectTemplateInfo, SystemHealth } from '../../types';

interface HeaderProps {
  project: Project | null;
  templates: ProjectTemplateInfo[];
  activeFile: string | null;
  isRunningAny: boolean;
  isCompiling: boolean;
  theme: 'light' | 'dark';
  systemHealth: SystemHealth | null;
  onRunCurrentFile: () => void;
  onCompileCurrentFile: () => void;
  onRunBothServerAndClient: () => void;
  onStopAll: () => void;
  onToggleTerminal: () => void;
  onToggleTheme: () => void;
  onSelectTemplate: (templateId: string) => void;
  onNewProjectModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  templates,
  activeFile,
  isRunningAny,
  isCompiling,
  theme,
  systemHealth,
  onRunCurrentFile,
  onCompileCurrentFile,
  onRunBothServerAndClient,
  onStopAll,
  onToggleTerminal,
  onToggleTheme,
  onSelectTemplate,
  onNewProjectModal,
}) => {
  return (
    <header style={{
      minHeight: '46px',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      gap: '8px',
      flexWrap: 'nowrap',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* Brand & Project Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            backgroundColor: 'var(--accent-color)',
            color: '#fff',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px'
          }}>
            IDE
          </div>
          <span className="hide-on-small" style={{ color: 'var(--text-primary)' }}>Online IDE</span>
        </div>

        <div className="hide-on-small" style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Project Selector / Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FolderOpen size={14} color="var(--text-secondary)" />
          <span style={{
            fontWeight: 500,
            color: 'var(--text-primary)',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '12px'
          }}>
            {project?.name || 'Project'}
          </span>
          <button
            onClick={onNewProjectModal}
            title="Create New Project"
            aria-label="Create New Project"
            style={{
              padding: '3px 6px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              color: 'var(--text-secondary)',
              fontSize: '11px'
            }}
          >
            <Plus size={11} /> <span className="hide-on-small">New</span>
          </button>
        </div>

        {/* Templates Quick Load Dropdown */}
        <select
          value={project?.template || ''}
          onChange={(e) => onSelectTemplate(e.target.value)}
          className="hide-on-small"
          style={{
            padding: '3px 6px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            maxWidth: '130px'
          }}
          title="Switch Template Project"
          aria-label="Switch Template Project"
        >
          <option value="" disabled>Template...</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Run Server & Client simultaneous button */}
        <button
          onClick={onRunBothServerAndClient}
          title="Concurrently launch both Server and Client"
          aria-label="Run Server and Client"
          className="mobile-touch-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            padding: '5px 10px',
            borderRadius: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={13} />
          <span className="hide-on-mobile">Run Server & Client</span>
          <span className="hide-on-desktop">Run All</span>
        </button>

        {/* Run Current File */}
        <button
          onClick={onRunCurrentFile}
          disabled={!activeFile}
          title={activeFile ? `Run ${activeFile}` : 'Select a file to run'}
          aria-label={activeFile ? `Run ${activeFile}` : 'Run File'}
          className="mobile-touch-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'var(--accent-color)',
            color: '#ffffff',
            fontWeight: 500,
            padding: '5px 10px',
            borderRadius: '5px',
            opacity: activeFile ? 1 : 0.5,
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          <Play size={12} fill="#ffffff" />
          <span className="hide-on-small">Run File</span>
        </button>

        {/* Compile Button */}
        <button
          onClick={onCompileCurrentFile}
          disabled={isCompiling}
          title="Compile C programs using GCC"
          aria-label="Compile C code"
          className="mobile-touch-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: '5px',
            fontSize: '11px',
            whiteSpace: 'nowrap'
          }}
        >
          <Cpu size={13} color="var(--text-secondary)" />
          <span className="hide-on-small">{isCompiling ? 'Compiling...' : 'Compile'}</span>
        </button>

        {/* Stop All */}
        {isRunningAny && (
          <button
            onClick={onStopAll}
            title="Stop all active running processes"
            aria-label="Stop all processes"
            className="mobile-touch-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '5px',
              fontSize: '11px',
              whiteSpace: 'nowrap'
            }}
          >
            <Square size={12} fill="#b91c1c" />
            <span className="hide-on-small">Stop All</span>
          </button>
        )}
      </div>

      {/* System info & UI utilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Compiler / Environment status */}
        <div className="hide-on-small" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-primary)',
          padding: '3px 6px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          whiteSpace: 'nowrap'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: systemHealth ? '#10b981' : '#f59e0b'
          }} />
          <span>GCC: {systemHealth?.gcc?.available ? 'Ready' : 'Checking'}</span>
        </div>

        {/* Terminal toggle */}
        <button
          onClick={onToggleTerminal}
          title="Toggle Terminal Panel"
          aria-label="Toggle Terminal Panel"
          style={{
            padding: '4px 7px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap'
          }}
        >
          <TerminalIcon size={13} />
          <span className="hide-on-small">Terminal</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle theme"
          style={{
            padding: '4px 6px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
        </button>
      </div>
    </header>
  );
};

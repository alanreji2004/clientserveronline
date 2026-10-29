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
      height: '46px',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      gap: '12px'
    }}>
      {/* Brand & Project Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            backgroundColor: 'var(--accent-color)',
            color: '#fff',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700
          }}>
            IDE
          </div>
          <span style={{ color: 'var(--text-primary)' }}>Online IDE</span>
        </div>

        <div style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Project Selector / Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FolderOpen size={15} color="var(--text-secondary)" />
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {project?.name || 'Loading Project...'}
          </span>
          <button
            onClick={onNewProjectModal}
            title="Create New Project"
            style={{
              padding: '3px 6px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              marginLeft: '4px'
            }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Templates Quick Load Dropdown */}
        <select
          value={project?.template || ''}
          onChange={(e) => onSelectTemplate(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '12px'
          }}
          title="Switch Template Project"
        >
          <option value="" disabled>Load Starter Template...</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Run Server & Client simultaneous button */}
        <button
          onClick={onRunBothServerAndClient}
          title="Concurrently launch both Server and Client in separate terminal panels"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <Layers size={14} />
          <span>Run Server & Client</span>
        </button>

        {/* Run Current File */}
        <button
          onClick={onRunCurrentFile}
          disabled={!activeFile}
          title={activeFile ? `Run ${activeFile}` : 'Select a file to run'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'var(--accent-color)',
            color: '#ffffff',
            fontWeight: 500,
            padding: '6px 12px',
            borderRadius: '5px',
            opacity: activeFile ? 1 : 0.5
          }}
        >
          <Play size={13} fill="#ffffff" />
          <span>Run File</span>
        </button>

        {/* Compile Button (active for C files or C projects) */}
        <button
          onClick={onCompileCurrentFile}
          disabled={isCompiling}
          title="Compile C programs using GCC"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontWeight: 500,
            padding: '5px 10px',
            borderRadius: '5px'
          }}
        >
          <Cpu size={14} color="var(--text-secondary)" />
          <span>{isCompiling ? 'Compiling...' : 'Compile GCC'}</span>
        </button>

        {/* Stop All */}
        {isRunningAny && (
          <button
            onClick={onStopAll}
            title="Stop all active running processes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              fontWeight: 500,
              padding: '5px 10px',
              borderRadius: '5px'
            }}
          >
            <Square size={13} fill="#b91c1c" />
            <span>Stop All</span>
          </button>
        )}
      </div>

      {/* System info & UI utilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Compiler / Environment status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-primary)',
          padding: '3px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)'
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
          style={{
            padding: '5px 8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <TerminalIcon size={14} />
          <span>Terminal</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            padding: '5px 8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </header>
  );
};

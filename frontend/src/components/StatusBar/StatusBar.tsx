import React from 'react';
import { Activity, Server, Radio, ShieldCheck } from 'lucide-react';
import type { Session, SystemHealth } from '../../types';

interface StatusBarProps {
  activeFile: string | null;
  session: Session | null;
  runningProcessesCount: number;
  isConnected: boolean;
  systemHealth: SystemHealth | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  session,
  runningProcessesCount,
  isConnected,
  systemHealth,
}) => {
  const getLanguageName = (path: string | null) => {
    if (!path) return 'Plain Text';
    if (path.endsWith('.py')) return 'Python 3';
    if (path.endsWith('.c')) return 'C (GCC)';
    if (path.endsWith('.h')) return 'C Header';
    if (path.endsWith('.md')) return 'Markdown';
    return 'Plain Text';
  };

  return (
    <footer style={{
      minHeight: '24px',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      userSelect: 'none',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      whiteSpace: 'nowrap',
      gap: '8px'
    }}>
      {/* Left side items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Radio size={12} color={isConnected ? '#10b981' : '#ef4444'} />
          <span className="hide-on-small">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Activity size={12} color={runningProcessesCount > 0 ? '#10b981' : 'var(--text-muted)'} />
          <span>Active: {runningProcessesCount}</span>
        </div>

        {session && (
          <div className="hide-on-small" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Server size={12} />
            <span>Session: {session.session_id}</span>
          </div>
        )}
      </div>

      {/* Right side items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div className="hide-on-small" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldCheck size={12} color="#10b981" />
          <span>{systemHealth?.execution_mode?.toUpperCase() || 'LOCAL'}</span>
        </div>

        <span className="hide-on-small">UTF-8</span>

        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {getLanguageName(activeFile)}
        </span>
      </div>
    </footer>
  );
};

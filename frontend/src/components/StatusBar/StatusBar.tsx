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
      height: '24px',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      userSelect: 'none'
    }}>
      {/* Left side items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Radio size={12} color={isConnected ? '#10b981' : '#ef4444'} />
          <span>{isConnected ? 'Stream Connected' : 'Stream Disconnected'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Activity size={12} color={runningProcessesCount > 0 ? '#10b981' : 'var(--text-muted)'} />
          <span>Active Processes: {runningProcessesCount}</span>
        </div>

        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Server size={12} />
            <span>Session: {session.session_id}</span>
          </div>
        )}
      </div>

      {/* Right side items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldCheck size={12} color="#10b981" />
          <span>Driver: {systemHealth?.execution_mode?.toUpperCase() || 'LOCAL'}</span>
        </div>

        <span>UTF-8</span>

        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {getLanguageName(activeFile)}
        </span>
      </div>
    </footer>
  );
};

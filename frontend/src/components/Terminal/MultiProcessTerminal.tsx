import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Square,
  RotateCw,
  Trash2,
  Columns,
  Cpu,
  Layers,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react';
import type { ProcessInfo, OutputEvent, CompileResult } from '../../types';

interface MultiProcessTerminalProps {
  processes: ProcessInfo[];
  outputs: Record<string, OutputEvent[]>; // processId -> events
  compileResult: CompileResult | null;
  activeTab: string; // 'overview' | 'compiler' | processId
  onSelectTab: (tabId: string) => void;
  onStopProcess: (processId: string) => void;
  onRestartProcess: (process: ProcessInfo) => void;
  onSendStdin: (processId: string, input: string) => void;
  onClearOutput: (processId: string) => void;
}

export const MultiProcessTerminal: React.FC<MultiProcessTerminalProps> = ({
  processes,
  outputs,
  compileResult,
  activeTab,
  onSelectTab,
  onStopProcess,
  onRestartProcess,
  onSendStdin,
  onClearOutput,
}) => {
  const [splitView, setSplitView] = useState(false);
  const [stdinInputs, setStdinInputs] = useState<Record<string, string>>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const splitScrollRefLeft = useRef<HTMLDivElement>(null);
  const splitScrollRefRight = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs, activeTab, autoScroll]);

  const handleStdinSubmit = (e: React.FormEvent, processId: string) => {
    e.preventDefault();
    const input = stdinInputs[processId] || '';
    if (!input.trim()) return;
    onSendStdin(processId, input);
    setStdinInputs((prev) => ({ ...prev, [processId]: '' }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="badge badge-running">● Running</span>;
      case 'exited':
        return <span className="badge badge-exited">Exited</span>;
      case 'stopped':
        return <span className="badge badge-stopped">Stopped</span>;
      case 'error':
        return <span className="badge badge-error">Failed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const renderStreamLine = (evt: OutputEvent, idx: number) => {
    let color = '#e6edf3';
    let prefix = '';

    if (evt.stream === 'stderr') {
      color = '#f87171'; // red
    } else if (evt.stream === 'system') {
      color = '#38bdf8'; // light blue system notices
    } else if (evt.stream === 'stdin') {
      color = '#34d399'; // green stdin
      prefix = '>> ';
    }

    return (
      <div key={idx} style={{ color, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {prefix}{evt.data}
      </div>
    );
  };

  const renderTerminalWindow = (proc: ProcessInfo, customRef?: React.RefObject<HTMLDivElement | null>) => {
    const procOutputs = outputs[proc.process_id] || [];
    const isRunning = proc.status === 'running';

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--terminal-border)' }}>
        {/* Terminal Title Bar */}
        <div style={{
          padding: '6px 12px',
          backgroundColor: '#161b22',
          borderBottom: '1px solid var(--terminal-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#e6edf3'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ fontWeight: 600 }}>{proc.name}</span>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>(PID: {proc.pid || 'N/A'})</span>
            {getStatusBadge(proc.status)}
            <span style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} /> {proc.runtime_seconds}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {isRunning ? (
              <button
                onClick={() => onStopProcess(proc.process_id)}
                title="Stop Process"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#7f1d1d',
                  color: '#fca5a5',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px'
                }}
              >
                <Square size={11} fill="#fca5a5" /> Stop
              </button>
            ) : (
              <button
                onClick={() => onRestartProcess(proc)}
                title="Restart Process"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#1e3a8a',
                  color: '#93c5fd',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px'
                }}
              >
                <RotateCw size={11} /> Restart
              </button>
            )}

            <button
              onClick={() => onClearOutput(proc.process_id)}
              title="Clear Terminal Output"
              style={{ color: '#8b949e', padding: '2px 4px' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Terminal Logs Body */}
        <div
          ref={customRef as any}
          style={{
            flex: 1,
            backgroundColor: 'var(--terminal-bg)',
            padding: '10px 14px',
            overflowY: 'auto',
          }}
        >
          {procOutputs.length === 0 ? (
            <div style={{ color: '#6e7681', fontStyle: 'italic', fontSize: '12px' }}>
              Waiting for process output...
            </div>
          ) : (
            procOutputs.map((evt, idx) => renderStreamLine(evt, idx))
          )}
        </div>

        {/* Interactive Stdin Bar */}
        <form
          onSubmit={(e) => handleStdinSubmit(e, proc.process_id)}
          style={{
            backgroundColor: '#161b22',
            borderTop: '1px solid var(--terminal-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            gap: '6px'
          }}
        >
          <span style={{ color: '#8b949e', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>&gt;</span>
          <input
            type="text"
            disabled={!isRunning}
            placeholder={isRunning ? "Type stdin and press Enter..." : "Process is not running (stdin disabled)"}
            value={stdinInputs[proc.process_id] || ''}
            onChange={(e) => setStdinInputs({ ...stdinInputs, [proc.process_id]: e.target.value })}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#e6edf3',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              padding: '4px'
            }}
          />
          <button
            type="submit"
            disabled={!isRunning || !stdinInputs[proc.process_id]?.trim()}
            style={{
              padding: '4px 8px',
              backgroundColor: isRunning ? 'var(--accent-color)' : '#30363d',
              color: '#fff',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              opacity: isRunning ? 1 : 0.4
            }}
          >
            <Send size={11} /> Send
          </button>
        </form>
      </div>
    );
  };

  // Find server and client processes for Split View
  const serverProc = processes.find((p) => p.name.toLowerCase().includes('server')) || processes[0];
  const clientProc = processes.find((p) => p.name.toLowerCase().includes('client')) || processes[1];

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0d1117',
      borderTop: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      {/* Top Tabs Bar */}
      <div style={{
        height: '35px',
        backgroundColor: '#161b22',
        borderBottom: '1px solid var(--terminal-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: '2px' }}>
          {/* Overview Tab */}
          <button
            onClick={() => { setSplitView(false); onSelectTab('overview'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '4px',
              color: !splitView && activeTab === 'overview' ? '#58a6ff' : '#8b949e',
              backgroundColor: !splitView && activeTab === 'overview' ? '#21262d' : 'transparent',
              fontSize: '12px',
              fontWeight: !splitView && activeTab === 'overview' ? 600 : 400
            }}
          >
            <Activity size={13} />
            <span>Process Monitor ({processes.length})</span>
          </button>

          {/* Compiler Tab */}
          <button
            onClick={() => { setSplitView(false); onSelectTab('compiler'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '4px',
              color: !splitView && activeTab === 'compiler' ? '#58a6ff' : '#8b949e',
              backgroundColor: !splitView && activeTab === 'compiler' ? '#21262d' : 'transparent',
              fontSize: '12px',
              fontWeight: !splitView && activeTab === 'compiler' ? 600 : 400
            }}
          >
            <Cpu size={13} />
            <span>GCC Compiler</span>
            {compileResult && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: compileResult.success ? '#10b981' : '#ef4444'
              }} />
            )}
          </button>

          {/* Per-Process Individual Tabs */}
          {processes.map((proc) => {
            const isTabActive = !splitView && activeTab === proc.process_id;
            return (
              <button
                key={proc.process_id}
                onClick={() => { setSplitView(false); onSelectTab(proc.process_id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  color: isTabActive ? '#58a6ff' : '#8b949e',
                  backgroundColor: isTabActive ? '#21262d' : 'transparent',
                  fontSize: '12px',
                  fontWeight: isTabActive ? 600 : 400
                }}
              >
                <TerminalIcon size={13} />
                <span>{proc.name}</span>
                {proc.status === 'running' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* View toggles & Utilities */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Side-by-Side Dual Split View Button */}
          {processes.length >= 2 && (
            <button
              onClick={() => setSplitView(!splitView)}
              title="Toggle Side-by-Side Split View for Server and Client"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: splitView ? '#1f6feb' : '#21262d',
                color: '#e6edf3',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              <Columns size={12} />
              <span>Split View (Server & Client)</span>
            </button>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              fontSize: '11px',
              color: autoScroll ? '#58a6ff' : '#8b949e',
              padding: '2px 6px'
            }}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {splitView && serverProc && clientProc ? (
          // Side-by-side Dual Split View: Server on left, Client on right
          <div style={{ flex: 1, display: 'flex', height: '100%', width: '100%' }}>
            {renderTerminalWindow(serverProc, splitScrollRefLeft)}
            {renderTerminalWindow(clientProc, splitScrollRefRight)}
          </div>
        ) : activeTab === 'overview' ? (
          // Overview Process Monitor Table
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', backgroundColor: '#0d1117', color: '#e6edf3' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#58a6ff" /> Active Process Supervisor
            </h3>

            {processes.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: '12px' }}>
                No active or previous processes launched in this session. Run a file or click <strong>Run Server & Client</strong> above.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363d', textAlign: 'left', color: '#8b949e' }}>
                    <th style={{ padding: '8px' }}>Process Name</th>
                    <th style={{ padding: '8px' }}>Command</th>
                    <th style={{ padding: '8px' }}>PID</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Exit Code</th>
                    <th style={{ padding: '8px' }}>Runtime</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p) => (
                    <tr key={p.process_id} style={{ borderBottom: '1px solid #21262d' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#8b949e' }}>{p.command.join(' ')}</td>
                      <td style={{ padding: '8px' }}>{p.pid || '—'}</td>
                      <td style={{ padding: '8px' }}>{getStatusBadge(p.status)}</td>
                      <td style={{ padding: '8px' }}>{p.exit_code !== null ? p.exit_code : '—'}</td>
                      <td style={{ padding: '8px' }}>{p.runtime_seconds}s</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {p.status === 'running' ? (
                          <button
                            onClick={() => onStopProcess(p.process_id)}
                            style={{
                              backgroundColor: '#7f1d1d',
                              color: '#fca5a5',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              marginRight: '6px'
                            }}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => onRestartProcess(p)}
                            style={{
                              backgroundColor: '#1e3a8a',
                              color: '#93c5fd',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              marginRight: '6px'
                            }}
                          >
                            Restart
                          </button>
                        )}
                        <button
                          onClick={() => { setSplitView(false); onSelectTab(p.process_id); }}
                          style={{
                            backgroundColor: '#21262d',
                            color: '#c9d1d9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : activeTab === 'compiler' ? (
          // GCC Compiler Output View
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', backgroundColor: '#0d1117', color: '#e6edf3' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} color="#58a6ff" /> GCC Compiler Diagnostics
              </h3>
              {compileResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span>Duration: {compileResult.duration_ms}ms</span>
                  {compileResult.success ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Compilation Succeeded ({compileResult.output_binary})
                    </span>
                  ) : (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} /> Compilation Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            {!compileResult ? (
              <div style={{ color: '#8b949e', fontSize: '12px' }}>
                No compilation has been performed yet. Click <strong>Compile GCC</strong> above to build C source files.
              </div>
            ) : (
              <div>
                {compileResult.stderr && (
                  <pre style={{
                    backgroundColor: '#161b22',
                    padding: '12px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: compileResult.success ? '#e6edf3' : '#f87171',
                    whiteSpace: 'pre-wrap',
                    marginBottom: '14px',
                    border: '1px solid #30363d'
                  }}>
                    {compileResult.stderr}
                  </pre>
                )}

                {compileResult.diagnostics.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Parsed Diagnostics:</h4>
                    {compileResult.diagnostics.map((diag, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '6px 10px',
                          marginBottom: '4px',
                          backgroundColor: diag.severity === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          borderLeft: `3px solid ${diag.severity === 'error' ? '#ef4444' : '#f59e0b'}`,
                          fontSize: '12px'
                        }}
                      >
                        <strong>{diag.file}:{diag.line}:{diag.column}</strong> [{diag.severity.toUpperCase()}]: {diag.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Specific Process Selected
          (() => {
            const proc = processes.find((p) => p.process_id === activeTab);
            if (!proc) {
              return (
                <div style={{ padding: '16px', color: '#8b949e' }}>
                  Process not found or closed.
                </div>
              );
            }
            return renderTerminalWindow(proc, scrollRef);
          })()
        )}
      </div>
    </div>
  );
};

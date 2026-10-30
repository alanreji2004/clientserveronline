import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header/Header';
import { FileExplorer } from './components/Sidebar/FileExplorer';
import { CodeEditor } from './components/Editor/CodeEditor';
import { MultiProcessTerminal } from './components/Terminal/MultiProcessTerminal';
import { StatusBar } from './components/StatusBar/StatusBar';
import { NewProjectModal } from './components/Modal/NewProjectModal';
import { api } from './services/api';
import { ExecutionWebSocket } from './services/websocket';
import { FolderOpen, Code, Terminal as TerminalIcon } from 'lucide-react';
import type {
  Project,
  ProjectTemplateInfo,
  Session,
  ProcessInfo,
  OutputEvent,
  CompileResult,
  SystemHealth
} from './types';

export const App: React.FC = () => {
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ide-theme') as 'light' | 'dark') || 'light';
  });

  // Project & Files State
  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplateInfo[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

  // Execution & Session State
  const [session, setSession] = useState<Session | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [outputs, setOutputs] = useState<Record<string, OutputEvent[]>>({});
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isStartingProject, setIsStartingProject] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Responsive Layout & Mobile Mode: 'files' | 'editor' | 'terminal'
  const [mobileView, setMobileView] = useState<'files' | 'editor' | 'terminal'>('editor');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  // Terminal Layout State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [activeTerminalTab, setActiveTerminalTab] = useState<string>('overview');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const wsRef = useRef<ExecutionWebSocket | null>(null);
  const isDraggingTerminalRef = useRef(false);
  const currentRunIdRef = useRef<string>('');
  const isStartingProjectRef = useRef<boolean>(false);

  // Window resize listener to track mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ide-theme', theme);
  }, [theme]);

  // Initial Data Fetch
  useEffect(() => {
    const initApp = async () => {
      try {
        const [health, tpls, projList] = await Promise.all([
          api.getSystemHealth(),
          api.getTemplates(),
          api.listProjects(),
        ]);
        setSystemHealth(health);
        setTemplates(tpls);

        let activeProj: Project;
        if (projList.length > 0) {
          activeProj = await api.getProject(projList[0].id);
        } else {
          // Default starter project
          activeProj = await api.createProject('Python Socket Demo', 'Concurrent TCP Server & Client Demo', 'python-sockets');
        }
        await loadProject(activeProj);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initApp();
  }, []);

  // Load a project and create an active execution session
  const loadProject = async (proj: Project) => {
    setProject(proj);
    setOpenTabs([]);
    setFileContents({});
    setDirtyFiles(new Set());
    setProcesses([]);
    setOutputs({});
    setCompileResult(null);

    // Pick initial file to open
    const initialFile = proj.files.find((f) => !f.is_directory && (f.name.includes('server') || f.name.includes('main')))
      || proj.files.find((f) => !f.is_directory);

    if (initialFile) {
      setOpenTabs([initialFile.path]);
      setActiveFile(initialFile.path);
      try {
        const content = await api.getFile(proj.id, initialFile.path);
        setFileContents({ [initialFile.path]: content.content });
      } catch (e) {
        console.error('Failed to load initial file:', e);
      }
    }

    // Initialize Execution Session
    try {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      const newSession = await api.createSession(proj.id);
      setSession(newSession);

      // Connect WebSocket
      const ws = new ExecutionWebSocket(newSession.session_id);
      wsRef.current = ws;

      ws.subscribe((msg: any) => {
        if (msg.type === 'connected') {
          setIsConnected(true);
        } else if (msg.type === 'output') {
          const event = msg as OutputEvent;
          // Stale event filtering: ignore events from superseded runs
          if (event.run_id && currentRunIdRef.current && event.run_id !== currentRunIdRef.current) {
            return;
          }
          setOutputs((prev) => ({
            ...prev,
            [event.process_id]: [...(prev[event.process_id] || []), event],
          }));
        } else if (msg.type === 'status_change') {
          if (msg.run_id && currentRunIdRef.current && msg.run_id !== currentRunIdRef.current) {
            return;
          }
          setProcesses((prev) =>
            prev.map((p) =>
              p.process_id === msg.process_id
                ? { ...p, status: msg.status, exit_code: msg.exit_code, runtime_seconds: msg.runtime_seconds }
                : p
            )
          );
        } else if (msg.type === 'process_deleted') {
          const pid = msg.process_id;
          setProcesses((prev) => prev.filter((p) => p.process_id !== pid));
          setOutputs((prev) => {
            const next = { ...prev };
            delete next[pid];
            return next;
          });
          setActiveTerminalTab((curr) => (curr === pid ? 'overview' : curr));
        } else if (msg.type === 'compile_result') {
          setCompileResult(msg as CompileResult);
        }
      });

      ws.connect();
    } catch (err) {
      console.error('Failed to initialize session:', err);
    }
  };

  // Re-establish session if expired or not set
  const ensureActiveSession = async (): Promise<Session | null> => {
    if (!project) return null;
    if (session) {
      try {
        const check = await api.getSession(session.session_id);
        if (check && check.status === 'active') return session;
      } catch {
        // Session expired or needs recreation
      }
    }
    try {
      const newSession = await api.createSession(project.id);
      setSession(newSession);
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      const ws = new ExecutionWebSocket(newSession.session_id);
      wsRef.current = ws;
      ws.subscribe((msg: any) => {
        if (msg.type === 'connected') {
          setIsConnected(true);
        } else if (msg.type === 'output') {
          const event = msg as OutputEvent;
          if (event.run_id && currentRunIdRef.current && event.run_id !== currentRunIdRef.current) {
            return;
          }
          setOutputs((prev) => ({
            ...prev,
            [event.process_id]: [...(prev[event.process_id] || []), event],
          }));
        } else if (msg.type === 'status_change') {
          if (msg.run_id && currentRunIdRef.current && msg.run_id !== currentRunIdRef.current) {
            return;
          }
          setProcesses((prev) =>
            prev.map((p) =>
              p.process_id === msg.process_id
                ? { ...p, status: msg.status, exit_code: msg.exit_code, runtime_seconds: msg.runtime_seconds }
                : p
            )
          );
        } else if (msg.type === 'process_deleted') {
          const pid = msg.process_id;
          setProcesses((prev) => prev.filter((p) => p.process_id !== pid));
          setOutputs((prev) => {
            const next = { ...prev };
            delete next[pid];
            return next;
          });
          setActiveTerminalTab((curr) => (curr === pid ? 'overview' : curr));
        } else if (msg.type === 'compile_result') {
          setCompileResult(msg as CompileResult);
        }
      });
      ws.connect();
      return newSession;
    } catch (err) {
      console.error('Failed to ensure active session:', err);
      return null;
    }
  };

  // Switch Starter Template
  const handleSelectTemplate = async (templateId: string) => {
    try {
      const templateInfo = templates.find((t) => t.id === templateId);
      const name = templateInfo ? templateInfo.name : 'New Project';
      const newProj = await api.createProject(name, '', templateId);
      await loadProject(newProj);
    } catch (e) {
      alert(`Failed to switch template: ${e}`);
    }
  };

  // File Operations
  const handleSelectFile = async (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs([...openTabs, path]);
    }
    setActiveFile(path);

    if (fileContents[path] === undefined && project) {
      try {
        const fileData = await api.getFile(project.id, path);
        setFileContents((prev) => ({ ...prev, [path]: fileData.content }));
      } catch (e) {
        console.error('Failed to load file content:', e);
      }
    }

    // On mobile, selecting a file automatically opens the editor view
    if (isMobile) {
      setMobileView('editor');
    }
  };

  const handleCloseTab = (path: string) => {
    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    if (activeFile === path) {
      setActiveFile(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null);
    }
  };

  const handleChangeContent = (path: string, newContent: string) => {
    setFileContents((prev) => ({ ...prev, [path]: newContent }));
    setDirtyFiles((prev) => new Set(prev).add(path));
  };

  const handleSaveFile = async (path: string) => {
    if (!project || fileContents[path] === undefined) return;
    try {
      await api.updateFile(project.id, path, fileContents[path]);
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      if (session) {
        await api.syncSession(session.session_id);
      }
    } catch (e) {
      alert(`Failed to save ${path}: ${e}`);
    }
  };

  const handleCreateFile = async (path: string, isDirectory: boolean) => {
    if (!project) return;
    try {
      await api.createFile(project.id, path, '', isDirectory);
      const updatedProj = await api.getProject(project.id);
      setProject(updatedProj);
      if (!isDirectory) {
        await handleSelectFile(path);
      }
    } catch (e) {
      alert(`Error creating file: ${e}`);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!project) return;
    try {
      await api.deleteFile(project.id, path);
      handleCloseTab(path);
      const updatedProj = await api.getProject(project.id);
      setProject(updatedProj);
    } catch (e) {
      alert(`Error deleting file: ${e}`);
    }
  };

  // Compile Action
  const handleCompile = async (): Promise<CompileResult | null> => {
    if (!project) return null;
    const currentSession = await ensureActiveSession();
    if (!currentSession) return null;

    setIsCompiling(true);
    setIsTerminalOpen(true);
    setActiveTerminalTab('compiler');
    if (isMobile) {
      setMobileView('terminal');
    }

    // Save any unsaved dirty files first
    for (const dirtyPath of Array.from(dirtyFiles)) {
      await handleSaveFile(dirtyPath);
    }

    try {
      let sourceFile = 'server.c';
      if (activeFile && (activeFile.endsWith('.c') || activeFile.endsWith('.h'))) {
        sourceFile = activeFile.endsWith('.h') ? 'server.c' : activeFile;
      }

      const outBinary = sourceFile.replace(/\.c$/, '');
      const res = await api.compile(currentSession.session_id, [sourceFile], outBinary);
      setCompileResult(res);
      return res;
    } catch (e: any) {
      alert(`Compilation failed: ${e.message}`);
      return null;
    } finally {
      setIsCompiling(false);
    }
  };

  // Run Single File Action
  const handleRunCurrentFile = async () => {
    if (!project || !activeFile) return;
    if (isStartingProjectRef.current) return; // Prevent race conditions

    const currentSession = await ensureActiveSession();
    if (!currentSession) return;

    // Save file if dirty
    if (dirtyFiles.has(activeFile)) {
      await handleSaveFile(activeFile);
    }

    setIsTerminalOpen(true);
    if (isMobile) {
      setMobileView('terminal');
    }

    const runId = Math.random().toString(36).substring(2, 10);
    currentRunIdRef.current = runId;

    try {
      if (activeFile.endsWith('.py')) {
        const proc = await api.launchProcess(
          currentSession.session_id,
          activeFile,
          'python',
          activeFile,
          [],
          runId
        );
        setProcesses((prev) => [...prev.filter((p) => p.process_id !== proc.process_id), proc]);
        setActiveTerminalTab(proc.process_id);
      } else if (activeFile.endsWith('.c')) {
        const compileRes = await handleCompile();
        if (compileRes && compileRes.success && compileRes.output_binary) {
          const proc = await api.launchProcess(
            currentSession.session_id,
            activeFile.replace(/\.c$/, ''),
            'binary',
            compileRes.output_binary,
            [],
            runId
          );
          setProcesses((prev) => [...prev.filter((p) => p.process_id !== proc.process_id), proc]);
          setActiveTerminalTab(proc.process_id);
        }
      }
    } catch (e: any) {
      alert(`Execution error: ${e.message}`);
    }
  };

  // Centralized Execution Lifecycle: Run Project
  // Stops all previously running projects and files, cleans ports, and launches fresh.
  const handleRunBothServerAndClient = async () => {
    if (!project) return;
    if (isStartingProjectRef.current) return; // Prevent concurrent Run clicks

    isStartingProjectRef.current = true;
    setIsStartingProject(true);

    try {
      // 1. Centralized execution lifecycle manager: Stop all previously running programs across sessions
      await api.stopAllActiveExecution();

      const currentSession = await ensureActiveSession();
      if (!currentSession) return;

      // 2. Generate unique Run ID to prevent race conditions and ignore stale output
      const runId = Math.random().toString(36).substring(2, 10);
      currentRunIdRef.current = runId;

      // 3. Clear old processes and outputs from UI for the fresh run
      setProcesses([]);
      setOutputs({});

      // 4. Save all dirty files & sync workspace
      for (const dirtyPath of Array.from(dirtyFiles)) {
        await handleSaveFile(dirtyPath);
      }
      await api.syncSession(currentSession.session_id);

      setIsTerminalOpen(true);
      if (isMobile) {
        setMobileView('terminal');
      }

      const isCProject = project.files.some((f) => f.name === 'server.c' && !f.is_directory);
      const isPythonProject = project.files.some((f) => f.name === 'server.py' && !f.is_directory);

      if (isPythonProject) {
        // 5a. Launch Python Server
        const serverProc = await api.launchProcess(
          currentSession.session_id,
          'Python Server',
          'python',
          'server.py',
          [],
          runId
        );
        setProcesses([serverProc]);
        setActiveTerminalTab(serverProc.process_id);

        // Small delay to allow server socket to bind before client connects
        setTimeout(async () => {
          try {
            // Verify run hasn't been superseded
            if (currentRunIdRef.current !== runId) return;

            // 5b. Launch Python Client concurrently inside the same session (does NOT stop server!)
            const clientProc = await api.launchProcess(
              currentSession.session_id,
              'Python Client',
              'python',
              'client.py',
              [],
              runId
            );
            setProcesses((prev) => [...prev.filter((p) => p.process_id !== clientProc.process_id), clientProc]);
          } catch (err: any) {
            console.error('Failed to launch client:', err);
          }
        }, 800);

      } else if (isCProject) {
        // 6a. Compile server.c
        setActiveTerminalTab('compiler');
        const srvCompile = await api.compile(currentSession.session_id, ['server.c'], 'c_server');
        if (!srvCompile.success) {
          alert('Failed to compile server.c. See GCC compiler tab.');
          return;
        }

        // 6b. Compile client.c
        const cliCompile = await api.compile(currentSession.session_id, ['client.c'], 'c_client');
        if (!cliCompile.success) {
          alert('Failed to compile client.c. See GCC compiler tab.');
          return;
        }

        // Verify run hasn't been superseded
        if (currentRunIdRef.current !== runId) return;

        // 6c. Launch Server Binary
        const serverProc = await api.launchProcess(
          currentSession.session_id,
          'C Server',
          'binary',
          srvCompile.output_binary!,
          [],
          runId
        );
        setProcesses([serverProc]);
        setActiveTerminalTab(serverProc.process_id);

        // 6d. Launch Client Binary concurrently inside same session
        setTimeout(async () => {
          try {
            if (currentRunIdRef.current !== runId) return;
            const clientProc = await api.launchProcess(
              currentSession.session_id,
              'C Client',
              'binary',
              cliCompile.output_binary!,
              [],
              runId
            );
            setProcesses((prev) => [...prev.filter((p) => p.process_id !== clientProc.process_id), clientProc]);
          } catch (err: any) {
            console.error('Failed to launch C client:', err);
          }
        }, 800);
      } else {
        // Fallback for general projects: run active file or main file
        const mainFile = project.files.find((f) => f.name.includes('main') || f.name.endsWith('.py') || f.name.endsWith('.c'));
        if (mainFile) {
          await handleRunCurrentFile();
        }
      }
    } catch (e: any) {
      alert(`Launch error: ${e.message}`);
    } finally {
      isStartingProjectRef.current = false;
      setIsStartingProject(false);
    }
  };

  // Process Controls: Stop Process
  const handleStopProcess = async (processId: string) => {
    if (!session) return;
    try {
      await api.stopProcess(session.session_id, processId);
      setProcesses((prev) =>
        prev.map((p) => (p.process_id === processId ? { ...p, status: 'stopped' } : p))
      );
    } catch (e) {
      console.error('Failed to stop process:', e);
    }
  };

  // Terminal Controls: Delete / Close Terminal
  const handleDeleteProcess = async (processId: string) => {
    if (!session) return;
    try {
      await api.deleteProcess(session.session_id, processId);
      setProcesses((prev) => prev.filter((p) => p.process_id !== processId));
      setOutputs((prev) => {
        const next = { ...prev };
        delete next[processId];
        return next;
      });
      setActiveTerminalTab((curr) => {
        if (curr === processId) {
          const remaining = processes.filter((p) => p.process_id !== processId);
          return remaining.length > 0 ? remaining[0].process_id : 'overview';
        }
        return curr;
      });
    } catch (e) {
      console.error('Failed to delete terminal:', e);
    }
  };

  const handleRestartProcess = async (proc: ProcessInfo) => {
    if (!session) return;
    try {
      const isPython = proc.command[0].includes('python');
      const entry = isPython ? proc.command[2] || proc.name : proc.name;
      const newProc = await api.launchProcess(
        session.session_id,
        proc.name,
        isPython ? 'python' : 'binary',
        entry,
        [],
        currentRunIdRef.current
      );
      setProcesses((prev) => [...prev.filter((p) => p.process_id !== newProc.process_id), newProc]);
      setActiveTerminalTab(newProc.process_id);
    } catch (e: any) {
      alert(`Failed to restart process: ${e.message}`);
    }
  };

  // Stop All Processes in Current Session
  const handleStopAll = async () => {
    if (!session) return;
    try {
      await api.stopAllSessionProcesses(session.session_id);
      setProcesses((prev) => prev.map((p) => ({ ...p, status: 'stopped' })));
    } catch (e) {
      console.error('Failed to stop all processes:', e);
    }
  };

  const handleSendStdin = async (processId: string, input: string) => {
    if (!session) return;
    if (wsRef.current) {
      wsRef.current.sendStdin(processId, input);
    } else {
      await api.sendStdin(session.session_id, processId, input);
    }
  };

  const handleClearOutput = (processId: string) => {
    setOutputs((prev) => ({ ...prev, [processId]: [] }));
  };

  // Terminal Resize Dragging (Desktop)
  const handleMouseDownResize = () => {
    isDraggingTerminalRef.current = true;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTerminalRef.current) {
        const newHeight = window.innerHeight - e.clientY - 24; // 24 is status bar height
        if (newHeight >= 120 && newHeight <= window.innerHeight * 0.75) {
          setTerminalHeight(newHeight);
        }
      }
    };
    const handleMouseUp = () => {
      isDraggingTerminalRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const runningProcessesCount = processes.filter((p) => p.status === 'running').length;

  return (
    <div style={{ height: '100vh', width: '100vw', maxWidth: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Header */}
      <Header
        project={project}
        templates={templates}
        activeFile={activeFile}
        isRunningAny={runningProcessesCount > 0}
        isCompiling={isCompiling || isStartingProject}
        theme={theme}
        systemHealth={systemHealth}
        onRunCurrentFile={handleRunCurrentFile}
        onCompileCurrentFile={handleCompile}
        onRunBothServerAndClient={handleRunBothServerAndClient}
        onStopAll={handleStopAll}
        onToggleTerminal={() => {
          if (isMobile) {
            setMobileView(mobileView === 'terminal' ? 'editor' : 'terminal');
          } else {
            setIsTerminalOpen(!isTerminalOpen);
          }
        }}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onSelectTemplate={handleSelectTemplate}
        onNewProjectModal={() => setIsNewProjectModalOpen(true)}
      />

      {/* Mobile Mode Switcher Bar (Visible on mobile <= 768px) */}
      {isMobile && (
        <div style={{
          height: '38px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setMobileView('files')}
            style={{
              flex: 1,
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '4px',
              backgroundColor: mobileView === 'files' ? 'var(--bg-primary)' : 'transparent',
              color: mobileView === 'files' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: mobileView === 'files' ? 600 : 400,
              fontSize: '12px'
            }}
          >
            <FolderOpen size={13} /> Files ({project?.files.length || 0})
          </button>
          <button
            onClick={() => setMobileView('editor')}
            style={{
              flex: 1,
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '4px',
              backgroundColor: mobileView === 'editor' ? 'var(--bg-primary)' : 'transparent',
              color: mobileView === 'editor' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: mobileView === 'editor' ? 600 : 400,
              fontSize: '12px'
            }}
          >
            <Code size={13} /> Editor
          </button>
          <button
            onClick={() => setMobileView('terminal')}
            style={{
              flex: 1,
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '4px',
              backgroundColor: mobileView === 'terminal' ? 'var(--bg-primary)' : 'transparent',
              color: mobileView === 'terminal' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: mobileView === 'terminal' ? 600 : 400,
              fontSize: '12px'
            }}
          >
            <TerminalIcon size={13} /> Terminal ({processes.length})
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      {isMobile ? (
        // Mobile View: Displays selected pane full width/height
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {mobileView === 'files' && (
            <FileExplorer
              files={project?.files || []}
              activeFile={activeFile}
              dirtyFiles={dirtyFiles}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
            />
          )}

          {mobileView === 'editor' && (
            <CodeEditor
              openTabs={openTabs}
              activeFile={activeFile}
              fileContents={fileContents}
              dirtyFiles={dirtyFiles}
              diagnostics={compileResult?.diagnostics || []}
              theme={theme}
              onSelectTab={(path) => setActiveFile(path)}
              onCloseTab={handleCloseTab}
              onChangeContent={handleChangeContent}
              onSave={handleSaveFile}
            />
          )}

          {mobileView === 'terminal' && (
            <MultiProcessTerminal
              processes={processes}
              outputs={outputs}
              compileResult={compileResult}
              activeTab={activeTerminalTab}
              onSelectTab={setActiveTerminalTab}
              onStopProcess={handleStopProcess}
              onDeleteProcess={handleDeleteProcess}
              onRestartProcess={handleRestartProcess}
              onSendStdin={handleSendStdin}
              onClearOutput={handleClearOutput}
              onRunCurrentFile={handleRunCurrentFile}
              onRunBothServerAndClient={handleRunBothServerAndClient}
            />
          )}
        </div>
      ) : (
        // Desktop / Tablet Layout: Sidebar + Editor, Resizable Terminal below
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <FileExplorer
              files={project?.files || []}
              activeFile={activeFile}
              dirtyFiles={dirtyFiles}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
            />

            <CodeEditor
              openTabs={openTabs}
              activeFile={activeFile}
              fileContents={fileContents}
              dirtyFiles={dirtyFiles}
              diagnostics={compileResult?.diagnostics || []}
              theme={theme}
              onSelectTab={(path) => setActiveFile(path)}
              onCloseTab={handleCloseTab}
              onChangeContent={handleChangeContent}
              onSave={handleSaveFile}
            />
          </div>

          {/* Resizable Terminal Handle */}
          {isTerminalOpen && (
            <div
              onMouseDown={handleMouseDownResize}
              style={{
                height: '4px',
                backgroundColor: 'var(--border-color)',
                cursor: 'row-resize',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-color)')}
            />
          )}

          {/* Multi-Process Terminal Panel */}
          {isTerminalOpen && (
            <div style={{ height: `${terminalHeight}px`, minHeight: '120px', flexShrink: 0 }}>
              <MultiProcessTerminal
                processes={processes}
                outputs={outputs}
                compileResult={compileResult}
                activeTab={activeTerminalTab}
                onSelectTab={setActiveTerminalTab}
                onStopProcess={handleStopProcess}
                onDeleteProcess={handleDeleteProcess}
                onRestartProcess={handleRestartProcess}
                onSendStdin={handleSendStdin}
                onClearOutput={handleClearOutput}
                onRunCurrentFile={handleRunCurrentFile}
                onRunBothServerAndClient={handleRunBothServerAndClient}
              />
            </div>
          )}
        </div>
      )}

      {/* Bottom Status Bar */}
      <StatusBar
        activeFile={activeFile}
        session={session}
        runningProcessesCount={runningProcessesCount}
        isConnected={isConnected}
        systemHealth={systemHealth}
      />

      {/* Create Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        templates={templates}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={async (name, desc, template) => {
          try {
            const newProj = await api.createProject(name, desc, template);
            await loadProject(newProj);
          } catch (e) {
            alert(`Failed to create project: ${e}`);
          }
        }}
      />
    </div>
  );
};

export default App;

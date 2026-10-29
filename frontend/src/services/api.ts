import type { Project, FileContent, ProjectTemplateInfo, Session, ProcessInfo, CompileResult, SystemHealth } from '../types';

function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:8000/api';
}

const API_BASE = getApiBase();

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const err = await res.json();
      errorDetail = err.detail || err.message || JSON.stringify(err);
    } catch {
      // fallback to statusText
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // System
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`);
    return handleResponse<SystemHealth>(res);
  },

  // Projects
  async listProjects(): Promise<{ id: string; name: string; description: string; template?: string; updated_at?: string }[]> {
    const res = await fetch(`${API_BASE}/projects`);
    return handleResponse(res);
  },

  async getTemplates(): Promise<ProjectTemplateInfo[]> {
    const res = await fetch(`${API_BASE}/projects/templates`);
    return handleResponse<ProjectTemplateInfo[]>(res);
  },

  async createProject(name: string, description: string = '', template: string = 'python-sockets'): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, template }),
    });
    return handleResponse<Project>(res);
  },

  async getProject(projectId: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`);
    return handleResponse<Project>(res);
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Files
  async getFile(projectId: string, path: string): Promise<FileContent> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`);
    return handleResponse<FileContent>(res);
  },

  async createFile(projectId: string, path: string, content: string = '', isDirectory: boolean = false): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, is_directory: isDirectory }),
    });
    return handleResponse(res);
  },

  async updateFile(projectId: string, path: string, content: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return handleResponse(res);
  },

  async deleteFile(projectId: string, path: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Sessions & Execution
  async createSession(projectId: string): Promise<Session> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    return handleResponse<Session>(res);
  },

  async getSession(sessionId: string): Promise<Session> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
    return handleResponse<Session>(res);
  },

  async syncSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/sync`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async compile(
    sessionId: string,
    sourceFiles: string[],
    outputBinary: string,
    compilerFlags: string[] = ['-Wall', '-Wextra', '-O0', '-g']
  ): Promise<CompileResult> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_files: sourceFiles,
        output_binary: outputBinary,
        compiler_flags: compilerFlags,
      }),
    });
    return handleResponse<CompileResult>(res);
  },

  async launchProcess(
    sessionId: string,
    name: string,
    commandType: 'python' | 'binary' | 'custom',
    entryPoint: string,
    args: string[] = []
  ): Promise<ProcessInfo> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/processes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        command_type: commandType,
        entry_point: entryPoint,
        args,
      }),
    });
    return handleResponse<ProcessInfo>(res);
  },

  async listProcesses(sessionId: string): Promise<ProcessInfo[]> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/processes`);
    return handleResponse<ProcessInfo[]>(res);
  },

  async getProcessHistory(sessionId: string, processId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/processes/${encodeURIComponent(processId)}/history`);
    return handleResponse(res);
  },

  async sendStdin(sessionId: string, processId: string, text: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/processes/${encodeURIComponent(processId)}/stdin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_text: text }),
    });
    return handleResponse(res);
  },

  async stopProcess(sessionId: string, processId: string): Promise<ProcessInfo> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/processes/${encodeURIComponent(processId)}/stop`, {
      method: 'POST',
    });
    return handleResponse<ProcessInfo>(res);
  },

  async stopSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
    });
    return handleResponse(res);
  },
};

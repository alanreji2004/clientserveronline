export interface FileItem {
  path: string;
  name: string;
  is_directory: boolean;
  size: number;
  modified_at?: string;
}

export interface FileContent {
  path: string;
  content: string;
  is_directory: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  template?: string;
  created_at: string;
  updated_at: string;
  files: FileItem[];
}

export interface ProjectTemplateInfo {
  id: string;
  name: string;
  description: string;
  language: string;
  files: string[];
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
}

export interface CompileResult {
  success: boolean;
  output_binary?: string;
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
  duration_ms: number;
}

export type ProcessStatus = 'starting' | 'running' | 'stopped' | 'exited' | 'error';

export interface ProcessInfo {
  process_id: string;
  session_id: string;
  name: string;
  command: string[];
  pid?: number;
  status: ProcessStatus;
  exit_code?: number | null;
  started_at: string;
  ended_at?: string | null;
  runtime_seconds: number;
  output_line_count: number;
  run_id?: string;
}

export interface OutputEvent {
  type: 'output';
  process_id: string;
  session_id: string;
  stream: 'stdout' | 'stderr' | 'system' | 'stdin';
  data: string;
  timestamp: string;
  run_id?: string;
}

export interface StatusChangeEvent {
  type: 'status_change';
  process_id: string;
  session_id: string;
  name: string;
  status: ProcessStatus;
  exit_code?: number | null;
  runtime_seconds: number;
  run_id?: string;
}

export interface ProcessDeletedEvent {
  type: 'process_deleted';
  process_id: string;
  session_id: string;
  timestamp?: string;
}

export interface Session {
  session_id: string;
  project_id: string;
  status: 'active' | 'terminated';
  execution_mode: string;
  created_at: string;
  active_processes: ProcessInfo[];
}

export interface SystemHealth {
  status: string;
  app_name: string;
  app_version: string;
  platform: string;
  python_version: string;
  gcc: {
    available: boolean;
    version?: string;
  };
  docker: {
    available: boolean;
    status?: string;
  };
  execution_mode: string;
  limits: {
    max_processes_per_session: number;
    default_timeout_seconds: number;
    max_file_size_bytes: number;
  };
}


export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'unknown';

export type ProjectType =
  | 'web'
  | 'api'
  | 'cli'
  | 'library'
  | 'desktop'
  | 'mobile'
  | 'other';

export type AIAssistant =
  | 'claude-code'
  | 'copilot'
  | 'gemini'
  | 'antigravity'
  | 'codex';

export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'cargo'
  | 'go'
  | 'unknown';

export interface DetectedProject {
  name: string;
  language: Language;
  hasExistingConfig: boolean;
}

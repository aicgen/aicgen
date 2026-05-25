export type Language =
    | 'typescript'
    | 'javascript'
    | 'python'
    | 'go'
    | 'rust'
    | 'java'
    | 'csharp'
    | 'ruby'
    | 'dart'
    | 'swift'
    | 'kotlin'
    | 'php'
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
    | 'pub'
    | 'composer'
    | 'unknown';

export interface DetectedProject {
    name: string;
    language: Language;
    hasExistingConfig: boolean;
}

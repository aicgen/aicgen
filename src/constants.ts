import { AIAssistant, Language, ProjectType } from './models/project.js';
import { ArchitectureType, DatasourceType } from './models/profile.js';

export const LANGUAGES: { value: Language; name: string }[] = [
  { value: 'typescript', name: 'TypeScript' },
  { value: 'javascript', name: 'JavaScript' },
  { value: 'python', name: 'Python' },
  { value: 'go', name: 'Go' },
  { value: 'rust', name: 'Rust' },
  { value: 'java', name: 'Java' },
  { value: 'csharp', name: 'C#' },
  { value: 'ruby', name: 'Ruby' },
  { value: 'dart', name: 'Dart' }
];

export const PROJECT_TYPES: { value: ProjectType; name: string; description: string }[] = [
  { value: 'web', name: 'Web Application', description: 'Frontend or full-stack web app' },
  { value: 'api', name: 'API / Backend', description: 'REST API, GraphQL, or backend service' },
  { value: 'cli', name: 'CLI Tool', description: 'Command-line application' },
  { value: 'library', name: 'Library / Package', description: 'Reusable library or npm/pip package' },
  { value: 'desktop', name: 'Desktop Application', description: 'Electron, Tauri, or native desktop app' },
  { value: 'mobile', name: 'Mobile Application', description: 'React Native, Flutter, or native mobile' },
  { value: 'other', name: 'Other', description: 'Something else' }
];

export const ASSISTANTS: { value: AIAssistant; name: string; description: string }[] = [
  { value: 'claude-code', name: 'Claude Code', description: 'Anthropic\'s Claude for coding' },
  { value: 'copilot', name: 'GitHub Copilot', description: 'GitHub\'s AI pair programmer' },
  { value: 'gemini', name: 'Google Gemini', description: 'Google\'s AI model' },
  { value: 'antigravity', name: 'Google Antigravity', description: 'Google\'s agentic platform' },
  { value: 'codex', name: 'OpenAI Codex', description: 'OpenAI\'s code model' }
];

export const ARCHITECTURES: { value: ArchitectureType; name: string; description: string }[] = [
  { value: 'layered', name: 'Layered', description: 'Simple layers: UI → Business → Data' },
  { value: 'modular-monolith', name: 'Modular Monolith', description: 'Single deploy with clear module boundaries' },
  { value: 'microservices', name: 'Microservices', description: 'Independent services with separate deploys' },
  { value: 'event-driven', name: 'Event-Driven', description: 'Event sourcing, CQRS, message queues' },
  { value: 'hexagonal', name: 'Hexagonal (Ports & Adapters)', description: 'Business logic isolated from infrastructure' },
  { value: 'clean-architecture', name: 'Clean Architecture', description: 'Uncle Bob\'s concentric layers with dependency rule' },
  { value: 'ddd', name: 'Domain-Driven Design', description: 'Bounded contexts, aggregates, domain events' },
  { value: 'serverless', name: 'Serverless', description: 'FaaS, event triggers, managed services' },
  { value: 'other', name: 'Other / None', description: 'Scripts, APIs, frontends, or no specific architecture' }
];

export const DATASOURCES: { value: DatasourceType; name: string; description: string }[] = [
  { value: 'sql', name: 'SQL Database', description: 'PostgreSQL, MySQL, SQLite, etc.' },
  { value: 'nosql', name: 'NoSQL Database', description: 'MongoDB, Redis, DynamoDB, etc.' },
  { value: 'none', name: 'No Database', description: 'No persistent data storage needed' }
];

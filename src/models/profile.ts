import { AIAssistant, Language, ProjectType } from './project';

export const INSTRUCTION_LEVELS = ['basic', 'standard', 'full'] as const;
export type InstructionLevel = typeof INSTRUCTION_LEVELS[number];

export function normalizeInstructionLevel(level: string): InstructionLevel {
  if (level === 'expert') {
    return 'full';
  }

  if ((INSTRUCTION_LEVELS as readonly string[]).includes(level)) {
    return level as InstructionLevel;
  }

  throw new Error(`Unsupported instruction level "${level}". Use one of: ${INSTRUCTION_LEVELS.join(', ')}`);
}
export type ArchitectureType =
  | 'layered'
  | 'modular-monolith'
  | 'microservices'
  | 'event-driven'
  | 'hexagonal'
  | 'clean-architecture'
  | 'ddd'
  | 'serverless'
  | 'monorepo'
  | 'bounded-contexts'
  | 'component-based'
  | 'other';
export type DatasourceType = 'sql' | 'nosql' | 'none';

export interface ProfileSelection {
  assistant: AIAssistant;
  language: Language;
  level: InstructionLevel;
  architecture: ArchitectureType;
  projectType: ProjectType;
  projectName: string;
  datasource: DatasourceType;
}

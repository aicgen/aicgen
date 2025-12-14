import { AIAssistant, Language, ProjectType } from './project.js';

export type InstructionLevel = 'basic' | 'standard' | 'expert' | 'full';
export type ArchitectureType =
  | 'layered'
  | 'modular-monolith'
  | 'microservices'
  | 'event-driven'
  | 'hexagonal'
  | 'clean-architecture'
  | 'ddd'
  | 'serverless'
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

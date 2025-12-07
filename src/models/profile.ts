import { AIAssistant, Language, ProjectType } from './project.js';

export type InstructionLevel = 'basic' | 'standard' | 'expert' | 'full';
export type ArchitectureType =
  | 'layered'
  | 'modular-monolith'
  | 'microservices'
  | 'event-driven'
  | 'hexagonal'
  | 'refactor';

export interface ProfileSelection {
  assistant: AIAssistant;
  language: Language;
  level: InstructionLevel;
  architecture: ArchitectureType;
  projectType: ProjectType;
}

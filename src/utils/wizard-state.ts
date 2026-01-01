import { Language, ProjectType, AIAssistant } from '../models/project';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile';

export type WizardStep =
  | 'language'
  | 'projectType'
  | 'assistant'
  | 'setupType'
  | 'architecture'
  | 'datasource'
  | 'level'
  | 'guidelines'
  | 'summary';

export interface WizardState {
  currentStep: WizardStep;
  history: WizardStep[];

  // Detected values
  detectedLanguage?: Language;
  detectedProjectName?: string;
  hasExistingConfig?: boolean;

  // User selections
  language?: Language;
  projectType?: ProjectType;
  assistant?: AIAssistant;
  setupType?: 'quick' | 'custom';
  architecture?: ArchitectureType;
  datasource?: DatasourceType;
  level?: InstructionLevel;
  selectedGuidelineIds?: string[];
}

export class WizardStateManager {
  private state: WizardState;
  private stepOrder: WizardStep[] = [
    'language',
    'projectType',
    'assistant',
    'setupType',
    'architecture',
    'datasource',
    'level',
    'guidelines',
    'summary'
  ];

  constructor(initialState: Partial<WizardState> = {}) {
    this.state = {
      currentStep: 'language',
      history: [],
      ...initialState
    };
  }

  getState(): Readonly<WizardState> {
    return { ...this.state };
  }

  updateState(updates: Partial<WizardState>): void {
    this.state = {
      ...this.state,
      ...updates
    };
  }

  goToStep(step: WizardStep): void {
    if (!this.state.history.includes(this.state.currentStep)) {
      this.state.history.push(this.state.currentStep);
    }
    this.state.currentStep = step;
  }

  goToNextStep(): void {
    const currentIndex = this.stepOrder.indexOf(this.state.currentStep);
    if (currentIndex < this.stepOrder.length - 1) {
      const nextStep = this.stepOrder[currentIndex + 1];
      this.goToStep(nextStep);
    }
  }

  goBack(): boolean {
    if (this.state.history.length === 0) {
      return false;
    }

    const previousStep = this.state.history.pop()!;
    this.state.currentStep = previousStep;
    return true;
  }

  canGoBack(): boolean {
    return this.state.history.length > 0;
  }

  shouldShowStep(step: WizardStep): boolean {
    // Skip guidelines step in quick setup
    if (step === 'guidelines' && this.state.setupType === 'quick') {
      return false;
    }

    return true;
  }

  isComplete(): boolean {
    return this.state.currentStep === 'summary' &&
           !!this.state.language &&
           !!this.state.projectType &&
           !!this.state.assistant &&
           !!this.state.setupType &&
           !!this.state.architecture &&
           !!this.state.datasource &&
           !!this.state.level;
  }
}

export const BACK_OPTION = '← Back';
export const BACK_VALUE = '__BACK__';

export function addBackOption<T>(choices: T[], canGoBack: boolean): T[] {
  if (!canGoBack) return choices;

  return [
    { value: BACK_VALUE, name: BACK_OPTION, description: 'Go back to previous step' } as T,
    ...choices
  ];
}

export function isBackSelected(value: unknown): boolean {
  return value === BACK_VALUE;
}

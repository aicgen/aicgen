import { AnalysisContext } from './project-analyzer';
import { AIAssistant, Language, ProjectType } from '../models/project';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile';
import { LANGUAGES, PROJECT_TYPES, ARCHITECTURES, DATASOURCES } from '../constants';
import { AIProvider } from './ai-analysis/providers/index';
import { ProviderFactory } from './ai-analysis/providers/index';

export interface AnalysisResult {
  architecture: {
    pattern: ArchitectureType;
    confidence: number;
  };
  projectType: ProjectType;
  language: Language;
  datasource: DatasourceType;
  level: InstructionLevel;
  backendStyle?: string;
  frontendStyle?: string;
  testingMaturity: 'low' | 'medium' | 'high';
  reasoning: string;
}

export class AIAnalysisService {

    async analyzeProject(context: AnalysisContext, assistant: AIAssistant, apiKey: string): Promise<AnalysisResult> {
        const provider = ProviderFactory.create(assistant, apiKey);
        const prompt = this.buildPrompt(context);

        try {
            const response = await provider.analyze(context, prompt);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(`AI Analysis failed: ${(error as Error).message}`);
        }
    }

    private buildPrompt(context: AnalysisContext): string {
        const availableOptions = {
            languages: LANGUAGES.map(l => l.value),
            projectTypes: PROJECT_TYPES.map(p => p.value),
            architectures: ARCHITECTURES.map(a => a.value),
            datasources: DATASOURCES.map(d => d.value),
            levels: ['basic', 'standard', 'expert', 'full']
        };

        return `
You are a codebase architecture analyzer.
Use the provided static analysis and file samples.
Return ONLY valid JSON matching the schema.
Do not explain your reasoning outside the JSON.

METADATA:
${JSON.stringify(context.metadata, null, 2)}

FILE SAMPLES:
${context.samples.map(s => `--- ${s.path} ---\n${s.content}\n---`).join('\n')}

AVAILABLE OPTIONS:
${JSON.stringify(availableOptions, null, 2)}

SCHEMA:
{
  "language": "value",
  "projectType": "value",
  "architecture": {
    "pattern": "value (from options)",
    "confidence": 0.0-1.0
  },
  "datasource": "value",
  "level": "value",
  "backendStyle": "short string (e.g. modular-monolith)",
  "frontendStyle": "short string (e.g. app-router)",
  "testingMaturity": "low|medium|high",
  "reasoning": "short explanation"
}
`;
    }

    private parseResponse(response: string): AnalysisResult {
        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    }
}

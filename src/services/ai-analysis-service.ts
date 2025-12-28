import { AnalysisContext } from './project-analyzer.js';
import { AIAssistant, Language, ProjectType } from '../models/project.js';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile.js';
import { LANGUAGES, PROJECT_TYPES, ARCHITECTURES, DATASOURCES } from '../constants.js';

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

export interface AIProvider {
    analyze(context: AnalysisContext, prompt: string): Promise<string>;
}

export class AIAnalysisService {
    
    async analyzeProject(context: AnalysisContext, assistant: AIAssistant, apiKey: string): Promise<AnalysisResult> {
        const provider = this.getProvider(assistant, apiKey);
        const prompt = this.buildPrompt(context);
        
        try {
            const response = await provider.analyze(context, prompt);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(`AI Analysis failed: ${(error as Error).message}`);
        }
    }

    private getProvider(assistant: AIAssistant, apiKey: string): AIProvider {
        // Simple factory - in real app, these would be separate classes
        if (assistant === 'claude-code' || assistant === 'antigravity') {
            return new ClaudeProvider(apiKey);
        } else if (assistant === 'gemini') {
            return new GeminiProvider(apiKey);
        } else if (assistant === 'codex' || assistant === 'copilot') {
            return new OpenAIProvider(apiKey);
        }
        throw new Error(`Provider ${assistant} not supported for analysis yet.`);
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
        // Clean markdown code blocks if present
        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    }
}

class ClaudeProvider implements AIProvider {
    constructor(private apiKey: string) {}
    
    async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.statusText}`);
        }

        const data = await response.json() as { content: { text: string }[] };
        return data.content[0].text;
    }
}

class GeminiProvider implements AIProvider {
    constructor(private apiKey: string) {}

    async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json() as { candidates: { content: { parts: { text: string }[] } }[] };
        return data.candidates[0].content.parts[0].text;
    }
}

class OpenAIProvider implements AIProvider {
    constructor(private apiKey: string) {}

    async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json() as { choices: { message: { content: string } }[] };
        return data.choices[0].message.content;
    }
}

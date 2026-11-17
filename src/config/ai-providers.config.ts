/**
 * AI Provider Configuration
 *
 * Centralized configuration for the models aicgen uses for project analysis
 * and the sub-agents it generates.
 *
 * Priority: environment variable > ~/.aicgen/config.yml > default.
 * An explicit value of `0` is respected (it is not treated as "unset").
 *
 * Example env vars:
 *   AICGEN_GEMINI_MODEL=gemini-3.8-flash
 *   AICGEN_CLAUDE_MODEL=claude-opus-5-5
 *   AICGEN_OPENAI_MODEL=gpt-6-astra
 *
 * Example ~/.aicgen/config.yml:
 * ```yaml
 * ai:
 *   gemini:
 *     model: gemini-3.8-flash
 *     timeout: 60000
 *   claude:
 *     model: claude-opus-5-5
 *     temperature: 0.5      # optional; omitted from requests unless set
 *   subAgents:
 *     guidelineChecker:
 *       model: opus         # alias (opus | sonnet | haiku | fable) or full ID
 * ```
 *
 * Model identifiers change often. Defaults below were last checked on
 * 2026-11-17; override them rather than waiting for a release if a model is
 * retired. Prefer aliases for generated sub-agents so they track the latest
 * model of that tier.
 */

import { userConfig as loadedUserConfig, UserConfig } from '../config.js';

export interface ProviderConfig {
  /** Model identifier used by the provider's API */
  model: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts for failed requests */
  maxRetries: number;
  /** Maximum tokens for completion */
  maxTokens?: number;
  /**
   * Sampling temperature. Left undefined by default and omitted from requests,
   * because some current models only accept their default temperature.
   */
  temperature?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

export interface SubAgentModelConfig {
  /** Claude Code model alias (opus, sonnet, haiku, fable), full model ID, or "inherit" */
  model: string;
}

export interface SubAgentConfig {
  /** Model for guideline checking tasks */
  guidelineChecker: SubAgentModelConfig;
  /** Model for architecture review tasks */
  architectureReviewer: SubAgentModelConfig;
  /** Model for security audit tasks */
  securityAuditor: SubAgentModelConfig;
}

export interface AIProvidersConfig {
  gemini: ProviderConfig;
  claude: ProviderConfig;
  openai: ProviderConfig;
  subAgents: SubAgentConfig;
}

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.8-flash',
  claude: 'claude-sonnet-5-5',
  openai: 'gpt-6-astra',
  subAgents: {
    guidelineChecker: 'opus',
    architectureReviewer: 'sonnet',
    securityAuditor: 'opus',
  },
} as const;

type Env = Record<string, string | undefined>;

function envInt(env: Env, name: string): number | undefined {
  const value = parseInt(env[name] ?? '', 10);
  return Number.isNaN(value) ? undefined : value;
}

function envFloat(env: Env, name: string): number | undefined {
  const value = parseFloat(env[name] ?? '');
  return Number.isNaN(value) ? undefined : value;
}

/** First value that is not undefined/null/empty-string. Unlike `||`, keeps 0. */
function pick<T>(...values: Array<T | undefined | null | ''>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Build configuration with priority: ENV > User Config > Defaults
 */
export function buildProviderConfig(
  env: Env = process.env,
  user: UserConfig = loadedUserConfig ?? {}
): AIProvidersConfig {
  const ai = user.ai ?? {};

  return {
    gemini: {
      model: pick(env.AICGEN_GEMINI_MODEL, ai.gemini?.model) ?? DEFAULT_MODELS.gemini,
      timeout: pick(envInt(env, 'AICGEN_GEMINI_TIMEOUT'), ai.gemini?.timeout) ?? 30000,
      maxRetries: pick(envInt(env, 'AICGEN_GEMINI_MAX_RETRIES'), ai.gemini?.maxRetries) ?? 3,
      maxTokens: pick(envInt(env, 'AICGEN_GEMINI_MAX_TOKENS'), ai.gemini?.maxTokens) ?? 8192,
      options: {
        // Force JSON response format
        generationConfig: {
          responseMimeType: 'application/json',
        },
      },
    },

    claude: {
      model: pick(env.AICGEN_CLAUDE_MODEL, ai.claude?.model) ?? DEFAULT_MODELS.claude,
      timeout: pick(envInt(env, 'AICGEN_CLAUDE_TIMEOUT'), ai.claude?.timeout) ?? 30000,
      maxRetries: pick(envInt(env, 'AICGEN_CLAUDE_MAX_RETRIES'), ai.claude?.maxRetries) ?? 3,
      maxTokens: pick(envInt(env, 'AICGEN_CLAUDE_MAX_TOKENS'), ai.claude?.maxTokens) ?? 8192,
      temperature: pick(envFloat(env, 'AICGEN_CLAUDE_TEMPERATURE'), ai.claude?.temperature),
    },

    openai: {
      model: pick(env.AICGEN_OPENAI_MODEL, ai.openai?.model) ?? DEFAULT_MODELS.openai,
      timeout: pick(envInt(env, 'AICGEN_OPENAI_TIMEOUT'), ai.openai?.timeout) ?? 30000,
      maxRetries: pick(envInt(env, 'AICGEN_OPENAI_MAX_RETRIES'), ai.openai?.maxRetries) ?? 3,
      maxTokens: pick(envInt(env, 'AICGEN_OPENAI_MAX_TOKENS'), ai.openai?.maxTokens) ?? 4096,
      temperature: pick(envFloat(env, 'AICGEN_OPENAI_TEMPERATURE'), ai.openai?.temperature),
      options: {
        // Force JSON response format
        response_format: { type: 'json_object' },
      },
    },

    subAgents: {
      guidelineChecker: {
        model:
          pick(env.AICGEN_SUBAGENT_GUIDELINE_MODEL, ai.subAgents?.guidelineChecker?.model) ??
          DEFAULT_MODELS.subAgents.guidelineChecker,
      },
      architectureReviewer: {
        model:
          pick(env.AICGEN_SUBAGENT_ARCHITECTURE_MODEL, ai.subAgents?.architectureReviewer?.model) ??
          DEFAULT_MODELS.subAgents.architectureReviewer,
      },
      securityAuditor: {
        model:
          pick(env.AICGEN_SUBAGENT_SECURITY_MODEL, ai.subAgents?.securityAuditor?.model) ??
          DEFAULT_MODELS.subAgents.securityAuditor,
      },
    },
  };
}

export const DEFAULT_AI_PROVIDERS_CONFIG: AIProvidersConfig = buildProviderConfig();

/**
 * Merged configuration from defaults, user config, and environment variables
 */
export function getAIProvidersConfig(
  userOverrides?: Partial<AIProvidersConfig>
): AIProvidersConfig {
  if (!userOverrides) {
    return DEFAULT_AI_PROVIDERS_CONFIG;
  }

  return {
    gemini: { ...DEFAULT_AI_PROVIDERS_CONFIG.gemini, ...userOverrides.gemini },
    claude: { ...DEFAULT_AI_PROVIDERS_CONFIG.claude, ...userOverrides.claude },
    openai: { ...DEFAULT_AI_PROVIDERS_CONFIG.openai, ...userOverrides.openai },
    subAgents: {
      guidelineChecker: {
        ...DEFAULT_AI_PROVIDERS_CONFIG.subAgents.guidelineChecker,
        ...userOverrides.subAgents?.guidelineChecker,
      },
      architectureReviewer: {
        ...DEFAULT_AI_PROVIDERS_CONFIG.subAgents.architectureReviewer,
        ...userOverrides.subAgents?.architectureReviewer,
      },
      securityAuditor: {
        ...DEFAULT_AI_PROVIDERS_CONFIG.subAgents.securityAuditor,
        ...userOverrides.subAgents?.securityAuditor,
      },
    },
  };
}

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(
  provider: 'gemini' | 'claude' | 'openai',
  userOverrides?: Partial<AIProvidersConfig>
): ProviderConfig {
  const config = getAIProvidersConfig(userOverrides);
  return config[provider];
}

/**
 * Get configuration for sub-agents
 */
export function getSubAgentConfig(
  userOverrides?: Partial<AIProvidersConfig>
): SubAgentConfig {
  const config = getAIProvidersConfig(userOverrides);
  return config.subAgents;
}

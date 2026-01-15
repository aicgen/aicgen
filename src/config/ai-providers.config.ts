/**
 * AI Provider Configuration
 *
 * Centralized configuration for all AI provider models and settings.
 *
 * To override: Set environment variables or update ~/.aicgen/config.yml
 * Example env vars:
 *   AICGEN_GEMINI_MODEL=gemini-2.5-pro
 *   AICGEN_CLAUDE_MODEL=claude-3-opus-20240229
 *   AICGEN_OPENAI_MODEL=gpt-4-turbo
 *
 * Example ~/.aicgen/config.yml:
 * ```yaml
 * ai:
 *   gemini:
 *     model: gemini-2.5-pro
 *     timeout: 60000
 *   claude:
 *     model: claude-3-opus-20240229
 *     temperature: 0.5
 *   subAgents:
 *     guidelineChecker:
 *       model: claude-opus-4-5
 *       temperature: 0.2
 * ```
 */

import { userConfig } from '../config.js';

export interface ProviderConfig {
  /** Model identifier used by the provider's API */
  model: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts for failed requests */
  maxRetries: number;
  /** Maximum tokens for completion */
  maxTokens?: number;
  /** Temperature for response generation (0-1) */
  temperature?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

export interface SubAgentConfig {
  /** Model for guideline checking tasks */
  guidelineChecker: {
    model: string;
    temperature?: number;
  };
  /** Model for architecture review tasks */
  architectureReviewer: {
    model: string;
    temperature?: number;
  };
  /** Model for security audit tasks */
  securityAuditor: {
    model: string;
    temperature?: number;
  };
}

export interface AIProvidersConfig {
  gemini: ProviderConfig;
  claude: ProviderConfig;
  openai: ProviderConfig;
  subAgents: SubAgentConfig;
}

/**
 * Default configuration for AI providers
 *
 * Models are updated for 2026 API versions:
 * - Gemini: Using latest 2.0 series (stable and fast)
 * - Claude: Using latest Sonnet 3.5 for analysis
 * - OpenAI: Using GPT-4o (latest stable model)
 */
/**
 * Build configuration with priority: ENV > User Config > Defaults
 */
function buildProviderConfig(): AIProvidersConfig {
  return {
    gemini: {
      // Updated to use Gemini 2.0 Flash (supported in v1beta API)
      // See: https://ai.google.dev/gemini-api/docs/models
      model:
        process.env.AICGEN_GEMINI_MODEL ||
        userConfig.ai?.gemini?.model ||
        'gemini-2.0-flash-exp',
      timeout:
        parseInt(process.env.AICGEN_GEMINI_TIMEOUT || '') ||
        userConfig.ai?.gemini?.timeout ||
        30000,
      maxRetries:
        parseInt(process.env.AICGEN_GEMINI_MAX_RETRIES || '') ||
        userConfig.ai?.gemini?.maxRetries ||
        3,
      maxTokens:
        parseInt(process.env.AICGEN_GEMINI_MAX_TOKENS || '') ||
        userConfig.ai?.gemini?.maxTokens ||
        8192,
      options: {
        // Force JSON response format
        generationConfig: {
          responseMimeType: 'application/json',
        },
      },
    },

    claude: {
      // Claude 3.5 Sonnet - best balance of speed and quality
      // See: https://docs.anthropic.com/en/docs/about-claude/models
      model:
        process.env.AICGEN_CLAUDE_MODEL ||
        userConfig.ai?.claude?.model ||
        'claude-3-5-sonnet-20241022',
      timeout:
        parseInt(process.env.AICGEN_CLAUDE_TIMEOUT || '') ||
        userConfig.ai?.claude?.timeout ||
        30000,
      maxRetries:
        parseInt(process.env.AICGEN_CLAUDE_MAX_RETRIES || '') ||
        userConfig.ai?.claude?.maxRetries ||
        3,
      maxTokens:
        parseInt(process.env.AICGEN_CLAUDE_MAX_TOKENS || '') ||
        userConfig.ai?.claude?.maxTokens ||
        8096,
      temperature:
        parseFloat(process.env.AICGEN_CLAUDE_TEMPERATURE || '') ||
        userConfig.ai?.claude?.temperature ||
        0.7,
    },

    openai: {
      // GPT-4o - latest optimized model
      // See: https://platform.openai.com/docs/models
      model:
        process.env.AICGEN_OPENAI_MODEL ||
        userConfig.ai?.openai?.model ||
        'gpt-4o',
      timeout:
        parseInt(process.env.AICGEN_OPENAI_TIMEOUT || '') ||
        userConfig.ai?.openai?.timeout ||
        30000,
      maxRetries:
        parseInt(process.env.AICGEN_OPENAI_MAX_RETRIES || '') ||
        userConfig.ai?.openai?.maxRetries ||
        3,
      maxTokens:
        parseInt(process.env.AICGEN_OPENAI_MAX_TOKENS || '') ||
        userConfig.ai?.openai?.maxTokens ||
        4096,
      temperature:
        parseFloat(process.env.AICGEN_OPENAI_TEMPERATURE || '') ||
        userConfig.ai?.openai?.temperature ||
        0.7,
      options: {
        // Force JSON response format
        response_format: { type: 'json_object' },
      },
    },

    subAgents: {
      guidelineChecker: {
        // Use Claude Opus for thorough guideline checking
        model:
          process.env.AICGEN_SUBAGENT_GUIDELINE_MODEL ||
          userConfig.ai?.subAgents?.guidelineChecker?.model ||
          'claude-opus-4-5',
        temperature:
          parseFloat(process.env.AICGEN_SUBAGENT_GUIDELINE_TEMP || '') ||
          userConfig.ai?.subAgents?.guidelineChecker?.temperature ||
          0.3,
      },
      architectureReviewer: {
        // Use Claude Sonnet for architecture review (faster, still high quality)
        model:
          process.env.AICGEN_SUBAGENT_ARCHITECTURE_MODEL ||
          userConfig.ai?.subAgents?.architectureReviewer?.model ||
          'claude-sonnet-4-5',
        temperature:
          parseFloat(process.env.AICGEN_SUBAGENT_ARCHITECTURE_TEMP || '') ||
          userConfig.ai?.subAgents?.architectureReviewer?.temperature ||
          0.5,
      },
      securityAuditor: {
        // Use Claude Opus for security auditing (most thorough)
        model:
          process.env.AICGEN_SUBAGENT_SECURITY_MODEL ||
          userConfig.ai?.subAgents?.securityAuditor?.model ||
          'claude-opus-4-5',
        temperature:
          parseFloat(process.env.AICGEN_SUBAGENT_SECURITY_TEMP || '') ||
          userConfig.ai?.subAgents?.securityAuditor?.temperature ||
          0.3,
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

# AI Provider Configuration Guide

## Overview

AICGEN now uses a **centralized configuration system** for all AI provider models and settings. This eliminates hardcoded values and makes it easy to customize AI behavior without modifying source code.

## What Changed

### Previous Issues (Fixed)

❌ **Hardcoded model names** scattered across multiple files:
- Gemini: `gemini-1.5-flash` (outdated, caused 404 errors)
- Claude: `claude-3-5-sonnet-20241022`
- OpenAI: `gpt-4o`
- Sub-agents: `claude-opus-4-5`, `claude-sonnet-4-5`

❌ **Hardcoded configuration values**:
- Timeouts: `30000ms`
- Max retries: `3`
- Max tokens: `8096`, `4096`, etc.
- Temperature: `0.3`, `0.5`, `0.7`

❌ **No way to customize** without editing source code

### Current Solution (✅ Fixed)

✅ **Centralized configuration** in `src/config/ai-providers.config.ts`
✅ **Updated Gemini model** to `gemini-2.0-flash-exp` (v1beta compatible)
✅ **Environment variable support** for all settings
✅ **User config file support** via `~/.aicgen/config.yml`
✅ **Runtime override support** via API options
✅ **Type-safe configuration** with TypeScript interfaces

## Configuration Priority

Settings are applied in this order (highest priority first):

1. **Environment Variables** (e.g., `AICGEN_GEMINI_MODEL`)
2. **User Config File** (`~/.aicgen/config.yml`)
3. **Default Values** (defined in code)

## How to Configure

### Option 1: User Config File (Recommended)

Create or edit `~/.aicgen/config.yml`:

```yaml
ai:
  gemini:
    model: gemini-2.5-pro
    timeout: 60000
    maxRetries: 5
    maxTokens: 16384

  claude:
    model: claude-3-opus-20240229
    temperature: 0.5

  openai:
    model: gpt-4-turbo
    temperature: 0.8

  subAgents:
    guidelineChecker:
      model: claude-opus-4-5
      temperature: 0.2
```

See `config.example.yml` for a complete example with all available options.

### Option 2: Environment Variables

Add to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Gemini Configuration
export AICGEN_GEMINI_MODEL=gemini-2.5-pro
export AICGEN_GEMINI_TIMEOUT=60000
export AICGEN_GEMINI_MAX_RETRIES=5
export AICGEN_GEMINI_MAX_TOKENS=16384

# Claude Configuration
export AICGEN_CLAUDE_MODEL=claude-3-opus-20240229
export AICGEN_CLAUDE_TEMPERATURE=0.5
export AICGEN_CLAUDE_MAX_TOKENS=8096

# OpenAI Configuration
export AICGEN_OPENAI_MODEL=gpt-4-turbo
export AICGEN_OPENAI_TEMPERATURE=0.8
export AICGEN_OPENAI_MAX_TOKENS=8192

# Sub-Agent Configuration
export AICGEN_SUBAGENT_GUIDELINE_MODEL=claude-opus-4-5
export AICGEN_SUBAGENT_GUIDELINE_TEMP=0.2
export AICGEN_SUBAGENT_ARCHITECTURE_MODEL=claude-sonnet-4-5
export AICGEN_SUBAGENT_ARCHITECTURE_TEMP=0.5
export AICGEN_SUBAGENT_SECURITY_MODEL=claude-opus-4-5
export AICGEN_SUBAGENT_SECURITY_TEMP=0.3
```

## Available Models

### Google Gemini

**Recommended:** `gemini-2.0-flash-exp` (default)

**Available models:**
- `gemini-2.5-flash` - Latest, fastest
- `gemini-2.5-pro` - Most capable, slower
- `gemini-2.0-flash-exp` - Experimental, very fast
- `gemini-2.0-flash` - Stable flash model

**Documentation:** https://ai.google.dev/gemini-api/docs/models

### Anthropic Claude

**Recommended:** `claude-3-5-sonnet-20241022` (default)

**Available models:**
- `claude-3-5-sonnet-20241022` - Best balance of speed and quality
- `claude-3-opus-20240229` - Most capable, expensive
- `claude-3-haiku-20240307` - Fastest, cheapest

**Documentation:** https://docs.anthropic.com/en/docs/about-claude/models

### OpenAI

**Recommended:** `gpt-4o` (default)

**Available models:**
- `gpt-4o` - Latest optimized model
- `gpt-4-turbo` - High capability
- `gpt-4` - Most capable (expensive)
- `gpt-3.5-turbo` - Fast and cheap

**Documentation:** https://platform.openai.com/docs/models

## Configuration Reference

### Provider Configuration

Each provider supports these settings:

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `model` | string | Model identifier | See above |
| `timeout` | number | Request timeout (ms) | `30000` |
| `maxRetries` | number | Max retry attempts | `3` |
| `maxTokens` | number | Max output tokens | Provider-specific |
| `temperature` | number | Response creativity (0-1) | `0.7` |

### Sub-Agent Configuration

Three specialized agents for code review:

**Guideline Checker**
- Default model: `claude-opus-4-5`
- Default temperature: `0.3`
- Purpose: Strict guideline compliance checking

**Architecture Reviewer**
- Default model: `claude-sonnet-4-5`
- Default temperature: `0.5`
- Purpose: Architectural design review

**Security Auditor**
- Default model: `claude-opus-4-5`
- Default temperature: `0.3`
- Purpose: Security vulnerability analysis

## Implementation Details

### Files Modified

1. **`src/config/ai-providers.config.ts`** (NEW)
   - Centralized AI provider configuration
   - Type-safe interfaces
   - Environment variable and user config support

2. **`src/config.ts`**
   - Extended `UserConfig` interface to include AI settings
   - Exported `userConfig` for use by AI provider config

3. **`src/services/ai-analysis/providers/gemini.provider.ts`**
   - Updated to use `getProviderConfig('gemini')`
   - Fixed model to `gemini-2.0-flash-exp` (v1beta compatible)
   - Added support for maxTokens and temperature

4. **`src/services/ai-analysis/providers/claude.provider.ts`**
   - Updated to use `getProviderConfig('claude')`
   - Removed hardcoded model and settings

5. **`src/services/ai-analysis/providers/openai.provider.ts`**
   - Updated to use `getProviderConfig('openai')`
   - Removed hardcoded model and settings

6. **`src/services/subagent-generator.ts`**
   - Updated to use `getSubAgentConfig()`
   - Dynamic YAML frontmatter generation with configured models
   - Removed all hardcoded model names

7. **`config.example.yml`** (NEW)
   - Complete example configuration file
   - Documentation for all available options
   - Examples of environment variable usage

## Migration Guide

If you have existing code that relies on specific models, you can:

1. **Keep current behavior:** Do nothing. Default models are unchanged.

2. **Customize via config file:**
   ```bash
   mkdir -p ~/.aicgen
   cp config.example.yml ~/.aicgen/config.yml
   # Edit config.yml with your preferences
   ```

3. **Customize via environment variables:**
   ```bash
   export AICGEN_GEMINI_MODEL=gemini-2.5-pro
   export AICGEN_CLAUDE_MODEL=claude-3-opus-20240229
   ```

## Troubleshooting

### Gemini 404 Error (FIXED)

**Error:** `models/gemini-1.5-flash is not found for API version v1beta`

**Solution:** This has been fixed. The default model is now `gemini-2.0-flash-exp` which is compatible with v1beta API.

If you still see this error, check your configuration:
```bash
# Check environment variables
echo $AICGEN_GEMINI_MODEL

# Check user config
cat ~/.aicgen/config.yml
```

### Model Not Found

If a model is not available:
1. Check the provider's documentation for current model names
2. Update your config file or environment variable
3. Restart the application

### Configuration Not Applied

Check the priority order:
1. Environment variables override everything
2. User config file overrides defaults
3. Defaults are used as fallback

Use logging to verify which config is being used:
```bash
# Enable debug logging
export DEBUG=aicgen:*
```

## Examples

### Using Different Models for Different Purposes

**Fast analysis (Gemini Flash):**
```yaml
ai:
  gemini:
    model: gemini-2.0-flash-exp
```

**High-quality analysis (Gemini Pro):**
```yaml
ai:
  gemini:
    model: gemini-2.5-pro
    maxTokens: 16384
```

**Cost optimization (Claude Haiku):**
```yaml
ai:
  claude:
    model: claude-3-haiku-20240307
```

**Maximum quality (Claude Opus):**
```yaml
ai:
  claude:
    model: claude-3-opus-20240229
    temperature: 0.3
```

### Adjusting Creativity/Strictness

**More creative (higher temperature):**
```yaml
ai:
  openai:
    temperature: 0.9
```

**More focused/deterministic (lower temperature):**
```yaml
ai:
  claude:
    temperature: 0.2
```

## API Reference

### `getProviderConfig(provider)`

Get configuration for a specific provider.

```typescript
import { getProviderConfig } from './config/ai-providers.config';

const geminiConfig = getProviderConfig('gemini');
console.log(geminiConfig.model); // 'gemini-2.0-flash-exp'
```

### `getSubAgentConfig()`

Get sub-agent configuration.

```typescript
import { getSubAgentConfig } from './config/ai-providers.config';

const subAgents = getSubAgentConfig();
console.log(subAgents.guidelineChecker.model); // 'claude-opus-4-5'
```

### `getAIProvidersConfig(userOverrides?)`

Get complete AI providers configuration with optional overrides.

```typescript
import { getAIProvidersConfig } from './config/ai-providers.config';

const config = getAIProvidersConfig({
  gemini: {
    model: 'gemini-2.5-pro',
    timeout: 60000
  }
});
```

## Contributing

When adding new AI providers or configuration options:

1. Update `AIProvidersConfig` interface
2. Add defaults in `buildProviderConfig()`
3. Update `UserConfig` in `src/config.ts`
4. Document in `config.example.yml`
5. Update this guide

## References

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Claude Models](https://docs.anthropic.com/en/docs/about-claude/models)
- [OpenAI Models](https://platform.openai.com/docs/models)

/**
 * Configuration file ranking
 *
 * Ranks config files by importance for analysis
 */

/**
 * Priority scores for different config file types
 */
const CONFIG_PRIORITIES: Record<string, number> = {
  // Framework configs (highest priority - define application behavior)
  'next.config.js': 100,
  'next.config.ts': 100,
  'nuxt.config.js': 100,
  'nuxt.config.ts': 100,
  'vite.config.js': 90,
  'vite.config.ts': 90,
  'webpack.config.js': 90,
  'webpack.config.ts': 90,
  'gatsby-config.js': 90,
  'svelte.config.js': 90,

  // TypeScript (very important - defines type system)
  'tsconfig.json': 85,

  // Build/Monorepo tools (important for understanding project structure)
  'nx.json': 80,
  'turbo.json': 80,
  'lerna.json': 80,
  'rush.json': 80,

  // Package manager (important - defines dependencies)
  'package.json': 75,
  'pyproject.toml': 75,
  'Cargo.toml': 75,
  'go.mod': 75,
  'Gemfile': 75,

  // Testing configs
  'jest.config.js': 70,
  'jest.config.ts': 70,
  'vitest.config.ts': 70,
  'playwright.config.ts': 70,
  'cypress.config.js': 70,

  // Linting/Formatting (lower priority)
  '.eslintrc.js': 60,
  '.eslintrc.json': 60,
  'eslint.config.js': 60,
  '.prettierrc': 55,
  'prettier.config.js': 55,

  // Docker (useful for deployment understanding)
  'Dockerfile': 65,
  'docker-compose.yml': 65,

  // CI/CD (lower priority for code analysis)
  '.github/workflows': 50,
  '.gitlab-ci.yml': 50,
  'azure-pipelines.yml': 50,

  // Default for unknown files
  default: 40,
};

/**
 * Rank configuration files by importance
 *
 * @param configFiles - List of config file paths
 * @returns Ranked list of config file paths (most important first)
 */
export function rankConfigFiles(configFiles: string[]): string[] {
  return [...configFiles].sort((a, b) => {
    const scoreA = getConfigFileScore(a);
    const scoreB = getConfigFileScore(b);
    return scoreB - scoreA; // Higher scores first
  });
}

/**
 * Get priority score for a config file
 */
function getConfigFileScore(filePath: string): number {
  // Extract filename from path
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];

  // Check for exact matches
  if (filename in CONFIG_PRIORITIES) {
    return CONFIG_PRIORITIES[filename];
  }

  // Check for pattern matches
  for (const [pattern, score] of Object.entries(CONFIG_PRIORITIES)) {
    if (filename.includes(pattern) || filePath.includes(pattern)) {
      return score;
    }
  }

  return CONFIG_PRIORITIES.default;
}

export const CONFIG = {
  APP_VERSION: '1.0.0-beta.3',
  APP_NAME: '@aicgen/aicgen',
  GITHUB_REPO_OWNER: 'aicgen',
  GITHUB_REPO_NAME: 'aicgen-data',
  GITHUB_API_BASE: 'https://api.github.com',
  USER_AGENT: 'aicgen-cli',
  CACHE_DIR_NAME: '.aicgen',
  DATA_DIR: 'data',
  CACHE_DIR: 'cache/official',
} as const;

export const GITHUB_REPO_URL = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;

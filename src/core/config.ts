/**
 * ByteDocs Express - Configuration Loader
 * Based on Bytedocs Golang implementation
 */

import { config as dotenvConfig } from 'dotenv';
import { ByteDocsConfig, BaseURLOption, AuthConfig, AIConfig, UIConfig } from './types';

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(envFile?: string): ByteDocsConfig {
  // Load .env file if specified
  if (envFile) {
    dotenvConfig({ path: envFile });
  } else {
    dotenvConfig();
  }

  const config: ByteDocsConfig = {
    title: process.env.BYTEDOCS_TITLE || 'API Documentation',
    version: process.env.BYTEDOCS_VERSION || '1.0.0',
    description: process.env.BYTEDOCS_DESCRIPTION || '',
    docsPath: process.env.BYTEDOCS_DOCS_PATH || '/docs',
    autoDetect: process.env.BYTEDOCS_AUTO_DETECT !== 'false',
    excludePaths: process.env.BYTEDOCS_EXCLUDE_PATHS
      ? process.env.BYTEDOCS_EXCLUDE_PATHS.split(',').map(p => p.trim())
      : [],
  };

  // Load base URLs
  const baseURLs = loadBaseURLs();
  if (baseURLs.length > 0) {
    config.baseURLs = baseURLs;
  } else if (process.env.BYTEDOCS_BASE_URL) {
    config.baseURL = process.env.BYTEDOCS_BASE_URL;
  }

  // Load auth configuration
  if (process.env.BYTEDOCS_AUTH_ENABLED === 'true') {
    config.authConfig = loadAuthConfig();
  }

  // Load UI configuration
  config.uiConfig = loadUIConfig();

  // Load AI configuration
  if (process.env.BYTEDOCS_AI_ENABLED === 'true') {
    config.aiConfig = loadAIConfig();
  }

  return config;
}

/**
 * Load base URLs from environment variables
 */
function loadBaseURLs(): BaseURLOption[] {
  const baseURLs: BaseURLOption[] = [];
  const envKeys = Object.keys(process.env);

  // Look for BYTEDOCS_*_URL patterns
  const urlPattern = /^BYTEDOCS_(.+)_URL$/;

  for (const key of envKeys) {
    const match = key.match(urlPattern);
    if (match && match[1] !== 'BASE') {
      const name = match[1].replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
      const url = process.env[key];

      if (url) {
        baseURLs.push({ name, url });
      }
    }
  }

  return baseURLs;
}

/**
 * Load authentication configuration
 */
function loadAuthConfig(): AuthConfig {
  const config: AuthConfig = {
    enabled: true,
    type: (process.env.BYTEDOCS_AUTH_TYPE as any) || 'session',
  };

  // Basic auth
  if (config.type === 'basic') {
    config.username = process.env.BYTEDOCS_AUTH_USERNAME;
    config.password = process.env.BYTEDOCS_AUTH_PASSWORD;
  }

  // API Key auth
  if (config.type === 'api_key') {
    config.apiKey = process.env.BYTEDOCS_AUTH_API_KEY;
    config.apiKeyHeader = process.env.BYTEDOCS_AUTH_API_KEY_HEADER || 'X-API-Key';
  }

  // Bearer auth
  if (config.type === 'bearer') {
    config.apiKey = process.env.BYTEDOCS_AUTH_BEARER_TOKEN;
  }

  // Session auth (default)
  if (config.type === 'session') {
    config.password = process.env.BYTEDOCS_AUTH_PASSWORD;
    config.sessionExpire = parseInt(process.env.BYTEDOCS_AUTH_SESSION_EXPIRE || '1440', 10);
    config.ipBanEnabled = process.env.BYTEDOCS_AUTH_IP_BAN_ENABLED !== 'false';
    config.ipBanMaxAttempts = parseInt(process.env.BYTEDOCS_AUTH_IP_BAN_MAX_ATTEMPTS || '5', 10);
    config.ipBanDuration = parseInt(process.env.BYTEDOCS_AUTH_IP_BAN_DURATION || '30', 10);

    if (process.env.BYTEDOCS_AUTH_ADMIN_WHITELIST_IPS) {
      config.adminWhitelistIPs = process.env.BYTEDOCS_AUTH_ADMIN_WHITELIST_IPS
        .split(',')
        .map(ip => ip.trim());
    }
  }

  return config;
}

/**
 * Load UI configuration
 */
function loadUIConfig(): UIConfig {
  return {
    theme: (process.env.BYTEDOCS_UI_THEME as any) || 'green',
    darkMode: process.env.BYTEDOCS_UI_DARK_MODE === 'true',
  };
}

/**
 * Load AI configuration
 */
function loadAIConfig(): AIConfig {
  const config: AIConfig = {
    enabled: true,
    provider: (process.env.BYTEDOCS_AI_PROVIDER as any) || 'openai',
    apiKey: process.env.BYTEDOCS_AI_API_KEY,
  };

  config.features = {
    chatEnabled: process.env.BYTEDOCS_AI_CHAT_ENABLED !== 'false',
    docGenerationEnabled: process.env.BYTEDOCS_AI_DOC_GENERATION_ENABLED !== 'false',
    model: process.env.BYTEDOCS_AI_MODEL,
    maxTokens: parseInt(process.env.BYTEDOCS_AI_MAX_TOKENS || '4096', 10),
    maxCompletionTokens: parseInt(process.env.BYTEDOCS_AI_MAX_COMPLETION_TOKENS || '2048', 10),
    temperature: parseFloat(process.env.BYTEDOCS_AI_TEMPERATURE || '0.7'),
  };

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: ByteDocsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate title
  if (!config.title || config.title.trim() === '') {
    errors.push('Title is required');
  }

  // Validate version
  if (!config.version || config.version.trim() === '') {
    errors.push('Version is required');
  }

  // Validate docs path
  if (!config.docsPath || !config.docsPath.startsWith('/')) {
    errors.push('Docs path must start with /');
  }

  // Validate auth config
  if (config.authConfig?.enabled) {
    const authErrors = validateAuthConfig(config.authConfig);
    errors.push(...authErrors);
  }

  // Validate AI config
  if (config.aiConfig?.enabled) {
    const aiErrors = validateAIConfig(config.aiConfig);
    errors.push(...aiErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate authentication configuration
 */
function validateAuthConfig(config: AuthConfig): string[] {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('Auth type is required when authentication is enabled');
    return errors;
  }

  switch (config.type) {
    case 'basic':
      if (!config.username || !config.password) {
        errors.push('Username and password are required for basic auth');
      }
      break;

    case 'api_key':
      if (!config.apiKey) {
        errors.push('API key is required for API key auth');
      }
      break;

    case 'bearer':
      if (!config.apiKey) {
        errors.push('Bearer token is required for bearer auth');
      }
      break;

    case 'session':
      if (!config.password) {
        errors.push('Password is required for session auth');
      }
      if (config.sessionExpire && config.sessionExpire < 1) {
        errors.push('Session expire must be at least 1 minute');
      }
      if (config.ipBanMaxAttempts && config.ipBanMaxAttempts < 1) {
        errors.push('IP ban max attempts must be at least 1');
      }
      break;
  }

  return errors;
}

/**
 * Validate AI configuration
 */
function validateAIConfig(config: AIConfig): string[] {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('AI provider is required when AI is enabled');
  }

  if (!config.apiKey) {
    errors.push('AI API key is required when AI is enabled');
  }

  if (config.features?.maxTokens && config.features.maxTokens < 1) {
    errors.push('Max tokens must be at least 1');
  }

  if (config.features?.temperature !== undefined) {
    if (config.features.temperature < 0 || config.features.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }
  }

  return errors;
}

/**
 * Merge configurations (programmatic config takes precedence over env)
 */
export function mergeConfigs(envConfig: ByteDocsConfig, userConfig: Partial<ByteDocsConfig>): ByteDocsConfig {
  return {
    ...envConfig,
    ...userConfig,
    authConfig: {
      ...envConfig.authConfig,
      ...userConfig.authConfig,
    } as AuthConfig,
    uiConfig: {
      ...envConfig.uiConfig,
      ...userConfig.uiConfig,
    } as UIConfig,
    aiConfig: {
      ...envConfig.aiConfig,
      ...userConfig.aiConfig,
      features: {
        ...envConfig.aiConfig?.features,
        ...userConfig.aiConfig?.features,
      },
    } as AIConfig,
  };
}

/**
 * ByteDocs Express - Main Entry Point
 * Automatic API documentation for Express.js
 */

export { ByteDocs, setupByteDocs } from './core/bytedocs';
export { loadConfigFromEnv, validateConfig, mergeConfigs } from './core/config';
export { extractRoutes, convertPathToOpenAPI } from './parser/route-analyzer';
export {
  createAuthMiddleware,
  createLoginHandler,
  createLogoutHandler,
  clearAuthData,
  stopCleanupInterval,
} from './auth/middleware';

// Export types
export * from './core/types';

// Export decorators/helpers
export * from './decorators/response';

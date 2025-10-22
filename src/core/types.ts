/**
 * ByteDocs Express - Core Type Definitions
 * Based on Bytedocs Golang implementation
 */

import { Request, Response as ExpressResponse, NextFunction, Router } from 'express';

/**
 * Base URL Configuration for multiple environments
 */
export interface BaseURLOption {
  name: string;
  url: string;
}

/**
 * Authentication Configuration
 */
export interface AuthConfig {
  enabled: boolean;
  type?: 'basic' | 'api_key' | 'bearer' | 'session';
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;

  // Session-based auth (Laravel-style)
  sessionExpire?: number;      // Minutes
  ipBanEnabled?: boolean;
  ipBanMaxAttempts?: number;
  ipBanDuration?: number;      // Minutes
  adminWhitelistIPs?: string[];
}

/**
 * UI Configuration
 */
export interface UIConfig {
  theme?: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'teal' | 'pink';
  darkMode?: boolean;
}

/**
 * AI Features Configuration
 */
export interface AIFeatures {
  chatEnabled?: boolean;
  docGenerationEnabled?: boolean;
  model?: string;
  maxTokens?: number;
  maxCompletionTokens?: number;
  temperature?: number;
}

/**
 * AI Configuration
 */
export interface AIConfig {
  provider?: 'openai' | 'gemini' | 'claude' | 'openrouter';
  apiKey?: string;
  enabled?: boolean;
  features?: AIFeatures;
  settings?: Record<string, any>;
}

/**
 * Main ByteDocs Configuration
 */
export interface ByteDocsConfig {
  title?: string;
  version?: string;
  description?: string;
  baseURL?: string;           // Backward compatibility
  baseURLs?: BaseURLOption[]; // Multiple environments
  docsPath?: string;
  autoDetect?: boolean;
  excludePaths?: string[];
  authConfig?: AuthConfig;
  uiConfig?: UIConfig;
  aiConfig?: AIConfig;
}

/**
 * Parameter Location Types
 */
export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

/**
 * Parameter Type
 */
export interface Parameter {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  schema: Schema;
  example?: any;
}

/**
 * Schema Definition
 */
export interface Schema {
  type: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  example?: any;
  enum?: any[];
  default?: any;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  $ref?: string;
}

/**
 * Request Body Definition
 */
export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, {
    schema: Schema;
    example?: any;
  }>;
}

/**
 * Response Definition
 */
export interface ResponseDef {
  description: string;
  content?: Record<string, {
    schema: Schema;
    example?: any;
  }>;
  headers?: Record<string, {
    description?: string;
    schema: Schema;
  }>;
}

/**
 * Endpoint Definition
 */
export interface Endpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, ResponseDef>;
  security?: Array<Record<string, string[]>>;
  operationId?: string;
  deprecated?: boolean;
}

/**
 * Route Information extracted from Express
 */
export interface RouteInfo {
  method: string;
  path: string;
  handler: Function;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseDef>;
  tags?: string[];
}

/**
 * Section for grouping endpoints
 */
export interface Section {
  name: string;
  endpoints: Endpoint[];
}

/**
 * OpenAPI Server Definition
 */
export interface OpenAPIServer {
  url: string;
  description?: string;
}

/**
 * OpenAPI Components
 */
export interface OpenAPIComponents {
  schemas?: Record<string, Schema>;
  responses?: Record<string, ResponseDef>;
  parameters?: Record<string, Parameter>;
  requestBodies?: Record<string, RequestBody>;
  securitySchemes?: Record<string, any>;
}

/**
 * OpenAPI Specification
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: OpenAPIServer[];
  paths: Record<string, Record<string, any>>;
  components?: OpenAPIComponents;
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * Handler Metadata extracted from source code
 */
export interface HandlerMetadata {
  info: {
    summary?: string;
    description?: string;
  };
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseDef>;
  tags?: string[];
}

/**
 * Session Data
 */
export interface SessionData {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ip: string;
}

/**
 * IP Ban Record
 */
export interface IPBanRecord {
  ip: string;
  attempts: number;
  bannedAt?: Date;
  expiresAt?: Date;
}

/**
 * Express Request with ByteDocs extensions
 */
export interface ByteDocsRequest extends Request {
  sessionId?: string;
  byteDocsAuth?: {
    authenticated: boolean;
    type?: string;
  };
}

/**
 * Middleware Type
 */
export type ByteDocsMiddleware = (
  req: ByteDocsRequest,
  res: ExpressResponse,
  next: NextFunction
) => void | Promise<void>;

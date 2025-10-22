/**
 * ByteDocs Express - Route Analyzer
 * Auto-detect and analyze Express routes
 */

import { Application, Router, Request, Response } from 'express';
import {
  RouteInfo,
  Parameter,
  RequestBody,
  ResponseDef,
  Schema,
  HandlerMetadata,
} from '../core/types';
import { analyzeHandlerResponses, analyzeRequestBody } from './ast-analyzer';

/**
 * Route Layer Interface (Express internal)
 */
interface Layer {
  name: string;
  handle: any;
  regexp: RegExp;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Layer[];
  };
  keys: Array<{ name: string; optional: boolean }>;
}

/**
 * Express Router Stack Interface
 */
interface RouterStack {
  stack: Layer[];
}

/**
 * Extract all routes from Express application
 */
export function extractRoutes(app: Application, excludePaths: string[] = []): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const stack = (app._router as RouterStack)?.stack || [];

  processStack(stack, '', routes, excludePaths);

  console.log(`[ByteDocs] Detected ${routes.length} routes`);

  return routes;
}

/**
 * Process Express router stack
 */
function processStack(
  stack: Layer[],
  basePath: string,
  routes: RouteInfo[],
  excludePaths: string[]
): void {
  for (const layer of stack) {
    if (layer.route) {
      // Direct route
      const path = normalizePath(basePath + layer.route.path);

      if (shouldExcludePath(path, excludePaths)) {
        continue;
      }

      const methods = Object.keys(layer.route.methods).filter(
        m => layer.route!.methods[m]
      );

      for (const method of methods) {
        const handler = layer.route.stack[0]?.handle;

        if (handler) {
          const metadata = extractHandlerMetadata(handler, path, method);

          routes.push({
            method: method.toUpperCase(),
            path,
            handler,
            ...metadata,
          });
        }
      }
    } else if (layer.name === 'router') {
      // Nested router
      let nestedPath = '';

      // Try to extract path from regexp
      const regexpSource = layer.regexp.source;

      // Match patterns like: ^\\/api(?:\\/(?=$))?$ or ^\\/api\\/?(?=\\/|$)
      const pathMatch = regexpSource.match(/\^\\?\/?([^\\?$()]+)/);
      if (pathMatch && pathMatch[1]) {
        nestedPath = pathMatch[1].replace(/\\\//g, '/');
      }

      const routerBasePath = basePath + (nestedPath ? '/' + nestedPath : '');
      const nestedStack = (layer.handle as RouterStack)?.stack || [];

      processStack(nestedStack, routerBasePath, routes, excludePaths);
    }
  }
}

/**
 * Check if path should be excluded
 */
function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  for (const excludePattern of excludePaths) {
    if (path.startsWith(excludePattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize path format
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    || '/';
}

/**
 * Extract metadata from handler function
 */
function extractHandlerMetadata(
  handler: Function,
  path: string,
  method: string
): HandlerMetadata {
  const metadata: HandlerMetadata = {
    info: {},
  };

  // Check for JSDoc comments or decorator metadata
  const funcString = handler.toString();
  const comments = extractComments(funcString);

  if (comments) {
    const parsed = parseComments(comments);
    metadata.info = {
      summary: parsed.summary || generateSummary(method, path),
      description: parsed.description,
    };
    metadata.parameters = parsed.parameters;
    metadata.tags = parsed.tags;
  } else {
    metadata.info.summary = generateSummary(method, path);
  }

  // Extract path parameters
  const pathParams = extractPathParameters(path);
  if (pathParams.length > 0) {
    metadata.parameters = [
      ...(metadata.parameters || []),
      ...pathParams,
    ];
  }

  // Infer request body for POST, PUT, PATCH (done before sourceCode resolution for clarity)
  let requestBody: RequestBody | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    // We'll set this after getting sourceCode
    requestBody = undefined;
  }

  // Use AST analysis to detect responses
  // Try to get source code from the handler's file
  let sourceCode: string | undefined;

  try {
    // Try to find the source file from the handler
    let sourceFile: string | undefined = (handler as any).__sourceFile;

    // Method: Search through Node's module cache to find which module exports this handler
    if (!sourceFile) {
      const handlerName = handler.name;

      // Iterate through all loaded modules
      for (const [modulePath, module] of Object.entries(require.cache || {})) {
        // Skip node_modules
        if (modulePath.includes('node_modules')) {
          continue;
        }

        // Check if this module exports our handler
        const exports = (module as any)?.exports;
        if (!exports) continue;

        // Check if handler is in exports
        let foundInModule = false;
        if (typeof exports === 'function' && exports === handler) {
          foundInModule = true;
        } else if (typeof exports === 'object') {
          for (const [exportName, exportValue] of Object.entries(exports)) {
            if (exportValue === handler) {
              foundInModule = true;
              break;
            }
          }
        }

        if (foundInModule) {
          sourceFile = modulePath;
          break;
        }
      }
    }

    // Read source file if found
    if (sourceFile) {
      const fs = require('fs');
      const path = require('path');

      // Handle both absolute and relative paths
      if (!path.isAbsolute(sourceFile)) {
        sourceFile = path.resolve(process.cwd(), sourceFile);
      }

      if (sourceFile && fs.existsSync(sourceFile)) {
        // Prefer TypeScript source over compiled JavaScript
        const tsFile = sourceFile.replace(/\.js$/, '.ts');
        if (tsFile !== sourceFile && fs.existsSync(tsFile)) {
          sourceFile = tsFile;
        }

        sourceCode = fs.readFileSync(sourceFile, 'utf-8');
      }
    }
  } catch (err) {
    // If we can't get source code, continue without it
    // console.log(`[ByteDocs] Could not read source file for ${handler.name}:`, err);
  }

  metadata.responses = analyzeHandlerResponses(handler, sourceCode);

  // Infer request body for POST, PUT, PATCH with sourceCode
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    metadata.requestBody = inferRequestBody(handler, sourceCode);
  }

  return metadata;
}

/**
 * Extract comments from function string
 */
function extractComments(funcString: string): string | null {
  const commentMatch = funcString.match(/\/\*\*[\s\S]*?\*\//);
  return commentMatch ? commentMatch[0] : null;
}

/**
 * Parse JSDoc-style comments
 */
function parseComments(comments: string): {
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  tags?: string[];
} {
  const result: any = {};
  const lines = comments.split('\n').map(l => l.trim().replace(/^\*\s?/, ''));

  let summary = '';
  let description = '';
  const parameters: Parameter[] = [];
  const tags: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('/**') || line.startsWith('*/')) {
      continue;
    }

    // @param tag
    if (line.startsWith('@param')) {
      const paramMatch = line.match(/@param\s+(\w+)\s+(\w+)\s+(\w+)\s+(.*)/);
      if (paramMatch) {
        const [, name, location, type, desc] = paramMatch;
        parameters.push({
          name,
          in: location as any,
          description: desc,
          required: !desc.includes('optional'),
          schema: { type: mapTypeToSchema(type) },
        });
      }
    }
    // @tag
    else if (line.startsWith('@tag')) {
      const tag = line.replace('@tag', '').trim();
      if (tag) tags.push(tag);
    }
    // @summary
    else if (line.startsWith('@summary')) {
      summary = line.replace('@summary', '').trim();
    }
    // @description
    else if (line.startsWith('@description')) {
      description = line.replace('@description', '').trim();
    }
    // First non-empty line is summary
    else if (!summary && line && !line.startsWith('@')) {
      summary = line;
    }
    // Subsequent lines are description
    else if (summary && line && !line.startsWith('@')) {
      description += (description ? ' ' : '') + line;
    }
  }

  if (summary) result.summary = summary;
  if (description) result.description = description;
  if (parameters.length > 0) result.parameters = parameters;
  if (tags.length > 0) result.tags = tags;

  return result;
}

/**
 * Map string type to schema type
 */
function mapTypeToSchema(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    int: 'integer',
    integer: 'integer',
    bool: 'boolean',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
  };

  return typeMap[type.toLowerCase()] || 'string';
}

/**
 * Extract path parameters from route path
 */
function extractPathParameters(path: string): Parameter[] {
  const params: Parameter[] = [];
  const paramRegex = /:(\w+)/g;
  let match;

  while ((match = paramRegex.exec(path)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: `${match[1]} parameter`,
    });
  }

  return params;
}

/**
 * Infer request body from handler function
 */
function inferRequestBody(handler: Function, sourceCode?: string): RequestBody | undefined {
  // Use AST analyzer to extract request body schema
  const schema = analyzeRequestBody(handler, sourceCode);

  if (schema) {
    // Check if handler has attached request body example
    const requestBodyExample = (handler as any).__bytedocs_request_body;

    return {
      description: 'Request body',
      required: true,
      content: {
        'application/json': {
          schema,
          example: requestBodyExample,
        },
      },
    };
  }

  return undefined;
}

/**
 * Generate schema from example data
 */
function generateSchemaFromExample(data: any): any {
  if (data === null) return { type: 'null' };
  if (data === undefined) return { type: 'object' };

  if (Array.isArray(data)) {
    return {
      type: 'array',
      items: data.length > 0 ? generateSchemaFromExample(data[0]) : { type: 'object' },
    };
  }

  const dataType = typeof data;

  if (dataType === 'object') {
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      properties[key] = generateSchemaFromExample(value);
      if (value !== null && value !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (dataType === 'string') return { type: 'string', example: data };
  if (dataType === 'number') {
    return {
      type: Number.isInteger(data) ? 'integer' : 'number',
      example: data,
    };
  }
  if (dataType === 'boolean') return { type: 'boolean', example: data };

  return { type: 'object' };
}

/**
 * Infer responses from handler function
 */
function inferResponses(handler: Function, method: string): Record<string, ResponseDef> {
  const responses: Record<string, ResponseDef> = {};
  const funcString = handler.toString();

  // Default success response
  const defaultStatus = method.toUpperCase() === 'POST' ? '201' : '200';

  // Check for res.json, res.send, res.status patterns
  const statusMatches = funcString.match(/res\.status\((\d+)\)/g);
  const hasJson = funcString.includes('res.json') || funcString.includes('.json()');
  const hasSend = funcString.includes('res.send');

  if (statusMatches) {
    for (const match of statusMatches) {
      const status = match.match(/\d+/)?.[0];
      if (status) {
        responses[status] = createResponse(status, hasJson || hasSend);
      }
    }
  }

  // Add default success response if not present
  if (!responses[defaultStatus]) {
    responses[defaultStatus] = createResponse(defaultStatus, true);
  }

  return responses;
}

/**
 * Create response definition
 */
function createResponse(status: string, hasContent: boolean): ResponseDef {
  const statusNum = parseInt(status, 10);
  const description = getStatusDescription(statusNum);

  const response: ResponseDef = { description };

  if (hasContent) {
    response.content = {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    };
  }

  return response;
}

/**
 * Get HTTP status description
 */
function getStatusDescription(status: number): string {
  const descriptions: Record<number, string> = {
    200: 'Successful operation',
    201: 'Resource created successfully',
    204: 'No content',
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Resource not found',
    422: 'Validation error',
    500: 'Internal server error',
  };

  return descriptions[status] || `HTTP ${status}`;
}

/**
 * Generate summary from method and path
 */
function generateSummary(method: string, path: string): string {
  const methodUpper = method.toUpperCase();
  const pathParts = path.split('/').filter(Boolean);
  const resource = pathParts[pathParts.length - 1] || 'resource';

  const resourceName = resource
    .replace(/[:-]/g, ' ')
    .replace(/{(.+?)}/g, '$1')
    .trim();

  switch (methodUpper) {
    case 'GET':
      return path.includes(':') || path.includes('{')
        ? `Get ${resourceName}`
        : `List ${resourceName}`;
    case 'POST':
      return `Create ${resourceName}`;
    case 'PUT':
      return `Update ${resourceName}`;
    case 'PATCH':
      return `Partially update ${resourceName}`;
    case 'DELETE':
      return `Delete ${resourceName}`;
    default:
      return `${methodUpper} ${resourceName}`;
  }
}

/**
 * Convert Express path to OpenAPI format
 */
export function convertPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

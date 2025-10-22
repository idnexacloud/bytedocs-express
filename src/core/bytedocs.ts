/**
 * ByteDocs Express - Main Documentation Engine
 * Based on Bytedocs Golang implementation
 */

import { Application, Router } from 'express';
import cookieParser from 'cookie-parser';
import * as yaml from 'js-yaml';
import {
  ByteDocsConfig,
  RouteInfo,
  Endpoint,
  Section,
  OpenAPISpec,
  Parameter,
  Schema,
} from './types';
import { loadConfigFromEnv, validateConfig, mergeConfigs } from './config';
import { extractRoutes, convertPathToOpenAPI } from '../parser/route-analyzer';
import {
  createAuthMiddleware,
  createLoginHandler,
  createLogoutHandler,
} from '../auth/middleware';
import {
  createDocsUIHandler,
  createAPIDataHandler,
  createOpenAPIJSONHandler,
  createLoginPageHandler,
  createConfigErrorPageHandler,
} from '../ui/handlers';

/**
 * ByteDocs - Main documentation class
 */
export class ByteDocs {
  private config: ByteDocsConfig;
  private routes: RouteInfo[] = [];
  private endpoints: Endpoint[] = [];
  private sections: Section[] = [];
  private generated: boolean = false;

  constructor(config?: Partial<ByteDocsConfig>) {
    // Load from environment
    const envConfig = loadConfigFromEnv();

    // Merge with user config
    this.config = config ? mergeConfigs(envConfig, config) : envConfig;

    // Set defaults
    this.config.title = this.config.title || 'API Documentation';
    this.config.version = this.config.version || '1.0.0';
    this.config.docsPath = this.config.docsPath || '/docs';
    this.config.autoDetect = this.config.autoDetect !== false;
    this.config.excludePaths = this.config.excludePaths || [];

    // Add docs path to exclude paths
    this.config.excludePaths.push(this.config.docsPath);

    // Validate config
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      console.warn('ByteDocs configuration warnings:', validation.errors);
    }
  }

  /**
   * Setup ByteDocs for Express application
   */
  setupExpress(app: Application): void {
    const docsPath = this.config.docsPath!;
    const router = Router();

    // Add cookie parser for session auth
    router.use(cookieParser());

    // Add authentication middleware if enabled
    const authMiddleware = createAuthMiddleware(this.config.authConfig || { enabled: false });

    // Authentication routes (if session auth)
    if (this.config.authConfig?.enabled && this.config.authConfig.type === 'session') {
      router.get(`/login`, createLoginPageHandler(this.config));
      router.post(`/login`, createLoginHandler(this.config.authConfig));
      router.post(`/logout`, createLogoutHandler());
    }

    // Main documentation routes
    router.get('/', authMiddleware, (req, res, next) => {
      // Auto-detect routes on first request
      if (this.config.autoDetect && !this.generated) {
        this.detectRoutes(app);
        this.generate();
      }

      createDocsUIHandler(
        () => this.getDocumentationData(),
        this.config
      )(req as any, res);
    });

    router.get('/api-data.json', authMiddleware, (req, res) => {
      if (this.config.autoDetect && !this.generated) {
        this.detectRoutes(app);
        this.generate();
      }

      createAPIDataHandler(
        () => this.getDocumentationData(),
        this.config
      )(req as any, res);
    });

    router.get('/openapi.json', authMiddleware, (req, res) => {
      if (this.config.autoDetect && !this.generated) {
        this.detectRoutes(app);
        this.generate();
      }

      createOpenAPIJSONHandler(
        () => this.getOpenAPISpec(),
        this.config
      )(req as any, res);
    });

    router.get('/openapi.yaml', authMiddleware, (req, res) => {
      if (this.config.autoDetect && !this.generated) {
        this.detectRoutes(app);
        this.generate();
      }

      try {
        const spec = this.getOpenAPISpec();
        const yamlContent = yaml.dump(spec, {
          indent: 2,
          lineWidth: -1, // No line wrapping
          noRefs: true,
        });

        res.setHeader('Content-Type', 'application/x-yaml');
        res.setHeader('Content-Disposition', 'attachment; filename="openapi.yaml"');
        res.send(yamlContent);
      } catch (error) {
        console.error('[ByteDocs] Failed to generate YAML:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export OpenAPI YAML',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // AI Chat endpoint
    router.post('/chat', authMiddleware, async (req, res) => {
      if (this.config.autoDetect && !this.generated) {
        this.detectRoutes(app);
        this.generate();
      }

      try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            error: 'Invalid request. Message is required.',
          });
        }

        // Generate AI response using LLM
        const response = await this.generateAIResponse(message);

        res.json(response);
      } catch (error) {
        console.error('[ByteDocs] Chat error:', error);
        res.status(500).json({
          error: 'Failed to process chat request',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Mount router
    app.use(docsPath, router);
  }

  /**
   * Detect routes from Express application
   */
  private detectRoutes(app: Application): void {
    const excludePaths = [
      ...(this.config.excludePaths || []),
      this.config.docsPath!,
    ];

    this.routes = extractRoutes(app, excludePaths);
  }

  /**
   * Add route manually
   */
  addRoute(route: RouteInfo): void {
    this.routes.push(route);
    this.generated = false; // Mark as needing regeneration
  }

  /**
   * Generate documentation from routes
   */
  generate(): void {
    this.endpoints = [];
    this.sections = [];

    // Convert routes to endpoints
    for (const route of this.routes) {
      const endpoint = this.routeToEndpoint(route);
      this.endpoints.push(endpoint);
    }

    // Post-process: Copy request body schema from POST to PUT/PATCH endpoints
    this.copyRequestBodyFromPost();

    // Group endpoints into sections
    this.sections = this.groupEndpointsIntoSections(this.endpoints);

    this.generated = true;
  }

  /**
   * Copy request body schema from POST endpoints to PUT/PATCH endpoints
   * For endpoints like PUT /api/products/:id, copy schema from POST /api/products
   */
  private copyRequestBodyFromPost(): void {
    // Create a map of POST endpoints by base path
    const postEndpoints = new Map<string, Endpoint>();

    for (const endpoint of this.endpoints) {
      if (endpoint.method === 'POST' && endpoint.requestBody) {
        postEndpoints.set(endpoint.path, endpoint);
      }
    }

    // Update PUT/PATCH endpoints with empty or missing request bodies
    for (const endpoint of this.endpoints) {
      if (['PUT', 'PATCH'].includes(endpoint.method)) {
        // Check if request body is empty or missing properties
        const hasEmptyBody = !endpoint.requestBody ||
          !endpoint.requestBody.content?.['application/json']?.schema?.properties ||
          Object.keys(endpoint.requestBody.content['application/json'].schema.properties).length === 0;

        if (hasEmptyBody) {
          // Try to find corresponding POST endpoint
          // Remove path parameters like /:id, /{id}
          const basePath = endpoint.path.replace(/\/\{[^}]+\}$/, '').replace(/\/:[^/]+$/, '');

          const postEndpoint = postEndpoints.get(basePath);
          if (postEndpoint && postEndpoint.requestBody) {
            console.log(`[ByteDocs] Copying request body schema from POST ${basePath} to ${endpoint.method} ${endpoint.path}`);

            // Clone the request body schema
            const clonedRequestBody = JSON.parse(JSON.stringify(postEndpoint.requestBody));

            // Update description for PUT/PATCH
            if (clonedRequestBody.content?.['application/json']?.schema) {
              const schema = clonedRequestBody.content['application/json'].schema;
              if (endpoint.method === 'PATCH') {
                schema.description = 'Partial update fields (all fields optional)';
                // Make all fields optional for PATCH
                delete schema.required;
              } else {
                schema.description = 'Update fields';
              }
            }

            endpoint.requestBody = clonedRequestBody;
          }
        }
      }
    }
  }

  /**
   * Convert route to endpoint
   */
  private routeToEndpoint(route: RouteInfo): Endpoint {
    const path = convertPathToOpenAPI(route.path);
    const method = route.method.toUpperCase();

    // Generate unique ID for endpoint
    const id = `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return {
      path,
      method,
      summary: route.summary,
      description: route.description,
      tags: route.tags || this.inferTags(path),
      parameters: route.parameters || [],
      requestBody: route.requestBody,
      responses: route.responses || this.getDefaultResponses(route.method),
      operationId: id,
    };
  }

  /**
   * Infer tags from path
   */
  private inferTags(path: string): string[] {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
      const tag = parts[0]
        .replace(/{(.+?)}/, '')
        .replace(/[:-]/g, ' ')
        .trim();
      return [tag.charAt(0).toUpperCase() + tag.slice(1)];
    }
    return ['Default'];
  }

  /**
   * Get default responses for method
   */
  private getDefaultResponses(method: string): Record<string, any> {
    const responses: Record<string, any> = {};

    const successStatus = method.toUpperCase() === 'POST' ? '201' : '200';

    responses[successStatus] = {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: {
            type: 'object',
          },
        },
      },
    };

    return responses;
  }

  /**
   * Group endpoints into sections
   */
  private groupEndpointsIntoSections(endpoints: Endpoint[]): Section[] {
    const sectionMap = new Map<string, Endpoint[]>();

    for (const endpoint of endpoints) {
      const sectionName = endpoint.tags?.[0] || 'Default';

      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }

      sectionMap.get(sectionName)!.push(endpoint);
    }

    const sections: Section[] = [];
    for (const [name, endpoints] of sectionMap.entries()) {
      sections.push({ name, endpoints });
    }

    return sections;
  }

  /**
   * Get documentation data for UI
   */
  getDocumentationData(): any {
    // Transform sections to add IDs to all endpoints
    const sectionsWithIds = this.sections.map(section => ({
      name: section.name,
      endpoints: section.endpoints.map(endpoint => ({
        ...endpoint,
        id: endpoint.operationId || `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      })),
    }));

    return {
      title: this.config.title,
      version: this.config.version,
      description: this.config.description,
      baseURLs: this.config.baseURLs || (this.config.baseURL ? [{ name: 'Default', url: this.config.baseURL }] : []),
      endpoints: sectionsWithIds,  // Frontend expects 'endpoints' to be sections array with IDs
    };
  }

  /**
   * Get OpenAPI specification
   */
  getOpenAPISpec(): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: {
        title: this.config.title || 'API Documentation',
        version: this.config.version || '1.0.0',
        description: this.config.description,
      },
      paths: {},
    };

    // Add servers
    if (this.config.baseURLs && this.config.baseURLs.length > 0) {
      spec.servers = this.config.baseURLs.map(baseURL => ({
        url: baseURL.url,
        description: baseURL.name,
      }));
    } else if (this.config.baseURL) {
      spec.servers = [{ url: this.config.baseURL }];
    }

    // Add tags
    const tags = new Set<string>();
    for (const endpoint of this.endpoints) {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => tags.add(tag));
      }
    }
    if (tags.size > 0) {
      spec.tags = Array.from(tags).map(tag => ({ name: tag }));
    }

    // Add paths
    for (const endpoint of this.endpoints) {
      if (!spec.paths[endpoint.path]) {
        spec.paths[endpoint.path] = {};
      }

      const operation: any = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        responses: endpoint.responses,
      };

      if (endpoint.requestBody) {
        operation.requestBody = endpoint.requestBody;
      }

      if (endpoint.operationId) {
        operation.operationId = endpoint.operationId;
      }

      if (endpoint.deprecated) {
        operation.deprecated = true;
      }

      spec.paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    }

    return spec;
  }

  /**
   * Get configuration
   */
  getConfig(): ByteDocsConfig {
    return { ...this.config };
  }

  /**
   * Get all routes
   */
  getRoutes(): RouteInfo[] {
    return [...this.routes];
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): Endpoint[] {
    return [...this.endpoints];
  }

  /**
   * Get all sections
   */
  getSections(): Section[] {
    return [...this.sections];
  }

  /**
   * Generate AI response using LLM with API documentation context
   */
  private async generateAIResponse(userMessage: string): Promise<any> {
    // Check if AI is enabled
    if (!this.config.aiConfig?.enabled) {
      return {
        error: 'AI features are not enabled. Please configure aiConfig in ByteDocs settings.',
      };
    }

    try {
      const { LLMClient } = await import('../ai/llm-client');
      const { ContextOptimizer } = await import('../ai/context-optimizer');
      const client = new LLMClient(this.config.aiConfig);

      // Get OpenAPI spec and optimize for LLM context
      const openAPISpec = this.getOpenAPISpec();
      const context = ContextOptimizer.optimizeForLLM(openAPISpec);

      // Log token estimate
      const estimatedTokens = ContextOptimizer.estimateTokens(context);
      console.log(`[ByteDocs] Sending optimized context to LLM (~${estimatedTokens} tokens)`);

      // Send to LLM
      const response = await client.chat({
        message: userMessage,
        context,
      });

      if (response.error) {
        return {
          error: response.error,
          provider: response.provider,
        };
      }

      return {
        response: response.response,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
      };
    } catch (error) {
      console.error('[ByteDocs] AI generation error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to generate AI response',
      };
    }
  }
}

/**
 * Setup ByteDocs for Express (convenience function)
 */
export function setupByteDocs(
  app: Application,
  config?: Partial<ByteDocsConfig>
): ByteDocs {
  const bytedocs = new ByteDocs(config);
  bytedocs.setupExpress(app);
  return bytedocs;
}

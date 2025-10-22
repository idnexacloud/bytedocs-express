/**
 * Context Optimizer for LLM
 * Reduces token usage by compressing OpenAPI spec while keeping essential information
 */

import { OpenAPISpec } from '../core/types';

export class ContextOptimizer {
  /**
   * Optimize OpenAPI spec for LLM context
   * Removes unnecessary fields and compresses data
   */
  static optimizeForLLM(spec: OpenAPISpec): string {
    const optimized: any = {
      openapi: spec.openapi,
      info: {
        title: spec.info.title,
        version: spec.info.version,
      },
      paths: this.optimizePaths(spec.paths),
    };

    // Keep only first server
    if (spec.servers && spec.servers.length > 0) {
      optimized.servers = [spec.servers[0]];
    }

    // Minify JSON - no whitespace
    return JSON.stringify(optimized);
  }

  /**
   * Optimize paths - remove unnecessary fields
   */
  private static optimizePaths(paths: any): any {
    const optimized: any = {};

    for (const [path, methods] of Object.entries(paths)) {
      optimized[path] = {};

      for (const [method, operation] of Object.entries(methods as any)) {
        const op: any = {};

        // Keep only essential fields
        if ((operation as any).summary) {
          op.summary = (operation as any).summary;
        }

        // Parameters - simplified
        if ((operation as any).parameters) {
          op.parameters = (operation as any).parameters.map((p: any) => ({
            name: p.name,
            in: p.in,
            required: p.required,
            type: p.schema?.type || 'string',
          }));
        }

        // Request body - simplified schema only
        if ((operation as any).requestBody) {
          const rb = (operation as any).requestBody;
          const schema = rb.content?.['application/json']?.schema;
          if (schema) {
            op.requestBody = {
              required: rb.required,
              schema: this.simplifySchema(schema),
            };
          }
        }

        // Responses - only success codes and essential info
        if ((operation as any).responses) {
          op.responses = {};
          for (const [code, response] of Object.entries((operation as any).responses)) {
            // Only keep 2xx and 4xx codes
            if (code.startsWith('2') || code.startsWith('4')) {
              op.responses[code] = {
                description: (response as any).description,
              };

              // Include simplified schema for 2xx
              if (code.startsWith('2')) {
                const schema = (response as any).content?.['application/json']?.schema;
                if (schema) {
                  op.responses[code].schema = this.simplifySchema(schema);
                }
              }
            }
          }
        }

        optimized[path][method] = op;
      }
    }

    return optimized;
  }

  /**
   * Simplify schema - keep only essential structure
   */
  private static simplifySchema(schema: any, depth: number = 0): any {
    if (!schema || depth > 2) {
      return { type: schema?.type || 'object' };
    }

    const simplified: any = {
      type: schema.type || 'object',
    };

    // For objects, keep property names and types only
    if (schema.type === 'object' && schema.properties) {
      simplified.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        const p = prop as any;
        simplified.properties[key] = {
          type: p.type || 'string',
        };

        // Keep nested properties for one level only
        if (p.properties && depth < 1) {
          simplified.properties[key].properties = this.simplifySchema(p, depth + 1).properties;
        }

        // Keep array items type
        if (p.type === 'array' && p.items) {
          simplified.properties[key].items = this.simplifySchema(p.items, depth + 1);
        }
      }

      // Keep required fields
      if (schema.required && schema.required.length > 0) {
        simplified.required = schema.required;
      }
    }

    // For arrays, simplify items
    if (schema.type === 'array' && schema.items) {
      simplified.items = this.simplifySchema(schema.items, depth + 1);
    }

    return simplified;
  }

  /**
   * Get token count estimate (rough)
   */
  static estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

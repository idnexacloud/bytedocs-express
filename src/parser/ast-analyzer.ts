/**
 * ByteDocs Express - AST Analyzer
 * Extract response structures from handler functions using AST analysis
 */

// @ts-ignore - Babel doesn't have proper TS types
import * as parser from '@babel/parser';
// @ts-ignore
import traverse from '@babel/traverse';
// @ts-ignore
import * as t from '@babel/types';
import { ResponseDef, Schema } from '../core/types';

/**
 * Response information extracted from handler
 */
interface ResponseInfo {
  status: number;
  data?: any;
  schema?: Schema;
}

/**
 * Variable tracking for resolving references
 */
interface VariableInfo {
  name: string;
  value: any;
  type: string;
  schema?: Schema;
}

/**
 * Analyze handler function to extract response information
 */
export function analyzeHandlerResponses(handler: Function, sourceCode?: string): Record<string, ResponseDef> {
  try {
    // Check if handler has __bytedocs_example property
    let exampleFromDoc: any = (handler as any).__bytedocs_example;

    // Get function source code
    const funcString = handler.toString();

    // If no example attached, try to parse from JSDoc comments (won't work after transpilation)
    if (!exampleFromDoc) {
      const exampleStart = funcString.indexOf('@example');

      if (exampleStart !== -1) {
        try {
          // Extract everything after @example until the end of comment or next @tag
          const afterExample = funcString.substring(exampleStart + 8); // 8 = '@example'.length
          const endOfComment = afterExample.indexOf('*/');
          const nextTag = afterExample.search(/@\w+/);

          let exampleText = afterExample;
          if (nextTag !== -1 && nextTag < endOfComment) {
            exampleText = afterExample.substring(0, nextTag);
          } else if (endOfComment !== -1) {
            exampleText = afterExample.substring(0, endOfComment);
          }

          // Clean up comment markers and extract JSON
          const lines = exampleText.split('\n');
          const jsonLines: string[] = [];

          for (const line of lines) {
            const cleaned = line.replace(/^\s*\*\s?/, '').trim();
            if (cleaned) {
              jsonLines.push(cleaned);
            }
          }

          const jsonStr = jsonLines.join('\n');
          exampleFromDoc = JSON.parse(jsonStr);
        } catch (err) {
          // Ignore JSON parse errors
          console.error('[ByteDocs] Failed to parse @example:', err);
        }
      }
    }

    // Parse function to AST
    const ast = parser.parse(`(${funcString})`, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy'],
    });

    const responses: ResponseInfo[] = [];
    const variables = new Map<string, VariableInfo>();

    // If source code is provided, try to extract external variable definitions
    if (sourceCode) {
      try {
        const sourceAst = parser.parse(sourceCode, {
          sourceType: 'module',
          plugins: ['typescript', 'decorators-legacy'],
        });

        // First pass: Collect all variable declarations without resolving references
        const variableNodes: Array<{ name: string; init: any }> = [];

        traverse(sourceAst, {
          VariableDeclarator(path: any) {
            const { node } = path;
            if (t.isIdentifier(node.id) && node.init) {
              const varName = node.id.name;
              // Track all variables (not just arrays/objects)
              variableNodes.push({ name: varName, init: node.init });
            }
          },
        });

        // Second pass: Extract data with variable resolution
        for (const { name, init } of variableNodes) {
          const varInfo: VariableInfo = {
            name,
            value: extractDataFromNode(init, variables),
            type: inferTypeFromNode(init, variables),
            schema: generateSchemaFromNode(init, variables),
          };
          variables.set(name, varInfo);
        }
      } catch (err) {
        // Ignore source code parsing errors
      }
    }

    // Traverse AST to find response calls
    traverse(ast, {
      // Track variable declarations and assignments
      VariableDeclarator(path: any) {
        const { node } = path;
        if (t.isIdentifier(node.id) && node.init) {
          const varName = node.id.name;
          const varInfo: VariableInfo = {
            name: varName,
            value: extractDataFromNode(node.init, variables),
            type: inferTypeFromNode(node.init, variables),
            schema: generateSchemaFromNode(node.init, variables),
          };
          variables.set(varName, varInfo);
        }
      },

      // Track assignment expressions (e.g., filteredUsers = ...)
      AssignmentExpression(path: any) {
        const { node } = path;
        if (t.isIdentifier(node.left)) {
          const varName = node.left.name;
          const varInfo: VariableInfo = {
            name: varName,
            value: extractDataFromNode(node.right, variables),
            type: inferTypeFromNode(node.right, variables),
            schema: generateSchemaFromNode(node.right, variables),
          };
          variables.set(varName, varInfo);
        }
      },

      // Find res.json() calls
      CallExpression(path: any) {
        const { node } = path;

        // Check for res.json(data)
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: 'res' }) &&
          t.isIdentifier(node.callee.property, { name: 'json' })
        ) {
          const status = findPreviousStatus(path) || 200;
          const data = node.arguments[0];

          responses.push({
            status,
            data: extractDataFromNode(data, variables),
            schema: generateSchemaFromNode(data, variables),
          });
        }

        // Check for res.status(code).json(data)
        if (
          t.isMemberExpression(node.callee) &&
          t.isCallExpression(node.callee.object) &&
          t.isMemberExpression(node.callee.object.callee) &&
          t.isIdentifier(node.callee.object.callee.object, { name: 'res' }) &&
          t.isIdentifier(node.callee.object.callee.property, { name: 'status' }) &&
          t.isIdentifier(node.callee.property, { name: 'json' })
        ) {
          const statusArg = node.callee.object.arguments[0];
          const status = t.isNumericLiteral(statusArg) ? statusArg.value : 200;
          const data = node.arguments[0];

          responses.push({
            status,
            data: extractDataFromNode(data, variables),
            schema: generateSchemaFromNode(data, variables),
          });
        }

        // Check for res.send()
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: 'res' }) &&
          t.isIdentifier(node.callee.property, { name: 'send' })
        ) {
          const status = findPreviousStatus(path) || 200;

          if (node.arguments.length > 0) {
            const data = node.arguments[0];
            responses.push({
              status,
              data: extractDataFromNode(data),
              schema: generateSchemaFromNode(data),
            });
          }
        }
      },

      // Find return statements with direct objects
      ReturnStatement(path: any) {
        const { node } = path;
        if (node.argument && t.isObjectExpression(node.argument)) {
          responses.push({
            status: 200,
            data: extractDataFromNode(node.argument, variables),
            schema: generateSchemaFromNode(node.argument, variables),
          });
        }
      },
    });

    // Convert to ResponseDef format
    const responseDefs = convertToResponseDefs(responses);

    // If we have example from JSDoc, use it to enhance the detected responses
    if (exampleFromDoc) {
      // Find the success response (usually 200)
      const successKey = Object.keys(responseDefs).find(k => k.startsWith('2')) || '200';

      if (responseDefs[successKey]) {
        const content = responseDefs[successKey].content?.['application/json'];
        if (content) {
          // Generate schema from example
          const schemaFromExample = generateSchemaFromData(exampleFromDoc);

          // Merge schemas (example takes precedence for structure)
          content.schema = mergeSchemas(content.schema, schemaFromExample);
          content.example = exampleFromDoc;
        }
      }
    }

    return responseDefs;
  } catch (error) {
    console.error('Error analyzing handler:', error);
    return getDefaultResponses();
  }
}

/**
 * Find previous res.status() call
 */
function findPreviousStatus(path: any): number | null {
  let currentPath = path;

  while (currentPath) {
    const { node } = currentPath;

    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object, { name: 'res' }) &&
      t.isIdentifier(node.callee.property, { name: 'status' })
    ) {
      const statusArg = node.arguments[0];
      if (t.isNumericLiteral(statusArg)) {
        return statusArg.value;
      }
    }

    currentPath = currentPath.parentPath;
  }

  return null;
}

/**
 * Generate example value from schema
 */
function generateExampleFromSchema(schema: Schema): any {
  if (!schema) return undefined;

  if (schema.example !== undefined) {
    return schema.example;
  }

  switch (schema.type) {
    case 'object':
      const obj: any = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(propSchema);
        }
      }
      return obj;

    case 'array':
      if (schema.items) {
        return [generateExampleFromSchema(schema.items)];
      }
      return [];

    case 'string':
      return 'string';

    case 'integer':
      return 0;

    case 'number':
      return 0.0;

    case 'boolean':
      return true;

    case 'null':
      return null;

    default:
      return undefined;
  }
}

/**
 * Extract data structure from AST node
 */
function extractDataFromNode(node: any, variables?: Map<string, VariableInfo>): any {
  if (!node) return undefined;

  if (t.isObjectExpression(node)) {
    const obj: any = {};
    node.properties.forEach((prop: any) => {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        obj[prop.key.name] = extractDataFromNode(prop.value, variables);
      }
    });
    return obj;
  }

  if (t.isArrayExpression(node)) {
    // Check for spread elements (e.g., [...users])
    if (node.elements.length === 1 && t.isSpreadElement(node.elements[0])) {
      const spreadArg = node.elements[0].argument;
      if (t.isIdentifier(spreadArg)) {
        // Try to resolve the spread source
        if (variables && variables.has(spreadArg.name)) {
          const varInfo = variables.get(spreadArg.name)!;
          if (varInfo.value !== undefined) {
            return varInfo.value;
          }
          // Generate example from schema
          if (varInfo.schema) {
            return generateExampleFromSchema(varInfo.schema);
          }
        }
        // Fallback: return array with empty object
        return [{}];
      }
    }
    return node.elements.map((el: any) => extractDataFromNode(el, variables));
  }

  if (t.isStringLiteral(node)) {
    return node.value;
  }

  if (t.isNumericLiteral(node)) {
    return node.value;
  }

  if (t.isBooleanLiteral(node)) {
    return node.value;
  }

  if (t.isNullLiteral(node)) {
    return null;
  }

  if (t.isIdentifier(node)) {
    // Try to resolve variable reference
    if (variables && variables.has(node.name)) {
      const varInfo = variables.get(node.name)!;
      // If we have a value, return it
      if (varInfo.value !== undefined && typeof varInfo.value !== 'string') {
        return varInfo.value;
      }
      // If we have a schema but no concrete value, generate example from schema
      if (varInfo.schema) {
        return generateExampleFromSchema(varInfo.schema);
      }
    }
    return `<${node.name}>`;
  }

  // Handle member expressions (e.g., filteredUsers.length)
  if (t.isMemberExpression(node)) {
    if (t.isIdentifier(node.object) && t.isIdentifier(node.property)) {
      const objName = node.object.name;
      const propName = node.property.name;

      if (variables && variables.has(objName)) {
        const varInfo = variables.get(objName)!;
        // For arrays, .length should return a number
        if (propName === 'length' && varInfo.type === 'array') {
          return 0;
        }
      }
      return `<${objName}.${propName}>`;
    }
  }

  // Handle common call expressions
  if (t.isCallExpression(node)) {
    // Handle new Date().toISOString()
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property, { name: 'toISOString' }) &&
      t.isNewExpression(node.callee.object) &&
      t.isIdentifier(node.callee.object.callee, { name: 'Date' })
    ) {
      return new Date().toISOString();
    }

    // Handle process.uptime()
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object, { name: 'process' }) &&
      t.isIdentifier(node.callee.property, { name: 'uptime' })
    ) {
      return 0;
    }

    // Handle process.env.X || 'default'
    // This will be handled by LogicalExpression below
  }

  // Handle logical expressions (||, &&)
  if (t.isLogicalExpression(node)) {
    const left = extractDataFromNode(node.left, variables);
    const right = extractDataFromNode(node.right, variables);

    if (node.operator === '||') {
      // Return the right side as default for process.env cases
      return right;
    } else if (node.operator === '&&') {
      // Return the right side for && expressions
      return right;
    }
  }

  return undefined;
}

/**
 * Infer type from AST node
 */
function inferTypeFromNode(node: any, variables?: Map<string, VariableInfo>): string {
  if (t.isArrayExpression(node)) return 'array';
  if (t.isObjectExpression(node)) return 'object';
  if (t.isStringLiteral(node)) return 'string';
  if (t.isNumericLiteral(node)) return 'number';
  if (t.isBooleanLiteral(node)) return 'boolean';
  if (t.isNullLiteral(node)) return 'null';

  // Check for array operations
  if (t.isCallExpression(node)) {
    const callee = node.callee;
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const method = callee.property.name;
      if (['filter', 'map', 'slice', 'concat'].includes(method)) {
        return 'array';
      }
    }
  }

  // Spread of array
  if (t.isSpreadElement(node) || (t.isArrayExpression(node) && node.elements.some((el: any) => t.isSpreadElement(el)))) {
    return 'array';
  }

  // Check if it's a known variable
  if (t.isIdentifier(node) && variables && variables.has(node.name)) {
    const varInfo = variables.get(node.name)!;
    return varInfo.type;
  }

  // Handle common call expressions
  if (t.isCallExpression(node)) {
    const callee = node.callee;

    // new Date().toISOString()
    if (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.property, { name: 'toISOString' })
    ) {
      return 'string';
    }

    // process.uptime()
    if (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object, { name: 'process' }) &&
      t.isIdentifier(callee.property, { name: 'uptime' })
    ) {
      return 'number';
    }
  }

  // Handle logical expressions - infer from right side (default)
  if (t.isLogicalExpression(node)) {
    return inferTypeFromNode(node.right, variables);
  }

  return 'unknown';
}

/**
 * Generate JSON Schema from AST node
 */
function generateSchemaFromNode(node: any, variables?: Map<string, VariableInfo>): Schema {
  if (!node) {
    return { type: 'object' };
  }

  if (t.isObjectExpression(node)) {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    node.properties.forEach((prop: any) => {
      if (t.isObjectProperty(prop)) {
        const keyName = t.isIdentifier(prop.key) ? prop.key.name : 'unknown';
        properties[keyName] = generateSchemaFromNode(prop.value, variables);

        // If value is not optional/nullable, mark as required
        if (!t.isIdentifier(prop.value)) {
          required.push(keyName);
        }
      }
    });

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (t.isArrayExpression(node)) {
    if (node.elements.length > 0) {
      // Check for spread elements (e.g., [...users])
      if (node.elements.length === 1 && t.isSpreadElement(node.elements[0])) {
        const spreadArg = node.elements[0].argument;
        if (t.isIdentifier(spreadArg) && variables && variables.has(spreadArg.name)) {
          const varInfo = variables.get(spreadArg.name)!;
          if (varInfo.schema && varInfo.schema.type === 'array') {
            return varInfo.schema;
          }
        }
      }

      // Get first non-null element for schema inference
      let firstElement = node.elements[0];
      for (const el of node.elements) {
        if (el && !t.isNullLiteral(el) && !t.isSpreadElement(el)) {
          firstElement = el;
          break;
        }
      }

      return {
        type: 'array',
        items: generateSchemaFromNode(firstElement, variables),
      };
    }
    return {
      type: 'array',
      items: { type: 'object' },
    };
  }

  // Handle array operations (filter, map, etc.)
  if (t.isCallExpression(node)) {
    const callee = node.callee;
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const method = callee.property.name;
      if (['filter', 'map', 'slice', 'concat'].includes(method)) {
        // Get the source array
        if (t.isIdentifier(callee.object) && variables && variables.has(callee.object.name)) {
          const varInfo = variables.get(callee.object.name)!;
          if (varInfo.schema && varInfo.schema.type === 'array') {
            // For filter/slice/concat, items remain the same
            if (['filter', 'slice', 'concat'].includes(method)) {
              return varInfo.schema;
            }
            // For map, items might change based on callback
            // For now, return the same schema (could be enhanced later)
            return varInfo.schema;
          }
        }
        // Fallback
        return { type: 'array', items: { type: 'object' } };
      }
    }
  }

  if (t.isStringLiteral(node)) {
    return {
      type: 'string',
      example: node.value,
    };
  }

  if (t.isNumericLiteral(node)) {
    return {
      type: Number.isInteger(node.value) ? 'integer' : 'number',
      example: node.value,
    };
  }

  if (t.isBooleanLiteral(node)) {
    return {
      type: 'boolean',
      example: node.value,
    };
  }

  if (t.isNullLiteral(node)) {
    return {
      type: 'null',
    };
  }

  if (t.isIdentifier(node)) {
    // Try to resolve variable reference first
    if (variables && variables.has(node.name)) {
      const varInfo = variables.get(node.name)!;
      if (varInfo.schema) {
        return varInfo.schema;
      }
    }

    // Fallback: Try to infer type from variable name
    const name = node.name.toLowerCase();

    if (name.includes('users') || name.includes('items') || name.includes('list')) {
      return { type: 'array', items: { type: 'object' } };
    }

    if (name.includes('count') || name.includes('total') || name.includes('id')) {
      return { type: 'integer' };
    }

    if (name.includes('name') || name.includes('email') || name.includes('message')) {
      return { type: 'string' };
    }

    if (name.includes('success') || name.includes('is') || name.includes('has')) {
      return { type: 'boolean' };
    }

    return { type: 'object' };
  }

  // Handle member expressions (e.g., filteredUsers.length)
  if (t.isMemberExpression(node)) {
    if (t.isIdentifier(node.object) && t.isIdentifier(node.property)) {
      const objName = node.object.name;
      const propName = node.property.name;

      if (variables && variables.has(objName)) {
        const varInfo = variables.get(objName)!;
        // For .length on arrays, return integer
        if (propName === 'length' && varInfo.type === 'array') {
          return { type: 'integer', example: 0 };
        }
      }
    }
  }

  // Handle common call expressions
  if (t.isCallExpression(node)) {
    // Handle new Date().toISOString()
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property, { name: 'toISOString' }) &&
      t.isNewExpression(node.callee.object) &&
      t.isIdentifier(node.callee.object.callee, { name: 'Date' })
    ) {
      return { type: 'string', example: new Date().toISOString() };
    }

    // Handle process.uptime()
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object, { name: 'process' }) &&
      t.isIdentifier(node.callee.property, { name: 'uptime' })
    ) {
      return { type: 'number', example: 0 };
    }
  }

  // Handle logical expressions (||, &&)
  if (t.isLogicalExpression(node)) {
    // Return schema from the right side (default value)
    return generateSchemaFromNode(node.right, variables);
  }

  return { type: 'object' };
}

/**
 * Convert ResponseInfo to ResponseDef format
 */
function convertToResponseDefs(responses: ResponseInfo[]): Record<string, ResponseDef> {
  const defs: Record<string, ResponseDef> = {};

  // Group by status code
  responses.forEach(resp => {
    const statusKey = String(resp.status);

    if (!defs[statusKey]) {
      defs[statusKey] = {
        description: getStatusDescription(resp.status),
        content: {
          'application/json': {
            schema: resp.schema || { type: 'object' },
            example: resp.data,
          },
        },
      };
    }
  });

  // Add default responses if none found
  if (Object.keys(defs).length === 0) {
    return getDefaultResponses();
  }

  return defs;
}

/**
 * Get default responses
 */
function getDefaultResponses(): Record<string, ResponseDef> {
  return {
    '200': {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
  };
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
 * Generate JSON Schema from actual data/example
 */
function generateSchemaFromData(data: any): Schema {
  if (data === null) {
    return { type: 'null' };
  }

  if (data === undefined) {
    return { type: 'object' };
  }

  if (Array.isArray(data)) {
    if (data.length > 0) {
      return {
        type: 'array',
        items: generateSchemaFromData(data[0]),
      };
    }
    return {
      type: 'array',
      items: { type: 'object' },
    };
  }

  const dataType = typeof data;

  if (dataType === 'object') {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      properties[key] = generateSchemaFromData(value);
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

  if (dataType === 'string') {
    return { type: 'string', example: data };
  }

  if (dataType === 'number') {
    return {
      type: Number.isInteger(data) ? 'integer' : 'number',
      example: data,
    };
  }

  if (dataType === 'boolean') {
    return { type: 'boolean', example: data };
  }

  return { type: 'object' };
}

/**
 * Merge two schemas, preferring schema2 for structure
 */
function mergeSchemas(schema1: Schema, schema2: Schema): Schema {
  if (!schema1 || !schema2) {
    return schema2 || schema1 || { type: 'object' };
  }

  // If types differ, prefer schema2
  if (schema1.type !== schema2.type) {
    return schema2;
  }

  // For objects, merge properties
  if (schema1.type === 'object' && schema2.type === 'object') {
    const properties: Record<string, Schema> = {
      ...(schema1.properties || {}),
      ...(schema2.properties || {}),
    };

    const required = [
      ...(schema1.required || []),
      ...(schema2.required || []),
    ];

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? [...new Set(required)] : undefined,
    };
  }

  // For arrays, merge item schemas
  if (schema1.type === 'array' && schema2.type === 'array') {
    return {
      type: 'array',
      items: mergeSchemas(schema1.items || { type: 'object' }, schema2.items || { type: 'object' }),
    };
  }

  // For primitives, prefer schema2
  return schema2;
}

/**
 * Analyze request body from handler function
 * Detects properties accessed from req.body or assigned variable
 */
export function analyzeRequestBody(handler: Function, sourceCode?: string): any {
  try {
    // Check if handler has attached request body example
    const requestBodyExample = (handler as any).__bytedocs_request_body;
    if (requestBodyExample) {
      return generateSchemaFromData(requestBodyExample);
    }

    // Parse function to AST
    const funcString = handler.toString();
    const ast = parser.parse(`(${funcString})`, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy'],
    });

    const bodyProperties = new Map<string, { type: string; required: boolean }>();
    let bodyVarName: string | null = null;

    // Traverse AST to find req.body usage
    traverse(ast, {
      VariableDeclarator(path: any) {
        const { node } = path;
        // Pattern: const userData = req.body
        if (
          t.isIdentifier(node.id) &&
          t.isMemberExpression(node.init) &&
          t.isIdentifier(node.init.object, { name: 'req' }) &&
          t.isIdentifier(node.init.property, { name: 'body' })
        ) {
          bodyVarName = node.id.name;
        }
      },

      MemberExpression(path: any) {
        const { node } = path;
        let propName: string | null = null;

        // Pattern 1: req.body.fieldName
        if (
          t.isMemberExpression(node.object) &&
          t.isIdentifier(node.object.object, { name: 'req' }) &&
          t.isIdentifier(node.object.property, { name: 'body' }) &&
          t.isIdentifier(node.property)
        ) {
          propName = node.property.name;
        }

        // Pattern 2: bodyVarName.fieldName
        if (
          bodyVarName &&
          t.isIdentifier(node.object, { name: bodyVarName }) &&
          t.isIdentifier(node.property)
        ) {
          propName = node.property.name;
        }

        if (propName) {
          // Check if this property is used in a validation (indicates required)
          let isRequired = false;
          let parent = path.parentPath;

          // Check for validation patterns like: if (!userData.name)
          if (
            parent &&
            t.isUnaryExpression(parent.node, { operator: '!' }) &&
            parent.parentPath &&
            t.isIfStatement(parent.parentPath.node)
          ) {
            isRequired = true;
          }

          // Check for pattern: userData.name || 'default'
          const inferredType = inferPropertyType(path);

          bodyProperties.set(propName, {
            type: inferredType,
            required: isRequired,
          });
        }
      },

      // Pattern 3: Spread operator (...productData)
      SpreadElement(path: any) {
        const { node } = path;
        if (
          bodyVarName &&
          t.isIdentifier(node.argument, { name: bodyVarName })
        ) {
          // When spreading bodyVarName, mark that we found usage
          // We'll infer all properties from the response structure instead
          // This is a signal that the entire body is used
          bodyProperties.set('__spread__', {
            type: 'object',
            required: false,
          });
        }
      },
    });

    if (bodyProperties.size > 0) {
      // Check if spread operator was used
      if (bodyProperties.has('__spread__')) {
        // Try to infer properties from response structure or source code
        const inferredProperties = inferPropertiesFromCode(ast, bodyVarName, sourceCode);

        if (inferredProperties && Object.keys(inferredProperties).length > 0) {
          return {
            type: 'object',
            properties: inferredProperties,
            description: 'Request body with partial update fields',
          };
        }

        // Fallback: Return generic object schema
        return {
          type: 'object',
          properties: {},
          description: 'Request body with partial update fields',
        };
      }

      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [name, info] of bodyProperties) {
        properties[name] = { type: info.type };
        if (info.required) {
          required.push(name);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    return null;
  } catch (err) {
    console.error('[ByteDocs] Failed to analyze request body:', err);
    return null;
  }
}

/**
 * Infer property type from AST path context
 */
function inferPropertyType(path: any): string {
  // Check if property is used in numeric operation
  const parent = path.parentPath;
  if (parent && t.isBinaryExpression(parent.node)) {
    const op = parent.node.operator;
    if (['+', '-', '*', '/', '%', '>', '<', '>=', '<='].includes(op)) {
      return 'number';
    }
  }

  // Check if property is compared to boolean
  if (parent && t.isBinaryExpression(parent.node)) {
    const { left, right } = parent.node;
    if (t.isBooleanLiteral(left) || t.isBooleanLiteral(right)) {
      return 'boolean';
    }
  }

  // Default to string
  return 'string';
}

/**
 * Infer properties from code when spread operator is used
 * Looks at the response object structure to determine what properties are accepted
 */
function inferPropertiesFromCode(ast: any, bodyVarName: string | null, sourceCode?: string): Record<string, any> | null {
  const properties: Record<string, any> = {};

  if (!bodyVarName) return null;

  try {
    // Strategy: Find the variable that spreads bodyVarName and analyze its properties
    // Example: const updatedProduct = { ...product, ...productData }
    // We want to find what properties 'product' has

    traverse(ast, {
      ObjectExpression(path: any) {
        const { node } = path;
        let hasBodySpread = false;
        let otherSpreadSource: string | null = null;

        // Check if this object has spread of bodyVarName
        for (const prop of node.properties) {
          if (t.isSpreadElement(prop)) {
            if (t.isIdentifier(prop.argument, { name: bodyVarName })) {
              hasBodySpread = true;
            } else if (t.isIdentifier(prop.argument) && 'name' in prop.argument) {
              otherSpreadSource = (prop.argument as any).name;
            }
          }
        }

        // If we found object with both spreads (e.g., { ...product, ...productData })
        // Extract properties from other spread source or from explicit properties
        if (hasBodySpread) {
          for (const prop of node.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              const propName = prop.key.name;
              // Skip meta fields that shouldn't be in request body
              if (!['createdAt', 'updatedAt', 'id'].includes(propName)) {
                properties[propName] = {
                  type: inferTypeFromNode(prop.value, new Map()),
                };
              }
            }
          }
        }
      },
    });

    // If we found some properties, return them
    if (Object.keys(properties).length > 0) {
      return properties;
    }

    // Strategy 2: Look in source code for DTO type or similar structure
    if (sourceCode) {
      const sourceAst = parser.parse(sourceCode, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators-legacy'],
      });

      // Find interface/type definitions that might describe the DTO
      traverse(sourceAst, {
        TSInterfaceDeclaration(path: any) {
          const { node } = path;
          // Look for UpdateXXXDTO, CreateXXXDTO patterns
          if (node.id.name.includes('DTO') || node.id.name.includes('Update')) {
            for (const member of node.body.body) {
              if (t.isTSPropertySignature(member) && t.isIdentifier(member.key)) {
                const propName = member.key.name;
                const optional = member.optional;

                let propType = 'string';
                if (member.typeAnnotation) {
                  const typeNode = member.typeAnnotation.typeAnnotation;
                  if (t.isTSStringKeyword(typeNode)) propType = 'string';
                  else if (t.isTSNumberKeyword(typeNode)) propType = 'number';
                  else if (t.isTSBooleanKeyword(typeNode)) propType = 'boolean';
                }

                properties[propName] = { type: propType };
              }
            }
          }
        },
      });
    }

    return Object.keys(properties).length > 0 ? properties : null;
  } catch (err) {
    console.error('[ByteDocs] Failed to infer properties from code:', err);
    return null;
  }
}

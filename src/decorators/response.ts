/**
 * ByteDocs Express - Response Decorator
 * Attach response examples to handlers
 */

/**
 * Attach response example to handler function
 * @param example - Example response data
 */
export function withExample(example: any) {
  return function (target: any) {
    target.__bytedocs_example = example;
    return target;
  };
}

/**
 * Attach response examples to an existing handler
 * @param handler - Handler function
 * @param example - Example response data
 */
export function attachExample(handler: Function, example: any): Function {
  (handler as any).__bytedocs_example = example;
  return handler;
}

/**
 * Attach request body example to handler function
 * @param handler - Handler function
 * @param example - Example request body data
 */
export function attachRequestBody(handler: Function, example: any): Function {
  (handler as any).__bytedocs_request_body = example;
  return handler;
}

/**
 * Attach both request and response examples to handler
 * @param handler - Handler function
 * @param request - Example request body
 * @param response - Example response data
 */
export function attachExamples(handler: Function, request: any, response: any): Function {
  (handler as any).__bytedocs_request_body = request;
  (handler as any).__bytedocs_example = response;
  return handler;
}

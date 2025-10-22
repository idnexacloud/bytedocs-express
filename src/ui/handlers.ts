/**
 * ByteDocs Express - UI Handlers
 * Handle documentation UI requests
 */

import { Request, Response } from 'express';
import { ByteDocsRequest } from '../core/types';
import { loadTemplate, renderTemplate } from './template-loader';

/**
 * Documentation UI handler
 */
export function createDocsUIHandler(getDocData: () => any, config: any) {
  return (req: ByteDocsRequest, res: Response) => {
    try {
      // Check authentication
      if (config.authConfig?.enabled && !req.byteDocsAuth?.authenticated) {
        return redirectToLogin(req, res, config);
      }

      const template = loadTemplate('template.html');
      const docData = getDocData();

      // Prepare config data for frontend
      const frontendConfig = {
        title: config.title || 'API Documentation',
        version: config.version || '1.0.0',
        description: config.description || '',
        baseUrls: config.baseURLs || (config.baseURL ? [{ name: 'Default', url: config.baseURL }] : []),
      };

      // Replace placeholders with actual data
      let rendered = template;

      // Replace data placeholders
      rendered = rendered.replace(/__BYTEDOCS_API_DATA__/g, JSON.stringify(docData));
      rendered = rendered.replace(/__BYTEDOCS_CONFIG_DATA__/g, JSON.stringify(frontendConfig));
      rendered = rendered.replace(/__BYTEDOCS_TITLE__/g, config.title || 'API Documentation');
      rendered = rendered.replace(/__BYTEDOCS_VERSION__/g, config.version || '1.0.0');
      rendered = rendered.replace(/__BYTEDOCS_DESCRIPTION__/g, config.description || 'Modern API Documentation');

      res.setHeader('Content-Type', 'text/html');
      res.send(rendered);
    } catch (error) {
      console.error('Error rendering docs UI:', error);
      res.status(500).json({ error: 'Failed to render documentation' });
    }
  };
}

/**
 * API data JSON handler
 */
export function createAPIDataHandler(getDocData: () => any, config: any) {
  return (req: ByteDocsRequest, res: Response) => {
    try {
      // Check authentication
      if (config.authConfig?.enabled && !req.byteDocsAuth?.authenticated) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const docData = getDocData();
      res.json(docData);
    } catch (error) {
      console.error('Error getting API data:', error);
      res.status(500).json({ error: 'Failed to get API data' });
    }
  };
}

/**
 * OpenAPI JSON handler
 */
export function createOpenAPIJSONHandler(getOpenAPISpec: () => any, config: any) {
  return (req: ByteDocsRequest, res: Response) => {
    try {
      // Check authentication
      if (config.authConfig?.enabled && !req.byteDocsAuth?.authenticated) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const spec = getOpenAPISpec();
      res.json(spec);
    } catch (error) {
      console.error('Error generating OpenAPI spec:', error);
      res.status(500).json({ error: 'Failed to generate OpenAPI specification' });
    }
  };
}

/**
 * Login page handler
 */
export function createLoginPageHandler(config: any) {
  return (req: ByteDocsRequest, res: Response) => {
    try {
      // If already authenticated, redirect to docs
      if (req.byteDocsAuth?.authenticated) {
        return res.redirect(config.docsPath || '/docs');
      }

      let template = loadTemplate('auth/login.html');
      const error = req.query.error as string;

      // Handle error display
      if (error) {
        template = template.replace('__BYTEDOCS_IF_ERROR__', '');
        template = template.replace('__BYTEDOCS_END_IF__', '');
        template = template.replace(/__BYTEDOCS_ERROR__/g, error);
      } else {
        // Remove error block
        template = template.replace(/__BYTEDOCS_IF_ERROR__[\s\S]*?__BYTEDOCS_END_IF__/g, '');
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      console.error('Error rendering login page:', error);
      res.status(500).send('Failed to render login page');
    }
  };
}

/**
 * Banned page handler
 */
export function createBannedPageHandler(config: any) {
  return (req: ByteDocsRequest, res: Response) => {
    try {
      let template = loadTemplate('auth/banned.html');

      const clientIP = getClientIP(req);
      const banDuration = config.authConfig?.ipBanDuration || 30;
      const maxAttempts = config.authConfig?.ipBanMaxAttempts || 5;

      // Replace placeholders
      template = template.replace(/__BYTEDOCS_CLIENT_IP__/g, clientIP);
      template = template.replace(/__BYTEDOCS_BAN_DURATION__/g, String(banDuration));
      template = template.replace(/__BYTEDOCS_MAX_ATTEMPTS__/g, String(maxAttempts));
      template = template.replace(/__BYTEDOCS_BLOCKED_AT__/g, new Date().toISOString());

      res.status(403);
      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      console.error('Error rendering banned page:', error);
      res.status(500).send('Access denied');
    }
  };
}

/**
 * Config error page handler
 */
export function createConfigErrorPageHandler() {
  return (req: Request, res: Response) => {
    try {
      let template = loadTemplate('auth/config-error.html');

      const errorDetails = [
        'Set BYTEDOCS_AUTH_ENABLED=false to disable authentication',
        'Or set BYTEDOCS_AUTH_PASSWORD=your_password to enable session-based auth',
        'Or configure other auth methods (basic, api_key, bearer)',
      ];

      // Replace placeholders
      template = template.replace(/__BYTEDOCS_ERROR_TITLE__/g, 'Authentication Configuration Error');
      template = template.replace(/__BYTEDOCS_ERROR_MESSAGE__/g, 'Authentication is enabled but not properly configured');

      // Handle error details list
      const detailsHtml = errorDetails.map(detail => `<span class="text-sm">${detail}</span>`).join('');
      template = template.replace(/__BYTEDOCS_RANGE_START__[\s\S]*?__BYTEDOCS_ITEM__[\s\S]*?{{end}}/g, detailsHtml);

      res.status(500);
      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      console.error('Error rendering config error page:', error);
      res.status(500).send('Configuration error');
    }
  };
}

/**
 * Redirect to login page
 */
function redirectToLogin(req: Request, res: Response, config: any): void {
  const loginPath = `${config.docsPath}/login`;
  res.redirect(loginPath);
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (forwarded as string).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

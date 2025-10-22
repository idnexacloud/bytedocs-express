/**
 * ByteDocs Express - Authentication Middleware
 * Based on Bytedocs Golang implementation
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  AuthConfig,
  ByteDocsRequest,
  SessionData,
  IPBanRecord,
} from '../core/types';

/**
 * Session store (in-memory, can be replaced with Redis/database)
 */
const sessions = new Map<string, SessionData>();
const ipBans = new Map<string, IPBanRecord>();

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig) {
  if (!config.enabled) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  switch (config.type) {
    case 'basic':
      return createBasicAuthMiddleware(config);
    case 'api_key':
      return createAPIKeyMiddleware(config);
    case 'bearer':
      return createBearerAuthMiddleware(config);
    case 'session':
    default:
      return createSessionAuthMiddleware(config);
  }
}

/**
 * Basic Authentication Middleware
 */
function createBasicAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="ByteDocs"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (
      constantTimeCompare(username, config.username || '') &&
      constantTimeCompare(password, config.password || '')
    ) {
      (req as ByteDocsRequest).byteDocsAuth = {
        authenticated: true,
        type: 'basic',
      };
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="ByteDocs"');
    return res.status(401).json({ error: 'Invalid credentials' });
  };
}

/**
 * API Key Authentication Middleware
 */
function createAPIKeyMiddleware(config: AuthConfig) {
  const headerName = config.apiKeyHeader || 'X-API-Key';

  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers[headerName.toLowerCase()] as string;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    if (constantTimeCompare(apiKey, config.apiKey || '')) {
      (req as ByteDocsRequest).byteDocsAuth = {
        authenticated: true,
        type: 'api_key',
      };
      return next();
    }

    return res.status(401).json({ error: 'Invalid API key' });
  };
}

/**
 * Bearer Token Authentication Middleware
 */
function createBearerAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Bearer token required' });
    }

    const token = authHeader.split(' ')[1];

    if (constantTimeCompare(token, config.apiKey || '')) {
      (req as ByteDocsRequest).byteDocsAuth = {
        authenticated: true,
        type: 'bearer',
      };
      return next();
    }

    return res.status(401).json({ error: 'Invalid bearer token' });
  };
}

/**
 * Session-based Authentication Middleware (Laravel-style)
 */
function createSessionAuthMiddleware(config: AuthConfig) {
  // Start cleanup interval
  startCleanupInterval();

  return (req: ByteDocsRequest, res: Response, next: NextFunction) => {
    const clientIP = getClientIP(req);

    // Check if IP is whitelisted
    if (config.adminWhitelistIPs?.includes(clientIP)) {
      req.byteDocsAuth = {
        authenticated: true,
        type: 'session',
      };
      return next();
    }

    // Check if IP is banned
    if (config.ipBanEnabled && isIPBanned(clientIP)) {
      const banInfo = ipBans.get(clientIP)!;
      return res.status(403).json({
        error: 'IP address banned',
        bannedUntil: banInfo.expiresAt,
        reason: 'Too many failed authentication attempts',
      });
    }

    // Check session cookie
    const sessionId = req.cookies?.bytedocs_session;

    if (sessionId && isValidSession(sessionId, clientIP)) {
      req.sessionId = sessionId;
      req.byteDocsAuth = {
        authenticated: true,
        type: 'session',
      };
      return next();
    }

    // Not authenticated, allow login page access
    next();
  };
}

/**
 * Login handler for session authentication
 */
export function createLoginHandler(config: AuthConfig) {
  return (req: ByteDocsRequest, res: Response) => {
    const clientIP = getClientIP(req);

    // Check if IP is banned
    if (config.ipBanEnabled && isIPBanned(clientIP)) {
      const banInfo = ipBans.get(clientIP)!;
      const remainingMinutes = Math.ceil(
        (banInfo.expiresAt!.getTime() - Date.now()) / 60000
      );

      return res.status(403).json({
        error: 'IP address banned',
        bannedUntil: banInfo.expiresAt,
        remainingMinutes,
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Verify password
    if (constantTimeCompare(password, config.password || '')) {
      // Clear failed attempts
      ipBans.delete(clientIP);

      // Create session
      const sessionId = generateSessionId();
      const expiresAt = new Date(
        Date.now() + (config.sessionExpire || 1440) * 60 * 1000
      );

      sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date(),
        expiresAt,
        ip: clientIP,
      });

      // Set cookie
      res.cookie('bytedocs_session', sessionId, {
        httpOnly: true,
        secure: req.secure,
        sameSite: 'lax',
        expires: expiresAt,
      });

      return res.json({ success: true });
    }

    // Failed attempt
    if (config.ipBanEnabled) {
      recordFailedAttempt(clientIP, config);

      const banInfo = ipBans.get(clientIP);
      if (banInfo?.bannedAt) {
        return res.status(403).json({
          error: 'Too many failed attempts',
          banned: true,
          bannedUntil: banInfo.expiresAt,
        });
      }
    }

    return res.status(401).json({ error: 'Invalid password' });
  };
}

/**
 * Logout handler for session authentication
 */
export function createLogoutHandler() {
  return (req: ByteDocsRequest, res: Response) => {
    const sessionId = req.cookies?.bytedocs_session;

    if (sessionId) {
      sessions.delete(sessionId);
    }

    res.clearCookie('bytedocs_session');
    return res.json({ success: true });
  };
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (forwarded as string).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

/**
 * Check if session is valid
 */
function isValidSession(sessionId: string, clientIP: string): boolean {
  const session = sessions.get(sessionId);

  if (!session) {
    return false;
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return false;
  }

  // Check IP match (optional, can be disabled for mobile users)
  if (session.ip !== clientIP) {
    return false;
  }

  return true;
}

/**
 * Check if IP is banned
 */
function isIPBanned(ip: string): boolean {
  const banInfo = ipBans.get(ip);

  if (!banInfo || !banInfo.bannedAt) {
    return false;
  }

  // Check if ban has expired
  if (banInfo.expiresAt && banInfo.expiresAt < new Date()) {
    ipBans.delete(ip);
    return false;
  }

  return true;
}

/**
 * Record failed authentication attempt
 */
function recordFailedAttempt(ip: string, config: AuthConfig): void {
  const maxAttempts = config.ipBanMaxAttempts || 5;
  const banDuration = config.ipBanDuration || 30;

  let banInfo = ipBans.get(ip);

  if (!banInfo) {
    banInfo = {
      ip,
      attempts: 0,
    };
    ipBans.set(ip, banInfo);
  }

  banInfo.attempts++;

  // Ban IP if max attempts exceeded
  if (banInfo.attempts >= maxAttempts) {
    banInfo.bannedAt = new Date();
    banInfo.expiresAt = new Date(Date.now() + banDuration * 60 * 1000);
  }
}

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Start cleanup interval for expired sessions and bans
 */
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(() => {
    const now = new Date();

    // Clean expired sessions
    for (const [sessionId, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(sessionId);
      }
    }

    // Clean expired bans
    for (const [ip, banInfo] of ipBans.entries()) {
      if (banInfo.expiresAt && banInfo.expiresAt < now) {
        ipBans.delete(ip);
      }
    }
  }, 60000); // Run every minute
}

/**
 * Stop cleanup interval (for testing)
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all sessions and bans (for testing)
 */
export function clearAuthData(): void {
  sessions.clear();
  ipBans.clear();
}

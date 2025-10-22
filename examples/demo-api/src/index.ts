/**
 * Demo API - Main Application
 *
 * This is a complete Express application demonstrating ByteDocs Express features:
 * - Automatic API documentation generation
 * - JSDoc-based route documentation
 * - Multiple authentication methods
 * - OpenAPI 3.0.3 specification
 * - Beautiful interactive UI
 */

import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import { setupByteDocs } from 'bytedocs-express';
import apiRoutes from './routes';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware
// ============================================================================

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// CORS (for development)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ============================================================================
// Routes
// ============================================================================

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Demo API',
    documentation: '/docs',
    endpoints: {
      health: '/api/health',
      info: '/api/info',
      users: '/api/users',
      products: '/api/products',
    },
  });
});

// API routes
app.use('/api', apiRoutes);

// ============================================================================
// Setup ByteDocs
// ============================================================================

const docs = setupByteDocs(app, {
  // Basic configuration
  title: process.env.BYTEDOCS_TITLE || 'Demo API Documentation',
  version: process.env.BYTEDOCS_VERSION || '1.0.0',
  description: process.env.BYTEDOCS_DESCRIPTION || 'A demo API showcasing ByteDocs Express',

  // Documentation path
  docsPath: process.env.BYTEDOCS_DOCS_PATH || '/docs',

  // Auto-detect routes
  autoDetect: process.env.BYTEDOCS_AUTO_DETECT !== 'false',

  // Exclude internal paths
  excludePaths: ['/favicon.ico'],

  // Multiple base URLs for different environments
  baseURLs: [
    {
      name: 'Production',
      url: process.env.BYTEDOCS_PRODUCTION_URL || 'https://api.example.com'
    },
    {
      name: 'Staging',
      url: process.env.BYTEDOCS_STAGING_URL || 'https://staging-api.example.com'
    },
    {
      name: 'Local',
      url: process.env.BYTEDOCS_LOCAL_URL || `http://localhost:${PORT}`
    },
  ],

  // Authentication configuration (optional)
  authConfig: process.env.BYTEDOCS_AUTH_ENABLED === 'true' ? {
    enabled: true,
    type: 'session',
    password: process.env.BYTEDOCS_AUTH_PASSWORD || 'demo123',
    sessionExpire: parseInt(process.env.BYTEDOCS_AUTH_SESSION_EXPIRE || '1440', 10),
    ipBanEnabled: process.env.BYTEDOCS_AUTH_IP_BAN_ENABLED === 'true',
    ipBanMaxAttempts: parseInt(process.env.BYTEDOCS_AUTH_IP_BAN_MAX_ATTEMPTS || '5', 10),
    ipBanDuration: parseInt(process.env.BYTEDOCS_AUTH_IP_BAN_DURATION || '30', 10),
    adminWhitelistIPs: process.env.BYTEDOCS_AUTH_ADMIN_WHITELIST_IPS?.split(',') || ['127.0.0.1', '::1'],
  } : {
    enabled: false,
  },

  // UI configuration
  uiConfig: {
    theme: (process.env.BYTEDOCS_UI_THEME as any) || 'green',
    darkMode: process.env.BYTEDOCS_UI_DARK_MODE === 'true',
  },

  // AI configuration (for chat assistant)
  aiConfig: process.env.BYTEDOCS_AI_ENABLED === 'true' ? {
    enabled: true,
    provider: (process.env.BYTEDOCS_AI_PROVIDER as any) || 'openrouter',
    apiKey: process.env.BYTEDOCS_AI_API_KEY || '',
    features: {
      chatEnabled: true,
      model: process.env.BYTEDOCS_AI_MODEL || 'anthropic/claude-3.5-sonnet',
      temperature: parseFloat(process.env.BYTEDOCS_AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.BYTEDOCS_AI_MAX_TOKENS || '2000', 10),
    },
  } : undefined,
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 Demo API Server Started!');
  console.log('='.repeat(80));
  console.log(`\n📍 Server:          http://localhost:${PORT}`);
  console.log(`📚 Documentation:   http://localhost:${PORT}/docs`);
  console.log(`📊 OpenAPI Spec:    http://localhost:${PORT}/docs/openapi.json`);
  console.log(`💚 Health Check:    http://localhost:${PORT}/api/health`);

  console.log('\n📋 Available Endpoints:');
  console.log('   GET    /api/health          - Health check');
  console.log('   GET    /api/info            - API information');
  console.log('');
  console.log('   GET    /api/users           - List all users');
  console.log('   GET    /api/users/:id       - Get user by ID');
  console.log('   POST   /api/users           - Create new user');
  console.log('   PUT    /api/users/:id       - Update user');
  console.log('   PATCH  /api/users/:id       - Partially update user');
  console.log('   DELETE /api/users/:id       - Delete user');
  console.log('');
  console.log('   GET    /api/products        - List all products');
  console.log('   GET    /api/products/:id    - Get product by ID');
  console.log('   POST   /api/products        - Create new product');
  console.log('   PUT    /api/products/:id    - Update product');
  console.log('   PATCH  /api/products/:id    - Partially update product');
  console.log('   DELETE /api/products/:id    - Delete product');

  if (process.env.BYTEDOCS_AUTH_ENABLED === 'true') {
    console.log('\n🔐 Authentication:  ENABLED');
    console.log(`   Password:         ${process.env.BYTEDOCS_AUTH_PASSWORD || 'demo123'}`);
    console.log(`   Login URL:        http://localhost:${PORT}/docs/login`);
  } else {
    console.log('\n🔓 Authentication:  DISABLED (Set BYTEDOCS_AUTH_ENABLED=true in .env to enable)');
  }

  console.log('\n' + '='.repeat(80) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

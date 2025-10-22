# ByteDocs for Express

[![npm version](https://img.shields.io/badge/npm-%3E%3D18-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-bytedocs-blue.svg)](https://github.com/aibnuhibban/bytedocs)

**ByteDocs** is a modern alternative to Swagger with better design, auto-detection, and AI integration for Express.js applications. It automatically generates beautiful API documentation from your routes with zero configuration required.

## Features

- 🚀 **Auto Route Detection** - Automatically discovers routes, parameters, and data structures from your Express app
- 🎨 **Beautiful Modern UI** - Clean, responsive interface with dark mode support
- 🤖 **AI Integration** - Built-in AI assistant (OpenAI, Gemini, Claude, OpenRouter) to help users understand your API
- 📱 **Mobile Responsive** - Works perfectly on all device sizes
- 🔍 **Interactive Testing** - Try out endpoints directly from the documentation
- 📊 **OpenAPI Compatible** - Exports standard OpenAPI 3.0.3 specification in JSON and YAML formats
- 🔐 **Built-in Authentication** - Support for Basic Auth, API Key, Bearer Token, and Session authentication
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🔧 **Multi-Framework Support** - Express, and more coming soon (Fastify, Koa, NestJS)
- 🌍 **Environment Config** - Full `.env` file support with validation
- 📝 **JSDoc Support** - Extracts documentation from JSDoc comments

## Quick Start

### 1. Install ByteDocs

```bash
npm install bytedocs-express
```

### 2. Add One Line to Your Code

```javascript
import express from 'express';
import { setupByteDocs } from 'bytedocs-express';

const app = express();
app.use(express.json());

// Your API routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

// Setup ByteDocs - that's it!
setupByteDocs(app, {
  title: 'My API',
  version: '1.0.0',
  description: 'Auto-generated API documentation',
  docsPath: '/docs',
  autoDetect: true,
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Docs available at http://localhost:3000/docs');
});
```

### 3. Visit Your Documentation

Open http://localhost:3000/docs and enjoy your auto-generated API documentation!

## API Endpoints

Once installed, ByteDocs provides these endpoints:

- `GET /docs` - Main documentation interface with beautiful UI
- `GET /docs/api-data.json` - Raw documentation data
- `GET /docs/openapi.json` - OpenAPI 3.0.3 specification (JSON format)
- `GET /docs/openapi.yaml` - OpenAPI 3.0.3 specification (YAML format)
- `POST /docs/chat` - AI chat endpoint (if AI is enabled)
- `GET /docs/login` - Login page (if session auth enabled)
- `POST /docs/login` - Login handler (if session auth enabled)
- `POST /docs/logout` - Logout handler (if session auth enabled)

## Configuration

### Basic Configuration

```javascript
setupByteDocs(app, {
  title: 'My API Documentation',
  version: '1.0.0',
  description: 'Comprehensive API for my application',
  docsPath: '/docs',
  autoDetect: true,

  baseURLs: [
    { name: 'Production', url: 'https://api.myapp.com' },
    { name: 'Staging', url: 'https://staging-api.myapp.com' },
    { name: 'Local', url: 'http://localhost:3000' },
  ],
});
```

### AI Integration

Enable AI assistance for your API documentation:

```javascript
setupByteDocs(app, {
  title: 'My API',
  version: '1.0.0',
  aiConfig: {
    enabled: true,
    provider: 'openai', // openai, gemini, claude, openrouter
    apiKey: process.env.OPENAI_API_KEY,
    features: {
      chatEnabled: true,
      docGenerationEnabled: false,
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.7,
    },
  },
});
```

**Supported AI Providers:**

### OpenAI
```javascript
aiConfig: {
  enabled: true,
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  features: {
    model: 'gpt-4o-mini', // or gpt-4, gpt-3.5-turbo
  },
}
```

### Google Gemini
```javascript
aiConfig: {
  enabled: true,
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  features: {
    model: 'gemini-1.5-flash', // or gemini-1.5-pro
  },
}
```

### Anthropic Claude
```javascript
aiConfig: {
  enabled: true,
  provider: 'claude',
  apiKey: process.env.ANTHROPIC_API_KEY,
  features: {
    model: 'claude-3-sonnet-20240229',
  },
}
```

### OpenRouter
```javascript
aiConfig: {
  enabled: true,
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  features: {
    model: 'openai/gpt-4o-mini', // Any OpenRouter model
  },
}
```

### Authentication

Protect your documentation with built-in authentication:

```javascript
setupByteDocs(app, {
  title: 'My API',
  version: '1.0.0',
  authConfig: {
    enabled: true,
    type: 'session', // basic, api_key, bearer, session
    username: 'admin',
    password: 'secret',
    realm: 'API Documentation',

    // Session-specific settings
    sessionExpire: 1440, // minutes
    ipBanEnabled: true,
    ipBanMaxAttempts: 5,
    ipBanDuration: 60, // minutes
    adminWhitelistIPs: ['127.0.0.1', '::1'],
  },
});
```

**Authentication Types:**
- `basic` - HTTP Basic Authentication
- `api_key` - API Key authentication via custom header
- `bearer` - Bearer token authentication
- `session` - Session-based authentication with login page

### Environment Configuration

Create a `.env` file for easy configuration:

```bash
# Basic Settings
BYTEDOCS_TITLE="My API Documentation"
BYTEDOCS_VERSION="1.0.0"
BYTEDOCS_DESCRIPTION="Comprehensive API for my application"
BYTEDOCS_DOCS_PATH="/docs"
BYTEDOCS_AUTO_DETECT=true

# Multiple Environment URLs
BYTEDOCS_PRODUCTION_URL="https://api.myapp.com"
BYTEDOCS_STAGING_URL="https://staging-api.myapp.com"
BYTEDOCS_LOCAL_URL="http://localhost:3000"

# Authentication
BYTEDOCS_AUTH_ENABLED=true
BYTEDOCS_AUTH_TYPE=session
BYTEDOCS_AUTH_USERNAME=admin
BYTEDOCS_AUTH_PASSWORD=your-secret-password
BYTEDOCS_AUTH_SESSION_EXPIRE=1440
BYTEDOCS_AUTH_IP_BAN_ENABLED=true
BYTEDOCS_AUTH_IP_BAN_MAX_ATTEMPTS=5
BYTEDOCS_AUTH_IP_BAN_DURATION=60
BYTEDOCS_AUTH_ADMIN_WHITELIST_IPS=127.0.0.1,::1

# AI Configuration
BYTEDOCS_AI_ENABLED=true
BYTEDOCS_AI_PROVIDER=openai
BYTEDOCS_AI_API_KEY=sk-your-openai-key
BYTEDOCS_AI_MODEL=gpt-4o-mini
BYTEDOCS_AI_MAX_TOKENS=1000
BYTEDOCS_AI_TEMPERATURE=0.7

# UI Customization
BYTEDOCS_UI_THEME=auto
BYTEDOCS_UI_SHOW_TRY_IT=true
BYTEDOCS_UI_SHOW_SCHEMAS=true
```

Then load it in your code:
```javascript
import { loadConfigFromEnv, validateConfig } from 'bytedocs-express';

const config = loadConfigFromEnv();

// Validate configuration
const errors = validateConfig(config);
if (errors.length > 0) {
  console.error('Configuration errors:', errors);
  process.exit(1);
}

setupByteDocs(app, config);
```

## Framework Support

ByteDocs currently supports Express with more frameworks coming soon:

### Express
```javascript
import express from 'express';
import { setupByteDocs } from 'bytedocs-express';

const app = express();
setupByteDocs(app, config);
```

### Coming Soon
- Fastify
- Koa
- NestJS
- Hono

## JSDoc Annotations

Enhance your documentation with JSDoc comments:

```javascript
/**
 * Get user by ID
 * @summary Retrieve a specific user
 * @tag Users
 * @param id path string true "User ID to retrieve"
 * @response 200 {object} User "User object"
 * @response 404 {object} Error "User not found"
 */
app.get('/api/users/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

/**
 * Create a new user
 * @summary Create user
 * @tag Users
 * @description Creates a new user with the provided information
 * @body {object} UserInput "User data"
 * @response 201 {object} User "Created user"
 */
app.post('/api/users', (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

## Advanced Usage

### Manual Route Registration

```javascript
import { ByteDocs } from 'bytedocs-express';

const docs = new ByteDocs({
  title: 'My API',
  version: '1.0.0',
});

// Manually add route information
docs.addRoute({
  method: 'GET',
  path: '/api/custom-endpoint',
  summary: 'Custom endpoint',
  description: 'This is a manually registered endpoint',
  parameters: [
    {
      name: 'id',
      in: 'path',
      type: 'integer',
      required: true,
      description: 'Record ID',
    },
  ],
});

// Generate documentation
docs.generate();
```

### Export OpenAPI Specifications

```javascript
// Get OpenAPI JSON
const openAPIJSON = docs.getOpenAPIJSON();

// Get OpenAPI YAML
const openAPIYAML = docs.getOpenAPIYAML();

// Save to file
import fs from 'fs';
fs.writeFileSync('openapi.yaml', openAPIYAML);
```

## Requirements

- Node.js 18 or higher
- Express 4.x or higher

## Development

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Build from Source

```bash
# Clone the repository
git clone https://github.com/aibnuhibban/bytedocs-node.git
cd bytedocs-node/express

# Install dependencies
npm install

# Build the package
npm run build

# Run example
npm run example
# Visit http://localhost:3000/docs
```

### Development Mode

```bash
# Start development server with hot reload
npm run dev
```

### Available Commands

```bash
npm run build      # Build the package
npm run dev        # Development mode with hot reload
npm test           # Run tests
npm run lint       # Lint code
npm run example    # Run example server
```

## Project Structure

```
bytedocs-express/
  src/
    core/              # Core functionality
    parser/            # Route parser
    ai/                # AI/LLM integration
    auth/              # Authentication middleware
    ui/                # Web UI components
  examples/            # Example applications
    basic/
    with-auth/
    with-ai/
  dist/                # Built files
  tests/               # Test files
```

## Examples

Check out the `examples/` directory for complete implementations:

- **Basic**: `examples/basic/` - Simple setup without authentication
- **With Auth**: `examples/with-auth/` - Session-based authentication example
- **With AI**: `examples/with-ai/` - AI integration example
- **Advanced**: `examples/advanced/` - Full-featured example with all options

Each example demonstrates:
- Basic setup and configuration
- Route auto-detection
- AI integration (optional)
- Authentication setup
- Custom documentation
- JSDoc annotations

To run examples:

```bash
# Install dependencies
npm install

# Run basic example
npm run example:basic

# Run with authentication
npm run example:auth

# Run with AI
npm run example:ai
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Run `npm test` to ensure everything works
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/aibnuhibban/bytedocs)
- 🐛 [Report Issues](https://github.com/aibnuhibban/bytedocs-node/issues)
- 💬 [GitHub Discussions](https://github.com/aibnuhibban/bytedocs/discussions)

## Credits

- Inspired by [Scramble for Laravel](https://scramble.dedoc.co/)
- Part of the ByteDocs project
- UI based on modern React and Tailwind CSS

---

**Made with ❤️ for the Express community**

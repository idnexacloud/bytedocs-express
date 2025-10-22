# Contributing to ByteDocs Express

Thank you for your interest in contributing to ByteDocs Express! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bytedocs-express.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development

### Project Structure

```
bytedocs-express/
├── src/
│   ├── core/          # Core documentation engine
│   ├── parser/        # Route analyzer and detector
│   ├── auth/          # Authentication middleware
│   ├── ui/            # UI handlers and templates
│   ├── ai/            # AI integration (future)
│   ├── llm/           # LLM clients (future)
│   └── index.ts       # Main entry point
├── examples/          # Example applications
├── dist/              # Compiled output
└── README.md
```

### Build Commands

```bash
# Development mode (watch for changes)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run example
npm run example
```

### Coding Standards

- Use TypeScript for all new code
- Follow the existing code style
- Write JSDoc comments for public APIs
- Add tests for new features
- Update documentation as needed

### Testing

Before submitting a PR, make sure:

1. Your code compiles without errors: `npm run build`
2. All tests pass: `npm test`
3. Examples still work: `npm run example`

## Submitting Changes

1. Commit your changes with clear, descriptive messages
2. Push to your fork: `git push origin feature/your-feature-name`
3. Create a Pull Request on GitHub
4. Describe your changes and why they're needed
5. Reference any related issues

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation for new features
- Add tests for bug fixes and new features
- Ensure CI passes before requesting review
- Be responsive to feedback

## Feature Requests

Feature requests are welcome! Please:

1. Check if the feature already exists or is planned
2. Open an issue describing the feature
3. Explain the use case and benefits
4. Be open to discussion and feedback

## Bug Reports

When reporting bugs, please include:

1. Clear description of the issue
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment details (OS, Node version, etc.)
6. Relevant code snippets or logs

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what's best for the community
- Show empathy towards others

## Questions?

If you have questions, feel free to:

- Open an issue for discussion
- Reach out to maintainers
- Check existing issues and documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to ByteDocs Express!

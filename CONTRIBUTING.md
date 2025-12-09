# Contributing to D365 BC Admin MCP Extension

Thank you for your interest in contributing to the D365 BC Admin MCP Extension! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites
- Node.js (version 16 or higher)
- npm
- Visual Studio Code
- Git

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/D365BCAdminMCPExtension.git
   cd D365BCAdminMCPExtension
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Open in VS Code**:
   ```bash
   code .
   ```

5. **Compile the extension**:
   ```bash
   npm run compile
   ```

6. **Test the extension**:
   - Press `F5` to launch the Extension Development Host
   - Test your changes in the new VS Code window

## Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Test thoroughly**:
   - Run the extension in development mode
   - Test all commands and functionality
   - Check for any errors in the console

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add: Brief description of your changes"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

### Coding Standards

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow the existing code style and formatting
- Ensure all code compiles without errors

### Commit Message Format

Use clear, descriptive commit messages:
- `Add: New feature description`
- `Fix: Bug fix description`
- `Update: Update existing functionality`
- `Docs: Documentation changes`

### Testing

- Test all extension commands
- Verify error handling works correctly
- Test on different platforms if possible
- Ensure the extension doesn't break existing functionality

## Reporting Issues

When reporting bugs or requesting features:

1. **Check existing issues** first to avoid duplicates
2. **Use issue templates** when available
3. **Provide detailed information**:
   - VS Code version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages or logs

## Pull Request Guidelines

- **Keep PRs focused** - One feature or fix per PR
- **Update documentation** if needed
- **Add tests** for new functionality
- **Ensure CI passes** before requesting review
- **Provide clear description** of changes

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. By participating, you agree to:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept responsibility for mistakes
- Show empathy towards other contributors

## License

By contributing to this project, you agree that your contributions will be licensed under the same MIT License that covers the project.

## Questions?

If you have questions about contributing, feel free to:

- Open a GitHub issue with your question
- Check the documentation in the README
- Review existing issues and discussions

Thank you for contributing to the D365 BC Admin MCP Extension! 🎉

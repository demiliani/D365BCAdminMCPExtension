# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-01-14

### Added
- Initial release of D365 BC Admin MCP Extension
- Automatic installation and configuration of D365 BC Admin MCP server
- GitHub Copilot integration for Business Central administration
- Status bar indicator for MCP server status
- Comprehensive diagnostics and troubleshooting tools
- Quick start guide after successful installation
- Support for both global and workspace-specific configurations

### Features
- Prerequisites checking (Node.js and npm)
- One-click MCP server installation via npm
- Automatic GitHub Copilot MCP configuration
- Real-time installation progress feedback
- Status monitoring and health checks
- Comprehensive error handling and user notifications
- Output channels for detailed logs

### Commands
- `Install D365 BC Admin MCP Server` - Install and configure the MCP server
- `Uninstall D365 BC Admin MCP Server` - Remove the MCP server and clean up configuration
- `Check MCP Server Status` - Verify installation and configuration status
- `Show System Diagnostics` - Display detailed system and extension information

### Configuration
- `d365bc-admin-mcp.settingsScope` - Choose global or workspace configuration
- `d365bc-admin-mcp.autoInstall` - Enable/disable automatic installation on activation

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.8] - 2025-12-11

### Fixed
- Update command now automatically kills all D365BCAdminMCP processes before updating
- Prevents file lock errors during npm package updates
- Removed user prompt and made process termination automatic for smoother updates

## [1.1.7] - 2025-12-11

### Changed
- Changed to synchronous process cleanup to ensure MCP processes are killed before VS Code exits
- Prevents async cleanup from being interrupted when VS Code closes
- Guarantees zombie process cleanup completes even during rapid shutdown
- Enhanced MCP server detection using npm list check first to avoid unnecessary process spawning
- Fixed false negative installation checks that caused repeated installation prompts

## [1.1.1] - 2025-12-10

### Added
- Full per tenant extensions (PTE) management

### Fixed
- Fixed MCP server detection to prevent continuous installation prompts when server is already installed
- Improved cross-platform executable path resolution for npm global packages
- Enhanced reliability of installation status checks on Windows systems

## [1.0.2] - 2025-11-25

### Fixed
- Fixed EBUSY error when installing/updating while MCP server process is running
- Added installation lock mechanism to prevent concurrent install/update operations
- Added automatic detection and prompt to stop running MCP server processes before operations
- Added debounce for auto-install to prevent multiple triggers during VS Code startup

### Added
- Process detection for running MCP server (Windows: D365BCAdminMCP.exe, macOS/Linux: d365bc-admin-mcp)
- User confirmation dialog before stopping running MCP server processes
- Installation lock timeout (5 minutes) to handle stale locks

## [1.0.0] - 2025-11-14

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

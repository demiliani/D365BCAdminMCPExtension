# D365 BC Admin MCP Extension

A Visual Studio Code extension that automatically installs and configures the Dynamics 365 Business Central Admin MCP server for GitHub Copilot integration.

## Features

### Core Functionality
- **Automatic Installation**: Automatically install the D365 BC Admin MCP server via npm
- **GitHub Copilot Integration**: Seamlessly configure MCP settings for GitHub Copilot
- **Prerequisites Checking**: Verify Node.js and npm installation before proceeding
- **Status Monitoring**: Real-time status indication in the status bar

### Commands
- `Install D365 BC Admin MCP Server` - Install and configure the MCP server
- `Uninstall D365 BC Admin MCP Server` - Remove the MCP server and clean up configuration
- `Check MCP Server Status` - Verify installation and configuration status
- `Show System Diagnostics` - Display detailed system and extension information

### Configuration Options
- **Settings Scope**: Choose between global or workspace-specific configuration
- **Auto-install**: Enable/disable automatic installation on extension activation

### Additional Features
- **Status Bar Integration**: Visual indicator of MCP server status
- **Progress Notifications**: Real-time feedback during installation/uninstallation
- **Quick Start Guide**: Welcome guide after successful installation
- **Comprehensive Diagnostics**: Detailed system information and troubleshooting
- **Output Channels**: Dedicated output channels for installation logs and diagnostics

## Requirements

- Visual Studio Code 1.74.0 or higher
- Node.js (any recent version)
- npm (comes with Node.js)
- Internet connection for npm package installation

## Installation

1. Install this extension from the VS Code Marketplace
2. The extension will automatically activate and check for prerequisites
3. If auto-install is enabled, it will prompt to install the MCP server
4. Alternatively, use the command palette to run "Install D365 BC Admin MCP Server"

## Configuration

### Settings

Access these settings through VS Code's settings UI or by editing `settings.json`:

```json
{
  "d365bc-admin-mcp.settingsScope": "global",
  "d365bc-admin-mcp.autoInstall": true
}
```

### GitHub Copilot MCP Configuration

The extension automatically adds this configuration to your GitHub Copilot settings:

```json
{
  "github.copilot.mcp": {
    "d365bc-admin": {
      "command": "d365bc-admin-mcp"
    }
  }
}
```

## Usage

### First Time Setup

1. After installation, restart VS Code to ensure MCP configuration takes effect
2. Check the status bar for the MCP server status indicator
3. Use "Check MCP Server Status" command to verify everything is working

### Daily Usage

- The status bar will show the current MCP server status
- Use the command palette for any management operations
- Check diagnostics if you encounter any issues

### Troubleshooting

1. **Prerequisites Issues**: Run "Show System Diagnostics" to check Node.js and npm
2. **Installation Failures**: Check the "D365 BC Admin MCP Installation" output channel
3. **Configuration Issues**: Use "Check MCP Server Status" to verify settings
4. **Permission Issues**: Ensure npm has sufficient permissions for global installations

## Architecture

### Extension Components

```
src/
├── extension.ts          # Main extension logic
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.json        # ESLint configuration
└── .vscode/              # Development configuration
    ├── launch.json
    └── tasks.json
```

### MCP Server Integration

The extension integrates with the `@demiliani/d365bc-admin-mcp` npm package, which provides:

- Business Central environment management
- App lifecycle operations (install, update, uninstall)
- Environment operations (create, copy, update)
- Notification recipient management
- Storage usage monitoring
- Session management

## Development

### Prerequisites

```bash
npm install
```

### Building

```bash
npm run compile
```

### Testing

```bash
npm run test
```

### Debugging

1. Open the project in VS Code
2. Press F5 to launch the extension development host
3. Test the extension in the new window

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This extension is licensed under the MIT License.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the output channels for error messages
3. Run diagnostics and include the output when reporting issues
4. Check the GitHub repository for known issues

## Changelog

### 1.0.0
- Initial release
- Automatic MCP server installation
- GitHub Copilot configuration
- Status bar integration
- Comprehensive diagnostics
- Quick start guide

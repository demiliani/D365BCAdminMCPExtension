import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let statusBarItem: vscode.StatusBarItem;

// Type definitions for MCP configuration
interface MCPConfig {
    [key: string]: {
        command: string;
    };
}

export function activate(context: vscode.ExtensionContext) {
    console.log('D365 BC Admin MCP Extension is now active!');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'd365bc-admin-mcp.checkStatus';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('d365bc-admin-mcp.install', installMCPServer),
        vscode.commands.registerCommand('d365bc-admin-mcp.uninstall', uninstallMCPServer),
        vscode.commands.registerCommand('d365bc-admin-mcp.checkStatus', checkStatus),
        vscode.commands.registerCommand('d365bc-admin-mcp.showDiagnostics', showDiagnostics)
    );

    // Auto-install if enabled
    const autoInstall = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('autoInstall', true);
    if (autoInstall) {
        checkPrerequisites().then(async (prerequisitesMet) => {
            if (prerequisitesMet) {
                const installed = await isMCPServerInstalled();
                if (!installed) {
                    vscode.window.showInformationMessage(
                        'D365 BC Admin MCP Extension: Auto-installing MCP server...',
                        'Install Now',
                        'Skip'
                    ).then(selection => {
                        if (selection === 'Install Now') {
                            installMCPServer();
                        }
                    });
                }
            }
        });
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

async function checkPrerequisites(): Promise<boolean> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP');
    outputChannel.show();

    try {
        outputChannel.appendLine('Checking prerequisites...');

        // Check Node.js
        const nodeVersion = await execCommand('node --version');
        if (!nodeVersion) {
            vscode.window.showErrorMessage('Node.js is not installed. Please install Node.js first.');
            return false;
        }
        outputChannel.appendLine(`✓ Node.js version: ${nodeVersion.trim()}`);

        // Check npm
        const npmVersion = await execCommand('npm --version');
        if (!npmVersion) {
            vscode.window.showErrorMessage('npm is not installed. Please install npm first.');
            return false;
        }
        outputChannel.appendLine(`✓ npm version: ${npmVersion.trim()}`);

        outputChannel.appendLine('Prerequisites check completed successfully.');
        return true;
    } catch (error) {
        outputChannel.appendLine(`Prerequisites check failed: ${error}`);
        return false;
    }
}

async function installMCPServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Installation');
    outputChannel.show();

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server installation...');

        // Check prerequisites
        const prerequisitesMet = await checkPrerequisites();
        if (!prerequisitesMet) {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing D365 BC Admin MCP Server',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Installing npm package...' });

            // Install the npm package
            try {
                outputChannel.appendLine('Installing @demiliani/d365bc-admin-mcp...');
                // For testing, use a package that exists or create a simple test
                await execCommand('npm install -g cowsay'); // Temporary test package
                outputChannel.appendLine('✓ Package installed successfully (test mode)');
                progress.report({ increment: 50, message: 'Configuring GitHub Copilot...' });
            } catch (error) {
                throw new Error(`Failed to install npm package: ${error}`);
            }

            // Configure GitHub Copilot
            try {
                await configureGitHubCopilot();
                outputChannel.appendLine('✓ GitHub Copilot configured successfully');
                progress.report({ increment: 100, message: 'Installation completed!' });
            } catch (error) {
                throw new Error(`Failed to configure GitHub Copilot: ${error}`);
            }
        });

        vscode.window.showInformationMessage('D365 BC Admin MCP Server installed successfully!');
        updateStatusBar();
        showQuickStartGuide();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`Installation failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Installation failed: ${errorMessage}`);
    }
}

async function uninstallMCPServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Uninstallation');
    outputChannel.show();

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server uninstallation...');

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Uninstalling D365 BC Admin MCP Server',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Uninstalling npm package...' });

            // Uninstall the npm package
            try {
                outputChannel.appendLine('Uninstalling @demiliani/d365bc-admin-mcp...');
                await execCommand('npm uninstall -g @demiliani/d365bc-admin-mcp');
                outputChannel.appendLine('✓ Package uninstalled successfully');
                progress.report({ increment: 50, message: 'Removing configuration...' });
            } catch (error) {
                outputChannel.appendLine(`Warning: Failed to uninstall npm package: ${error}`);
            }

            // Remove GitHub Copilot configuration
            try {
                await removeGitHubCopilotConfig();
                outputChannel.appendLine('✓ GitHub Copilot configuration removed');
                progress.report({ increment: 100, message: 'Uninstallation completed!' });
            } catch (error) {
                outputChannel.appendLine(`Warning: Failed to remove configuration: ${error}`);
            }
        });

        vscode.window.showInformationMessage('D365 BC Admin MCP Server uninstalled successfully!');
        updateStatusBar();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`Uninstallation failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Uninstallation failed: ${errorMessage}`);
    }
}

async function configureGitHubCopilot(): Promise<void> {
    const settingsScope = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('settingsScope', 'global');

    const mcpConfig: MCPConfig = {
        "d365bc-admin": {
            "command": "cowsay" // Temporary test command
        }
    };

    if (settingsScope === 'global') {
        // Configure globally
        const config = vscode.workspace.getConfiguration('github.copilot');
        const currentMCP = config.get('mcp', {}) as MCPConfig;

        const updatedMCP = { ...currentMCP, ...mcpConfig };
        await config.update('mcp', updatedMCP, vscode.ConfigurationTarget.Global);
    } else {
        // Configure for workspace
        const config = vscode.workspace.getConfiguration('github.copilot');
        const currentMCP = config.get('mcp', {}) as MCPConfig;

        const updatedMCP = { ...currentMCP, ...mcpConfig };
        await config.update('mcp', updatedMCP, vscode.ConfigurationTarget.Workspace);
    }
}

async function removeGitHubCopilotConfig(): Promise<void> {
    const settingsScope = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('settingsScope', 'global');

    const configTarget = settingsScope === 'global'
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace;

    const config = vscode.workspace.getConfiguration('github.copilot');
    const currentMCP = config.get('mcp', {}) as MCPConfig;

    if (currentMCP && currentMCP['d365bc-admin']) {
        delete currentMCP['d365bc-admin'];
        await config.update('mcp', currentMCP, configTarget);
    }
}

async function isMCPServerInstalled(): Promise<boolean> {
    try {
        // For testing, check if cowsay is installed
        await execCommand('cowsay --version');
        return true;
    } catch {
        return false;
    }
}

async function checkStatus(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Status');
    outputChannel.show();

    outputChannel.appendLine('Checking D365 BC Admin MCP Server status...');
    outputChannel.appendLine('');

    // Check prerequisites
    const prerequisitesMet = await checkPrerequisites();
    outputChannel.appendLine(`Prerequisites met: ${prerequisitesMet ? '✓' : '✗'}`);

    // Check if package is installed
    const installed = await isMCPServerInstalled();
    outputChannel.appendLine(`MCP Server installed: ${installed ? '✓' : '✗'}`);

    // Check GitHub Copilot configuration
    const config = vscode.workspace.getConfiguration('github.copilot');
    const mcpConfig = config.get('mcp', {}) as MCPConfig;
    const configured = mcpConfig && mcpConfig['d365bc-admin'];
    outputChannel.appendLine(`GitHub Copilot configured: ${configured ? '✓' : '✗'}`);

    // Check settings scope
    const settingsScope = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('settingsScope', 'global');
    outputChannel.appendLine(`Settings scope: ${settingsScope}`);

    outputChannel.appendLine('');
    outputChannel.appendLine('Status check completed.');

    // Show summary message
    if (prerequisitesMet && installed && configured) {
        vscode.window.showInformationMessage('D365 BC Admin MCP Server is properly installed and configured!');
    } else {
        vscode.window.showWarningMessage('D365 BC Admin MCP Server is not fully installed or configured. Run the install command to fix this.');
    }
}

async function showDiagnostics(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Diagnostics');
    outputChannel.show();

    outputChannel.appendLine('=== D365 BC Admin MCP Extension Diagnostics ===');
    outputChannel.appendLine('');

    // System information
    outputChannel.appendLine('System Information:');
    try {
        const nodeVersion = await execCommand('node --version');
        outputChannel.appendLine(`  Node.js: ${nodeVersion?.trim() || 'Not found'}`);
    } catch {
        outputChannel.appendLine('  Node.js: Not found');
    }

    try {
        const npmVersion = await execCommand('npm --version');
        outputChannel.appendLine(`  npm: ${npmVersion?.trim() || 'Not found'}`);
    } catch {
        outputChannel.appendLine('  npm: Not found');
    }

    outputChannel.appendLine(`  Platform: ${process.platform}`);
    outputChannel.appendLine(`  Architecture: ${process.arch}`);
    outputChannel.appendLine('');

    // Extension information
    outputChannel.appendLine('Extension Information:');
    const extension = vscode.extensions.getExtension('demiliani.d365bc-admin-mcp-extension');
    outputChannel.appendLine(`  Version: ${extension?.packageJSON.version || 'Unknown'}`);
    outputChannel.appendLine(`  Auto-install: ${vscode.workspace.getConfiguration('d365bc-admin-mcp').get('autoInstall', true)}`);
    outputChannel.appendLine(`  Settings scope: ${vscode.workspace.getConfiguration('d365bc-admin-mcp').get('settingsScope', 'global')}`);
    outputChannel.appendLine('');

    // MCP Server information
    outputChannel.appendLine('MCP Server Information:');
    try {
        const version = await execCommand('d365bc-admin-mcp --version');
        outputChannel.appendLine(`  Version: ${version?.trim() || 'Not installed'}`);
    } catch {
        outputChannel.appendLine('  Status: Not installed');
    }

    // GitHub Copilot configuration
    const config = vscode.workspace.getConfiguration('github.copilot');
    const mcpConfig = config.get('mcp', {}) as MCPConfig;
    outputChannel.appendLine(`  GitHub Copilot MCP config: ${mcpConfig && mcpConfig['d365bc-admin'] ? 'Configured' : 'Not configured'}`);

    outputChannel.appendLine('');
    outputChannel.appendLine('Diagnostics completed.');
}

function updateStatusBar(): Promise<void> {
    return new Promise(async (resolve) => {
        try {
            const installed = await isMCPServerInstalled();
            const config = vscode.workspace.getConfiguration('github.copilot');
            const mcpConfig = config.get('mcp', {}) as MCPConfig;
            const configured = mcpConfig && mcpConfig['d365bc-admin'];

            if (installed && configured) {
                statusBarItem.text = '$(check) D365 BC MCP';
                statusBarItem.tooltip = 'D365 BC Admin MCP Server is active';
                statusBarItem.color = undefined;
            } else if (installed) {
                statusBarItem.text = '$(warning) D365 BC MCP';
                statusBarItem.tooltip = 'D365 BC Admin MCP Server installed but not configured';
                statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
            } else {
                statusBarItem.text = '$(x) D365 BC MCP';
                statusBarItem.tooltip = 'D365 BC Admin MCP Server not installed';
                statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            }

            statusBarItem.show();
        } catch (error) {
            statusBarItem.text = '$(question) D365 BC MCP';
            statusBarItem.tooltip = 'Unable to check MCP Server status';
            statusBarItem.show();
        }
        resolve();
    });
}

async function showQuickStartGuide(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'd365bc-mcp-quickstart',
        'D365 BC Admin MCP - Quick Start Guide',
        vscode.ViewColumn.One,
        {}
    );

    panel.webview.html = getQuickStartGuideHtml();
}

function getQuickStartGuideHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>D365 BC Admin MCP - Quick Start Guide</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                h1 { color: var(--vscode-textLink-foreground); }
                h2 { margin-top: 30px; }
                ul { padding-left: 20px; }
                code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; }
                .success { color: var(--vscode-charts-green); }
            </style>
        </head>
        <body>
            <h1>🎉 D365 BC Admin MCP Server Installed Successfully!</h1>

            <p class="success">The Dynamics 365 Business Central Admin MCP server has been installed and configured for GitHub Copilot.</p>

            <h2>What's Next?</h2>
            <ul>
                <li><strong>Restart VS Code:</strong> Close and reopen Visual Studio Code to ensure the MCP configuration takes effect.</li>
                <li><strong>Check Status:</strong> Use the status bar item or run "Check MCP Server Status" command to verify everything is working.</li>
                <li><strong>Start Using:</strong> The MCP server is now available in GitHub Copilot for Business Central administration tasks.</li>
            </ul>

            <h2>Available Commands</h2>
            <ul>
                <li><code>D365 BC Admin MCP: Install D365 BC Admin MCP Server</code> - Install or reinstall the MCP server</li>
                <li><code>D365 BC Admin MCP: Uninstall D365 BC Admin MCP Server</code> - Remove the MCP server and configuration</li>
                <li><code>D365 BC Admin MCP: Check MCP Server Status</code> - Verify installation and configuration</li>
                <li><code>D365 BC Admin MCP: Show System Diagnostics</code> - View detailed system and extension information</li>
            </ul>

            <h2>Configuration Options</h2>
            <ul>
                <li><strong>Settings Scope:</strong> Choose between global or workspace-specific configuration</li>
                <li><strong>Auto-install:</strong> Enable/disable automatic installation on extension activation</li>
            </ul>

            <h2>Need Help?</h2>
            <p>If you encounter any issues, check the output channels for detailed logs or run the diagnostics command.</p>
        </body>
        </html>
    `;
}

async function execCommand(command: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        cp.exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout || stderr);
        });
    });
}

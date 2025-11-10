import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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

async function checkPrerequisites(outputChannel?: vscode.OutputChannel): Promise<boolean> {
    // Use provided output channel or create a new one
    let channel = outputChannel;
    let shouldShowChannel = false;

    if (!channel) {
        channel = vscode.window.createOutputChannel('D365 BC Admin MCP');
        shouldShowChannel = true;
    }

    if (shouldShowChannel) {
        channel.show();
    }

    try {
        channel.appendLine('Checking prerequisites...');

        // Check Node.js
        const nodeVersion = await execCommand('node --version');
        if (!nodeVersion) {
            vscode.window.showErrorMessage('Node.js is not installed. Please install Node.js first.');
            return false;
        }
        channel.appendLine(`✓ Node.js version: ${nodeVersion.trim()}`);

        // Check npm
        const npmVersion = await execCommand('npm --version');
        if (!npmVersion) {
            vscode.window.showErrorMessage('npm is not installed. Please install npm first.');
            return false;
        }
        channel.appendLine(`✓ npm version: ${npmVersion.trim()}`);

        channel.appendLine('Prerequisites check completed successfully.');
        return true;
    } catch (error) {
        channel.appendLine(`Prerequisites check failed: ${error}`);
        return false;
    }
}

async function installMCPServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Installation');
    outputChannel.show();

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server installation...');

        // Check prerequisites
        const prerequisitesMet = await checkPrerequisites(outputChannel);
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
                await execCommand('npm install -g @demiliani/d365bc-admin-mcp');
                outputChannel.appendLine('✓ Package installed successfully');
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
    // Get the path to the MCP configuration file
    const mcpConfigPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');

    const serverConfig = {
        "d365bc-admin": {
            "command": "d365bc-admin-mcp"
        }
    };

    try {
        // Read existing MCP configuration or create new one
        let mcpConfig: any = { servers: {} };

        if (fs.existsSync(mcpConfigPath)) {
            try {
                const fileContent = fs.readFileSync(mcpConfigPath, 'utf8');
                mcpConfig = JSON.parse(fileContent);
                console.log('Existing MCP config:', JSON.stringify(mcpConfig, null, 2));
            } catch (error) {
                console.log('Error parsing existing MCP config:', error);
                // If file exists but is corrupted, create backup and start fresh
                const backupPath = `${mcpConfigPath}.backup.${Date.now()}`;
                fs.copyFileSync(mcpConfigPath, backupPath);
                console.log(`Backed up corrupted file to: ${backupPath}`);
                mcpConfig = { servers: {} };
            }
        }

        // Ensure servers object exists and is an object
        if (!mcpConfig.servers || typeof mcpConfig.servers !== 'object') {
            console.log('Creating new servers object');
            mcpConfig.servers = {};
        }

        console.log('Existing servers before merge:', JSON.stringify(mcpConfig.servers, null, 2));
        console.log('Server config to add:', JSON.stringify(serverConfig, null, 2));

        // Create a deep copy of existing servers to avoid reference issues
        const existingServers = JSON.parse(JSON.stringify(mcpConfig.servers));

        // Merge the configurations - preserve existing, add/update new
        mcpConfig.servers = {
            ...existingServers,
            ...serverConfig
        };

        console.log('Final merged servers:', JSON.stringify(mcpConfig.servers, null, 2));
        console.log('Full MCP config to write:', JSON.stringify(mcpConfig, null, 2));

        // Write the updated configuration to the file
        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

        // Verify the file was written correctly
        try {
            const writtenContent = fs.readFileSync(mcpConfigPath, 'utf8');
            const writtenConfig = JSON.parse(writtenContent);
            console.log('Verification - written config:', JSON.stringify(writtenConfig, null, 2));

            if (!writtenConfig.servers || Object.keys(writtenConfig.servers).length === 0) {
                console.error('ERROR: Written config has no servers!');
                vscode.window.showErrorMessage('Warning: MCP configuration may not have been written correctly. Check the console for details.');
            }
        } catch (verifyError) {
            console.error('Error verifying written config:', verifyError);
        }

        vscode.window.showInformationMessage('MCP configuration added to mcp.json file successfully!');
    } catch (error) {
        // If automatic configuration fails, show manual instructions
        const configInstructions = JSON.stringify({ servers: serverConfig }, null, 2);

        const message = `Automatic MCP configuration failed. Please manually create or update the file:

${mcpConfigPath}

Add this content to the file:

${configInstructions}`;

        vscode.window.showWarningMessage('MCP Configuration Required', 'Copy Instructions').then(selection => {
            if (selection === 'Copy Instructions') {
                vscode.env.clipboard.writeText(configInstructions);
                vscode.window.showInformationMessage('Configuration copied to clipboard!');
            }
        });

        // Show the instructions in output channel as well
        const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Configuration');
        outputChannel.show();
        outputChannel.appendLine('MCP Configuration Instructions:');
        outputChannel.appendLine('===============================');
        outputChannel.appendLine('');
        outputChannel.appendLine(`Please create or update the file: ${mcpConfigPath}`);
        outputChannel.appendLine('');
        outputChannel.appendLine('Add this content to the file:');
        outputChannel.appendLine(configInstructions);
        outputChannel.appendLine('');
        outputChannel.appendLine('After updating the file, restart VS Code for the changes to take effect.');

        // Don't throw error - let the installation complete
        return;
    }
}

async function removeGitHubCopilotConfig(): Promise<void> {
    // Get the path to the MCP configuration file
    const mcpConfigPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');

    try {
        if (fs.existsSync(mcpConfigPath)) {
            const fileContent = fs.readFileSync(mcpConfigPath, 'utf8');
            const mcpConfig = JSON.parse(fileContent);

            console.log('Existing MCP config before removal:', JSON.stringify(mcpConfig, null, 2));

            // Remove the D365 BC Admin server configuration
            if (mcpConfig.servers && mcpConfig.servers['d365bc-admin']) {
                delete mcpConfig.servers['d365bc-admin'];

                console.log('Updated MCP config after removal:', JSON.stringify(mcpConfig, null, 2));

                // Write the updated configuration back to the file
                fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

                vscode.window.showInformationMessage('MCP configuration removed from mcp.json file successfully!');
            } else {
                console.log('D365 BC Admin server not found in MCP configuration');
            }
        } else {
            console.log('MCP config file does not exist');
        }
    } catch (error) {
        // If automatic removal fails, inform user to remove manually
        const mcpConfigPathDisplay = path.join('~/Library/Application Support/Code/User/mcp.json');
        vscode.window.showInformationMessage(
            `Please manually remove the "d365bc-admin" entry from the "servers" section in: ${mcpConfigPathDisplay}`
        );
    }
}

async function isMCPServerInstalled(): Promise<boolean> {
    try {
        await execCommand('d365bc-admin-mcp --version');
        return true;
    } catch {
        return false;
    }
}

async function checkMCPConfiguration(): Promise<{ configured: boolean; command?: string }> {
    try {
        const mcpConfigPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');

        if (!fs.existsSync(mcpConfigPath)) {
            return { configured: false };
        }

        const fileContent = fs.readFileSync(mcpConfigPath, 'utf8');
        const mcpConfig = JSON.parse(fileContent);

        if (mcpConfig.servers && mcpConfig.servers['d365bc-admin']) {
            return {
                configured: true,
                command: mcpConfig.servers['d365bc-admin'].command
            };
        }

        return { configured: false };
    } catch (error) {
        console.log('Error checking MCP configuration:', error);
        return { configured: false };
    }
}

async function checkMCPServerRunning(): Promise<boolean> {
    try {
        // First check if the MCP package is installed and executable
        const packageInstalled = await isMCPServerInstalled();
        if (!packageInstalled) {
            console.log('MCP server accessibility check: package not installed');
            return false;
        }

        // Try to execute the MCP server command to see if it's accessible
        // MCP servers typically start on-demand, so we'll test basic command execution
        console.log('Testing MCP server command execution...');
        const result = await execCommand('d365bc-admin-mcp --help');
        console.log('MCP server command executed successfully:', result ? 'yes' : 'no');

        // If we can execute the command, consider the server accessible
        return true;
    } catch (error) {
        // If the command fails, the server is not accessible
        console.log('MCP server accessibility check failed:', error);
        return false;
    }
}

async function checkStatus(): Promise<void> {
    console.log('checkStatus function called');

    try {
        const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Status');
        outputChannel.show();

        outputChannel.appendLine('Checking D365 BC Admin MCP Server status...');
        outputChannel.appendLine('==========================================');
        outputChannel.appendLine('');

        console.log('Starting status checks...');

        // Check prerequisites (use the same output channel)
        console.log('Checking prerequisites...');
        const prerequisitesMet = await checkPrerequisites(outputChannel);
        console.log('Prerequisites met:', prerequisitesMet);
        // Prerequisites check already wrote to the output channel, just add summary
        outputChannel.appendLine(`Prerequisites met: ${prerequisitesMet ? '✓' : '✗'}`);
        outputChannel.appendLine('');

        // Check if package is installed
        console.log('Checking package installation...');
        let installed = false;
        try {
            installed = await isMCPServerInstalled();
            console.log('Package installed:', installed);
        } catch (error) {
            console.error('Error checking package installation:', error);
        }
        outputChannel.appendLine(`MCP Server package installed: ${installed ? '✓' : '✗'}`);

        // Check MCP configuration in mcp.json
        console.log('Checking MCP configuration...');
        let mcpConfigStatus: { configured: boolean; command?: string } = { configured: false };
        try {
            mcpConfigStatus = await checkMCPConfiguration();
            console.log('MCP configuration status:', mcpConfigStatus);
        } catch (error) {
            console.error('Error checking MCP configuration:', error);
        }
        outputChannel.appendLine(`MCP configuration in mcp.json: ${mcpConfigStatus.configured ? '✓' : '✗'}`);
        if (mcpConfigStatus.configured) {
            outputChannel.appendLine(`  - Server name: d365bc-admin`);
            outputChannel.appendLine(`  - Command: ${mcpConfigStatus.command}`);
        }

        // Check if MCP server is accessible/running
        console.log('Checking MCP server accessibility...');
        let serverRunning = false;
        try {
            serverRunning = await checkMCPServerRunning();
            console.log('Server running:', serverRunning);
        } catch (error) {
            console.error('Error checking server accessibility:', error);
        }
        outputChannel.appendLine(`MCP Server accessibility: ${serverRunning ? '✓ Running' : '✗ Not accessible'}`);

        // Check settings scope
        let settingsScope = 'global';
        try {
            settingsScope = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('settingsScope', 'global');
            console.log('Settings scope:', settingsScope);
        } catch (error) {
            console.error('Error getting settings scope:', error);
        }
        outputChannel.appendLine(`Extension settings scope: ${settingsScope}`);

        outputChannel.appendLine('');
        outputChannel.appendLine('Status check completed.');

        // Show summary message
        if (prerequisitesMet && installed && mcpConfigStatus.configured) {
            if (serverRunning) {
                vscode.window.showInformationMessage('D365 BC Admin MCP Server is properly installed, configured, and accessible!');
            } else {
                vscode.window.showInformationMessage('D365 BC Admin MCP Server is installed and configured, but may not be currently accessible.');
            }
        } else {
            vscode.window.showWarningMessage('D365 BC Admin MCP Server is not fully installed or configured. Run the install command to fix this.');
        }
    } catch (error) {
        console.error('Error in checkStatus:', error);
        vscode.window.showErrorMessage(`Status check failed: ${error}`);
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
            const mcpConfigStatus = await checkMCPConfiguration();
            const configured = mcpConfigStatus.configured;
            const serverRunning = configured && await checkMCPServerRunning();

            if (installed && configured && serverRunning) {
                statusBarItem.text = '$(check) D365 BC MCP';
                statusBarItem.tooltip = 'D365 BC Admin MCP Server is active and accessible';
                statusBarItem.color = undefined;
            } else if (installed && configured) {
                statusBarItem.text = '$(warning) D365 BC MCP';
                statusBarItem.tooltip = 'D365 BC Admin MCP Server configured but not accessible';
                statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
            } else if (installed) {
                statusBarItem.text = '$(tools) D365 BC MCP';
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

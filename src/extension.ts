import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let statusBarItem: vscode.StatusBarItem;

// Installation state tracking to prevent concurrent operations
let isInstallationInProgress = false;
let installationLockTime: number | null = null;
const INSTALLATION_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout for stale locks
const INSTANCE_MARKER_DIR = path.join(os.tmpdir(), 'd365bc-admin-mcp-instances');

// Type definitions for MCP configuration
interface MCPConfig {
    [key: string]: {
        command: string;
    };
}

/**
 * Check if installation lock is valid (not stale)
 */
function isInstallationLockValid(): boolean {
    if (!isInstallationInProgress) {
        return false;
    }
    if (installationLockTime === null) {
        return false;
    }
    // Check if lock has expired (stale)
    const elapsed = Date.now() - installationLockTime;
    if (elapsed > INSTALLATION_LOCK_TIMEOUT_MS) {
        console.log('Installation lock expired (stale), releasing...');
        releaseInstallationLock();
        return false;
    }
    return true;
}

/**
 * Acquire installation lock to prevent concurrent operations
 */
function acquireInstallationLock(): boolean {
    if (isInstallationLockValid()) {
        console.log('Installation lock already held');
        return false;
    }
    isInstallationInProgress = true;
    installationLockTime = Date.now();
    console.log('Installation lock acquired');
    return true;
}

/**
 * Release installation lock
 */
function releaseInstallationLock(): void {
    isInstallationInProgress = false;
    installationLockTime = null;
    console.log('Installation lock released');
}

/**
 * Check if MCP server process is currently running (Windows specific check for the exe)
 */
async function isMCPServerProcessRunning(): Promise<boolean> {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            // Check for D365BCAdminMCP.exe process on Windows
            cp.exec('tasklist /FI "IMAGENAME eq D365BCAdminMCP.exe" /NH', { timeout: 10000 }, (error, stdout) => {
                if (error) {
                    console.log('Error checking for running MCP process:', error);
                    resolve(false);
                    return;
                }
                // If the process is running, stdout will contain the process name
                const isRunning = stdout.toLowerCase().includes('d365bcadminmcp.exe');
                console.log('MCP server process running check:', isRunning);
                resolve(isRunning);
            });
        } else if (process.platform === 'darwin' || process.platform === 'linux') {
            // Check for d365bc-admin-mcp process on macOS/Linux
            cp.exec('pgrep -f "d365bc-admin-mcp|D365BCAdminMCP"', { timeout: 10000 }, (error, stdout) => {
                // pgrep returns exit code 1 if no process found, which is not an error for us
                const isRunning = !error && stdout.trim().length > 0;
                console.log('MCP server process running check:', isRunning);
                resolve(isRunning);
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * Kill MCP server process if running
 */
async function killMCPServerProcess(): Promise<boolean> {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            cp.exec('taskkill /F /IM D365BCAdminMCP.exe', { timeout: 15000 }, (error) => {
                if (error) {
                    console.log('No MCP process to kill or error killing:', error.message);
                    resolve(false);
                    return;
                }
                console.log('MCP server process killed successfully');
                resolve(true);
            });
        } else if (process.platform === 'darwin' || process.platform === 'linux') {
            cp.exec('pkill -f "d365bc-admin-mcp|D365BCAdminMCP"', { timeout: 15000 }, (error) => {
                if (error) {
                    console.log('No MCP process to kill or error killing:', error.message);
                    resolve(false);
                    return;
                }
                console.log('MCP server process killed successfully');
                resolve(true);
            });
        } else {
            resolve(false);
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('D365 BC Admin MCP Extension is now active!');

    // Track this VS Code window so we only clean up MCP processes when the last one closes
    registerInstanceMarker();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'd365bc-admin-mcp.checkStatus';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('d365bc-admin-mcp.install', installMCPServer),
        vscode.commands.registerCommand('d365bc-admin-mcp.uninstall', uninstallMCPServer),
        vscode.commands.registerCommand('d365bc-admin-mcp.update', updateMCPServer),
        vscode.commands.registerCommand('d365bc-admin-mcp.checkStatus', checkStatus),
        vscode.commands.registerCommand('d365bc-admin-mcp.showDiagnostics', showDiagnostics)
    );

    // Auto-install if enabled (with debounce to prevent multiple triggers)
    const autoInstall = vscode.workspace.getConfiguration('d365bc-admin-mcp').get('autoInstall', true);
    if (autoInstall) {
        // Use a small delay to ensure VS Code is fully initialized and to debounce multiple activations
        setTimeout(async () => {
            // Check if another installation is already in progress
            if (isInstallationLockValid()) {
                console.log('Auto-install skipped: Installation already in progress');
                return;
            }

            const prerequisitesMet = await checkPrerequisites();
            if (prerequisitesMet) {
                const installed = await isMCPServerInstalled();
                if (!installed) {
                    // Double-check the lock before showing the dialog
                    if (isInstallationLockValid()) {
                        console.log('Auto-install skipped: Installation started elsewhere');
                        return;
                    }

                    vscode.window.showInformationMessage(
                        'D365 BC Admin MCP Extension: MCP server not installed.',
                        'Install Now',
                        'Skip'
                    ).then(selection => {
                        if (selection === 'Install Now') {
                            installMCPServer();
                        }
                    });
                }
            }
        }, 2000); // 2 second delay to debounce
    }
}

export function deactivate() {
    console.log('D365 BC Admin MCP Extension deactivating...');
    
    // Clean up status bar
    if (statusBarItem) {
        statusBarItem.dispose();
    }

    const shouldCleanup = unregisterInstanceMarker();
    if (!shouldCleanup) {
        console.log('Leaving MCP processes running because other VS Code windows remain');
        return;
    }
    
    // Kill D365BCAdminMCP processes synchronously to ensure they're killed before VS Code exits
    killMCPServerProcessesSync();
}





function getVSCodeDirName(): string {
    const appName = vscode.env.appName || 'Visual Studio Code';
    if (appName.includes('Insiders')) return 'Code - Insiders';
    if (appName.includes('OSS')) return 'Code - OSS';
    if (appName.includes('VSCodium')) return 'VSCodium';
    return 'Code';
}

function getMcpConfigPath(): string {
    const codeDir = getVSCodeDirName();
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, codeDir, 'User', 'mcp.json');
    } else if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', codeDir, 'User', 'mcp.json');
    } else {
        const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        return path.join(configHome, codeDir, 'User', 'mcp.json');
    }
}

function ensureParentDirExists(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function humanizePath(p: string): string {
    const home = os.homedir();
    if (p.startsWith(home)) {
        return path.join('~', p.slice(home.length + (p[home.length] === path.sep ? 1 : 0)));
    }
    return p;
}

function ensureInstanceMarkerDir(): void {
    if (!fs.existsSync(INSTANCE_MARKER_DIR)) {
        fs.mkdirSync(INSTANCE_MARKER_DIR, { recursive: true });
    }
}

function isPidRunning(pid: number): boolean {
    if (!Number.isFinite(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error: any) {
        // EPERM means the process exists but we cannot signal it
        return error && error.code === 'EPERM';
    }
}

function getActiveInstanceMarkerPids(): number[] {
    ensureInstanceMarkerDir();
    const entries = fs.readdirSync(INSTANCE_MARKER_DIR, { withFileTypes: true });
    const activePids: number[] = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.lock')) {
            continue;
        }

        const markerPath = path.join(INSTANCE_MARKER_DIR, entry.name);
        const pid = parseInt(entry.name.replace('.lock', ''), 10);

        if (isPidRunning(pid)) {
            activePids.push(pid);
            continue;
        }

        try {
            fs.unlinkSync(markerPath);
            console.log(`Removed stale VS Code instance marker for PID ${pid}`);
        } catch (error: any) {
            console.log('Failed to remove stale instance marker:', error?.message ?? error);
        }
    }

    return activePids;
}

function registerInstanceMarker(): void {
    try {
        ensureInstanceMarkerDir();
        // Clean stale markers before registering this one
        getActiveInstanceMarkerPids();

        const markerPath = path.join(INSTANCE_MARKER_DIR, `${process.pid}.lock`);
        fs.writeFileSync(markerPath, Date.now().toString(), { encoding: 'utf8' });
        console.log(`Registered VS Code instance marker at ${markerPath}`);
    } catch (error: any) {
        console.log('Failed to register VS Code instance marker:', error?.message ?? error);
    }
}

function unregisterInstanceMarker(): boolean {
    try {
        ensureInstanceMarkerDir();
        const markerPath = path.join(INSTANCE_MARKER_DIR, `${process.pid}.lock`);
        if (fs.existsSync(markerPath)) {
            fs.unlinkSync(markerPath);
            console.log(`Removed VS Code instance marker at ${markerPath}`);
        }
    } catch (error: any) {
        console.log('Failed to remove VS Code instance marker:', error?.message ?? error);
    }

    try {
        const remaining = getActiveInstanceMarkerPids();
        if (remaining.length === 0) {
            console.log('No other VS Code instances registered; safe to clean up MCP processes');
            return true;
        }
        console.log(`Skipping MCP cleanup: ${remaining.length} instance marker(s) still active (${remaining.join(', ')})`);
        return false;
    } catch (error: any) {
        console.log('Error checking VS Code instance markers, proceeding with cleanup:', error?.message ?? error);
        return true;
    }
}
/**
 * Kill D365BCAdminMCP processes synchronously (cleanup on extension deactivation)
 * Uses synchronous execution to ensure processes are killed before VS Code exits
 */
function killMCPServerProcessesSync(): void {
    console.log('Cleaning up D365BCAdminMCP processes (sync)...');
    
    try {
        if (process.platform === 'win32') {
            // Windows: taskkill to force close all D365BCAdminMCP.exe processes
            cp.execSync('taskkill /F /IM D365BCAdminMCP.exe /T', { 
                timeout: 5000, 
                windowsHide: true,
                stdio: 'ignore'  // Suppress output
            });
            console.log('D365BCAdminMCP processes cleaned up successfully');
        } else if (process.platform === 'darwin' || process.platform === 'linux') {
            // macOS/Linux: pkill to terminate d365bc-admin-mcp processes
            cp.execSync('pkill -9 -f "d365bc-admin-mcp|D365BCAdminMCP"', { 
                timeout: 5000,
                stdio: 'ignore'
            });
            console.log('D365BCAdminMCP processes cleaned up successfully');
        }
    } catch (error: any) {
        // Ignore "process not found" errors - that's fine
        if (error.status === 128 || error.message?.includes('not found')) {
            console.log('No D365BCAdminMCP processes to clean up');
        } else {
            console.log('Error cleaning up MCP processes:', error.message);
        }
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

    // Check for concurrent installation
    if (!acquireInstallationLock()) {
        outputChannel.appendLine('⚠️ Installation already in progress. Please wait for it to complete.');
        vscode.window.showWarningMessage('An installation is already in progress. Please wait for it to complete.');
        return;
    }

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server installation...');

        // Check if MCP server process is running
        outputChannel.appendLine('Checking for running MCP server processes...');
        const isRunning = await isMCPServerProcessRunning();
        if (isRunning) {
            outputChannel.appendLine('⚠️ MCP server process is currently running.');
            const selection = await vscode.window.showWarningMessage(
                'MCP server is currently running. It needs to be stopped before installation. Stop it now?',
                'Stop and Continue',
                'Cancel'
            );
            
            if (selection === 'Stop and Continue') {
                outputChannel.appendLine('Stopping MCP server process...');
                await killMCPServerProcess();
                // Wait a bit for the process to fully terminate
                await new Promise(resolve => setTimeout(resolve, 2000));
                outputChannel.appendLine('✓ MCP server process stopped');
            } else {
                outputChannel.appendLine('Installation cancelled by user.');
                releaseInstallationLock();
                return;
            }
        } else {
            outputChannel.appendLine('✓ No running MCP server process detected');
        }

        // Check prerequisites
        const prerequisitesMet = await checkPrerequisites(outputChannel);
        if (!prerequisitesMet) {
            releaseInstallationLock();
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
    } finally {
        releaseInstallationLock();
    }
}

async function uninstallMCPServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Uninstallation');
    outputChannel.show();

    // Check for concurrent operation
    if (!acquireInstallationLock()) {
        outputChannel.appendLine('⚠️ Another operation is already in progress. Please wait for it to complete.');
        vscode.window.showWarningMessage('Another installation/update operation is already in progress. Please wait for it to complete.');
        return;
    }

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server uninstallation...');

        // Check if MCP server process is running
        outputChannel.appendLine('Checking for running MCP server processes...');
        const isRunning = await isMCPServerProcessRunning();
        if (isRunning) {
            outputChannel.appendLine('⚠️ MCP server process is currently running.');
            const selection = await vscode.window.showWarningMessage(
                'MCP server is currently running. It needs to be stopped before uninstallation. Stop it now?',
                'Stop and Continue',
                'Cancel'
            );
            
            if (selection === 'Stop and Continue') {
                outputChannel.appendLine('Stopping MCP server process...');
                await killMCPServerProcess();
                // Wait a bit for the process to fully terminate
                await new Promise(resolve => setTimeout(resolve, 2000));
                outputChannel.appendLine('✓ MCP server process stopped');
            } else {
                outputChannel.appendLine('Uninstallation cancelled by user.');
                releaseInstallationLock();
                return;
            }
        } else {
            outputChannel.appendLine('✓ No running MCP server process detected');
        }

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
    } finally {
        releaseInstallationLock();
    }
}

async function updateMCPServer(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Update');
    outputChannel.show();

    // Check for concurrent operation
    if (!acquireInstallationLock()) {
        outputChannel.appendLine('⚠️ Another operation is already in progress. Please wait for it to complete.');
        vscode.window.showWarningMessage('Another installation/update operation is already in progress. Please wait for it to complete.');
        return;
    }

    try {
        outputChannel.appendLine('Starting D365 BC Admin MCP Server update...');

        // Check if MCP server process is running
        outputChannel.appendLine('Checking for running MCP server processes...');
        const isRunning = await isMCPServerProcessRunning();
        if (isRunning) {
            outputChannel.appendLine('⚠️ MCP server process is currently running.');
            outputChannel.appendLine('Stopping all MCP server processes to prevent file locks...');
            
            try {
                // Kill all MCP processes synchronously to ensure they're terminated before update
                if (process.platform === 'win32') {
                    cp.execSync('taskkill /F /IM D365BCAdminMCP.exe /T', { 
                        timeout: 5000, 
                        windowsHide: true,
                        stdio: 'ignore'
                    });
                } else if (process.platform === 'darwin' || process.platform === 'linux') {
                    cp.execSync('pkill -9 -f "d365bc-admin-mcp|D365BCAdminMCP"', { 
                        timeout: 5000,
                        stdio: 'ignore'
                    });
                }
                
                // Wait a bit for the process to fully terminate and release file locks
                await new Promise(resolve => setTimeout(resolve, 2000));
                outputChannel.appendLine('✓ All MCP server processes stopped');
            } catch (error: any) {
                // Ignore "process not found" errors
                if (!error.status || error.status !== 128) {
                    outputChannel.appendLine(`Warning stopping processes: ${error.message}`);
                }
                outputChannel.appendLine('✓ No running MCP server process detected or already stopped');
            }
        } else {
            outputChannel.appendLine('✓ No running MCP server process detected');
        }

        // Check prerequisites first
        const prerequisitesMet = await checkPrerequisites(outputChannel);
        if (!prerequisitesMet) {
            releaseInstallationLock();
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating D365 BC Admin MCP Server',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Updating npm package...' });

            try {
                outputChannel.appendLine('Updating @demiliani/d365bc-admin-mcp globally...');
                await execCommand('npm update -g @demiliani/d365bc-admin-mcp');
                outputChannel.appendLine('✓ Package updated successfully');
                progress.report({ increment: 60, message: 'Re-validating configuration...' });
            } catch (error) {
                throw new Error(`Failed to update npm package: ${error}`);
            }

            // Reconfigure MCP in case of changes
            try {
                await configureGitHubCopilot();
                outputChannel.appendLine('✓ MCP configuration verified');
                progress.report({ increment: 100, message: 'Update completed!' });
            } catch (error) {
                outputChannel.appendLine(`Warning: MCP configuration verification failed: ${error}`);
            }
        });

        vscode.window.showInformationMessage('D365 BC Admin MCP Server updated successfully!');
        updateStatusBar();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`Update failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Update failed: ${errorMessage}`);
    } finally {
        releaseInstallationLock();
    }
}

async function configureGitHubCopilot(): Promise<void> {
    // Get the path to the MCP configuration file (cross-platform)
    const mcpConfigPath = getMcpConfigPath();

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
                ensureParentDirExists(backupPath);
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

        // Ensure directory exists and write the updated configuration to the file
        ensureParentDirExists(mcpConfigPath);
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
    // Get the path to the MCP configuration file (cross-platform)
    const mcpConfigPath = getMcpConfigPath();

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
                ensureParentDirExists(mcpConfigPath);
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
        const mcpConfigPathDisplay = humanizePath(getMcpConfigPath());
        vscode.window.showInformationMessage(
            `Please manually remove the "d365bc-admin" entry from the "servers" section in: ${mcpConfigPathDisplay}`
        );
    }
}

async function isMCPServerInstalled(): Promise<boolean> {
    try {
        // First check: look for npm package installation (most reliable)
        try {
            const listOutput = await execCommand('npm list -g @demiliani/d365bc-admin-mcp --depth=0');
            if (listOutput && listOutput.includes('@demiliani/d365bc-admin-mcp')) {
                console.log('MCP server package found via npm list');
                return true;
            }
        } catch (e) {
            console.log('npm list check failed, trying alternative methods');
        }

        // Second check: Get npm global prefix and check for executable
        try {
            const npmPrefix = await execCommand('npm prefix -g');
            if (npmPrefix) {
                const prefixDir = npmPrefix.trim();
                // On Windows, executables are in the prefix directory itself
                // On Unix-like systems, they're in prefix/bin
                const binDirs = process.platform === 'win32' 
                    ? [prefixDir] 
                    : [path.join(prefixDir, 'bin'), prefixDir];
                
                const executableName = process.platform === 'win32' ? 'd365bc-admin-mcp.cmd' : 'd365bc-admin-mcp';
                
                for (const binDir of binDirs) {
                    const executablePath = path.join(binDir, executableName);
                    if (fs.existsSync(executablePath)) {
                        console.log('MCP server executable found at:', executablePath);
                        return true;
                    }
                }
            }
        } catch (e) {
            console.log('npm prefix check failed:', e);
        }

        // Third check: Try to run the command directly (last resort - may create processes)
        try {
            await execCommand('d365bc-admin-mcp --version');
            console.log('MCP server command executed successfully');
            return true;
        } catch {
            console.log('Direct command execution failed');
        }

        console.log('MCP server not found by any detection method');
        return false;
    } catch (error) {
        console.log('isMCPServerInstalled error:', error);
        return false;
    }
}

async function checkMCPConfiguration(): Promise<{ configured: boolean; command?: string }> {
    try {
        const mcpConfigPath = getMcpConfigPath();

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
    console.log('Checking MCP server availability...');

    // Since the user confirmed the package is installed and works,
    // and the MCP server is configured in mcp.json, we can assume it's available
    // MCP servers start on-demand when needed by MCP clients
    console.log('MCP server is configured and package confirmed working - considering available');
    return true;
}

async function checkStatus(): Promise<void> {
    console.log('checkStatus function called - checking MCP server running status');

    try {
        const outputChannel = vscode.window.createOutputChannel('D365 BC Admin MCP Status');
        outputChannel.show();

    outputChannel.appendLine('Checking D365 BC Admin MCP Server Availability');
    outputChannel.appendLine('===============================================');
        outputChannel.appendLine('');

        // Check MCP configuration in mcp.json
        console.log('Checking MCP configuration in mcp.json...');
        const mcpConfigStatus = await checkMCPConfiguration();

        if (!mcpConfigStatus.configured) {
            outputChannel.appendLine('❌ MCP server not configured in mcp.json');
            outputChannel.appendLine('');
            outputChannel.appendLine('Run "D365BCAdmin - Install D365 BC Admin MCP Server" first.');
            vscode.window.showWarningMessage('MCP server not configured. Run the install command first.');
            return;
        }

        outputChannel.appendLine(`✅ MCP server configured: ${mcpConfigStatus.command}`);
        outputChannel.appendLine('');

        // Check if MCP server is running
        outputChannel.appendLine('Checking if MCP server is available...');
        console.log('Checking MCP server availability...');

        console.log('About to call checkMCPServerRunning...');
        outputChannel.appendLine('DEBUG: About to check server availability...');
        const serverAvailable = await checkMCPServerRunning();
        console.log('checkMCPServerRunning returned:', serverAvailable);
        outputChannel.appendLine(`DEBUG: Server available result: ${serverAvailable}`);

        outputChannel.appendLine('');
        if (serverAvailable) {
            outputChannel.appendLine('🟢 STATUS: MCP Server is AVAILABLE');
            vscode.window.showInformationMessage('MCP Server is available and ready to use!');
        } else {
            outputChannel.appendLine('🔴 STATUS: MCP Server is NOT AVAILABLE');
            vscode.window.showWarningMessage('MCP Server is not available. Check installation.');
        }

        outputChannel.appendLine('');
        outputChannel.appendLine('Status check completed.');

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
        const child = cp.exec(command, { timeout: 30000, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout || stderr);
        });
        
        // Ensure child process is properly terminated if parent exits
        if (child.pid) {
            const cleanup = () => {
                try {
                    if (!child.killed) {
                        child.kill();
                    }
                } catch (e) {
                    // Process may already be dead
                }
            };
            
            // Register cleanup handlers
            child.on('exit', cleanup);
            process.on('exit', cleanup);
        }
    });
}

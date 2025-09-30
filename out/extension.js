"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const htmlCaptureProvider_1 = require("./htmlCaptureProvider");
const htmlComparator_1 = require("./htmlComparator");
const locatorGenerator_1 = require("./locatorGenerator");
const diffViewProvider_1 = require("./diffViewProvider");
const onboardingWizard_1 = require("./onboardingWizard");
const simplePanel_1 = require("./simplePanel");
const treeViewProvider_1 = require("./treeViewProvider");
function activate(context) {
    console.log('QA HTML Structure Capture extension is now active!');
    console.log('Status bar buttons should now be visible...');
    console.log('Activating panel provider...');
    // Initialize providers
    const htmlCaptureProvider = new htmlCaptureProvider_1.HTMLCaptureProvider(context);
    const htmlComparator = new htmlComparator_1.HTMLComparator(context);
    const locatorGenerator = new locatorGenerator_1.LocatorGenerator();
    const diffViewProvider = new diffViewProvider_1.DiffViewProvider(context);
    const onboardingWizard = new onboardingWizard_1.OnboardingWizard(context);
    const treeViewProvider = new treeViewProvider_1.TreeViewProvider(htmlCaptureProvider);
    // Show onboarding wizard on first activation
    setTimeout(async () => {
        try {
            // Check if onboarding was completed
            const hasCompletedOnboarding = context.globalState.get('qa-html-capture.onboardingCompleted', false);
            if (!hasCompletedOnboarding) {
                // Show welcome message first
                const welcome = await vscode.window.showInformationMessage('Welcome to QA HTML Structure Capture!\n\nWould you like to set up your project now?', 'Setup Project', 'Skip for Now');
                if (welcome === 'Setup Project') {
                    await onboardingWizard.showOnboardingWizard();
                }
            }
        }
        catch (error) {
            console.error('Onboarding wizard error:', error);
        }
    }, 1000); // Reduced delay for faster response
    // Register tree data providers for the sidebar
    const baselinesView = vscode.window.createTreeView('qa-html-capture-baselines', {
        treeDataProvider: htmlCaptureProvider,
        showCollapseAll: true
    });
    const panelView = vscode.window.createTreeView('qa-html-capture-panel', {
        treeDataProvider: treeViewProvider,
        showCollapseAll: true
    });
    // Ensure the views are visible even without a workspace
    context.subscriptions.push(baselinesView, panelView);
    // Create status bar items with higher priority
    const captureButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    captureButton.text = "Capture";
    captureButton.tooltip = "Capture HTML Baseline";
    captureButton.command = 'qa-html-capture.captureBaseline';
    captureButton.show();
    const compareButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
    compareButton.text = "Compare";
    compareButton.tooltip = "Compare HTML Structure";
    compareButton.command = 'qa-html-capture.compareStructure';
    compareButton.show();
    const locatorButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 998);
    locatorButton.text = "Locators";
    locatorButton.tooltip = "Generate Updated Locators";
    locatorButton.command = 'qa-html-capture.generateLocators';
    locatorButton.show();
    // Add web page capture functionality
    const webCaptureButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 997);
    webCaptureButton.text = "Web";
    webCaptureButton.tooltip = "Capture HTML from Web Page";
    webCaptureButton.command = 'qa-html-capture.captureFromWeb';
    webCaptureButton.show();
    // Add panel button
    const panelButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 996);
    panelButton.text = "QA Tools";
    panelButton.tooltip = "Open QA HTML Tools Panel";
    panelButton.command = 'qa-html-capture.openPanel';
    panelButton.show();
    // Register commands
    const commands = [
        vscode.commands.registerCommand('qa-html-capture.captureBaseline', () => {
            htmlCaptureProvider.captureBaseline();
        }),
        vscode.commands.registerCommand('qa-html-capture.compareStructure', () => {
            htmlComparator.compareStructure();
        }),
        vscode.commands.registerCommand('qa-html-capture.viewDiff', (item) => {
            diffViewProvider.showDiff(item);
        }),
        vscode.commands.registerCommand('qa-html-capture.generateLocators', () => {
            locatorGenerator.generateLocators();
        }),
        vscode.commands.registerCommand('qa-html-capture.iterateDiffResults', async () => {
            try {
                const diffResult = await htmlComparator.compareStructure();
                if (!diffResult) {
                    vscode.window.showErrorMessage('No diff results available. Please run a comparison first.');
                    return;
                }
                // Demonstrate iterable functionality
                let report = '# Iterable Diff Results\n\n';
                report += `**Total Differences:** ${diffResult.length}\n\n`;
                // Using for...of loop (iterable interface)
                report += '## All Differences (using for...of):\n';
                for (const difference of diffResult) {
                    report += `- **${difference.type.toUpperCase()}**: ${difference.elementId}\n`;
                    if (difference.description) {
                        report += `  - ${difference.description}\n`;
                    }
                }
                // Using forEach method
                report += '\n## Added Elements (using forEach):\n';
                diffResult.getAddedElements().forEach((diff, index) => {
                    report += `${index + 1}. ${diff.elementId} - ${diff.description}\n`;
                });
                // Using map method
                report += '\n## Modified Elements (using map):\n';
                const modifiedInfo = diffResult.getModifiedElements().map((diff, index) => `${index + 1}. ${diff.elementId} - ${diff.description}`);
                report += modifiedInfo.join('\n');
                // Using filter method
                report += '\n## Elements with XPath changes (using filter):\n';
                const xpathChanges = diffResult.filter(diff => !!(diff.oldXPath && diff.newXPath && diff.oldXPath !== diff.newXPath));
                xpathChanges.forEach((diff, index) => {
                    report += `${index + 1}. ${diff.elementId}\n`;
                    report += `   Old: ${diff.oldXPath}\n`;
                    report += `   New: ${diff.newXPath}\n`;
                });
                // Create and show the report
                const document = await vscode.workspace.openTextDocument({
                    content: report,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(document);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error iterating diff results: ${error}`);
            }
        }),
        vscode.commands.registerCommand('qa-html-capture.deleteBaseline', (item) => {
            htmlCaptureProvider.deleteBaseline(item);
        }),
        vscode.commands.registerCommand('qa-html-capture.refresh', () => {
            htmlCaptureProvider.refresh();
        }),
        vscode.commands.registerCommand('qa-html-capture.captureFromWeb', () => {
            htmlCaptureProvider.captureFromWeb();
        }),
        vscode.commands.registerCommand('qa-html-capture.reconfigureProject', () => {
            onboardingWizard.showOnboardingWizard();
        }),
        vscode.commands.registerCommand('qa-html-capture.viewProjectSettings', () => {
            onboardingWizard.showProjectSettings();
        }),
        vscode.commands.registerCommand('qa-html-capture.openBaselineFile', async (baseline) => {
            console.log('openBaselineFile called with:', baseline);
            console.log('Baseline type:', typeof baseline);
            console.log('Baseline keys:', baseline ? Object.keys(baseline) : 'undefined');
            if (!baseline) {
                vscode.window.showErrorMessage('No baseline file selected.');
                return;
            }
            if (!baseline.id) {
                vscode.window.showErrorMessage('Baseline data is missing ID property.');
                return;
            }
            try {
                const storagePath = path.join(context.globalStorageUri.fsPath, 'baselines');
                const filePath = path.join(storagePath, `${baseline.id}.json`);
                console.log('Storage path:', storagePath);
                console.log('File path:', filePath);
                console.log('File exists:', fs.existsSync(filePath));
                if (fs.existsSync(filePath)) {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                    vscode.window.showInformationMessage(`Opened baseline file: ${baseline.name || baseline.id}`);
                }
                else {
                    vscode.window.showErrorMessage(`Baseline file not found: ${filePath}`);
                }
            }
            catch (error) {
                console.error('Error opening baseline file:', error);
                vscode.window.showErrorMessage(`Error opening baseline file: ${error}`);
            }
        }),
        // Panel commands
        vscode.commands.registerCommand('qa-html-capture.compareWithBaseline', (baselineId) => {
            htmlComparator.compareStructure();
        }),
        vscode.commands.registerCommand('qa-html-capture.generateLocatorReport', () => {
            locatorGenerator.generateLocators();
        }),
        // Simple panel command
        vscode.commands.registerCommand('qa-html-capture.openPanel', () => {
            simplePanel_1.SimplePanel.createOrShow(context.extensionUri);
        }),
        // Tree view commands
        vscode.commands.registerCommand('qa-html-capture.refreshPanel', () => {
            treeViewProvider.refresh();
        }),
        vscode.commands.registerCommand('qa-html-capture.showBaselinesFolder', async () => {
            try {
                const storagePath = path.join(context.globalStorageUri.fsPath, 'baselines');
                // Ensure the directory exists
                if (!fs.existsSync(storagePath)) {
                    fs.mkdirSync(storagePath, { recursive: true });
                }
                // Show the path to the user
                vscode.window.showInformationMessage(`Baselines folder: ${storagePath}`);
                // Refresh the tree view to show the files
                treeViewProvider.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error showing baselines folder: ${error}`);
            }
        }),
        vscode.commands.registerCommand('qa-html-capture.clearAllBaselines', async () => {
            const result = await vscode.window.showWarningMessage('Are you sure you want to clear all baselines? This action cannot be undone.', 'Yes, Clear All', 'Cancel');
            if (result === 'Yes, Clear All') {
                try {
                    const storagePath = path.join(context.globalStorageUri.fsPath, 'baselines');
                    const files = fs.readdirSync(storagePath);
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            fs.unlinkSync(path.join(storagePath, file));
                        }
                    }
                    treeViewProvider.refresh();
                    vscode.window.showInformationMessage('All baselines have been cleared.');
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error clearing baselines: ${error}`);
                }
            }
        }),
        // Individual baseline delete command
        vscode.commands.registerCommand('qa-html-capture.deleteBaseline', async (baseline) => {
            if (!baseline) {
                vscode.window.showErrorMessage('No baseline selected for deletion.');
                return;
            }
            const result = await vscode.window.showWarningMessage(`Are you sure you want to delete baseline "${baseline.name}"? This action cannot be undone.`, 'Yes, Delete', 'Cancel');
            if (result === 'Yes, Delete') {
                try {
                    const storagePath = path.join(context.globalStorageUri.fsPath, 'baselines');
                    const filePath = path.join(storagePath, `${baseline.id}.json`);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        treeViewProvider.refresh();
                        vscode.window.showInformationMessage(`Baseline "${baseline.name}" has been deleted.`);
                    }
                    else {
                        vscode.window.showErrorMessage(`Baseline file not found: ${filePath}`);
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error deleting baseline: ${error}`);
                }
            }
        })
    ];
    // Add all commands to context
    commands.forEach(command => context.subscriptions.push(command));
    // Add status bar items to subscriptions
    context.subscriptions.push(captureButton, compareButton, locatorButton, webCaptureButton, panelButton);
    // Register webview provider for diff view
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('qa-html-capture.diffView', diffViewProvider));
}
exports.activate = activate;
function deactivate() {
    console.log('QA HTML Structure Capture extension is now deactivated!');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
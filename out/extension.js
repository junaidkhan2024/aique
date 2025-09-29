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
const htmlCaptureProvider_1 = require("./htmlCaptureProvider");
const htmlComparator_1 = require("./htmlComparator");
const locatorGenerator_1 = require("./locatorGenerator");
const diffViewProvider_1 = require("./diffViewProvider");
const onboardingWizard_1 = require("./onboardingWizard");
function activate(context) {
    console.log('QA HTML Structure Capture extension is now active!');
    console.log('Status bar buttons should now be visible...');
    // Initialize providers
    const htmlCaptureProvider = new htmlCaptureProvider_1.HTMLCaptureProvider(context);
    const htmlComparator = new htmlComparator_1.HTMLComparator(context);
    const locatorGenerator = new locatorGenerator_1.LocatorGenerator();
    const diffViewProvider = new diffViewProvider_1.DiffViewProvider(context);
    const onboardingWizard = new onboardingWizard_1.OnboardingWizard(context);
    // Show onboarding wizard on first activation
    setTimeout(async () => {
        try {
            // Check if onboarding was completed
            const hasCompletedOnboarding = context.globalState.get('qa-html-capture.onboardingCompleted', false);
            if (!hasCompletedOnboarding) {
                // Show welcome message first
                const welcome = await vscode.window.showInformationMessage('🎉 Welcome to QA HTML Structure Capture!\n\nWould you like to set up your project now?', 'Setup Project', 'Skip for Now');
                if (welcome === 'Setup Project') {
                    await onboardingWizard.showOnboardingWizard();
                }
            }
        }
        catch (error) {
            console.error('Onboarding wizard error:', error);
        }
    }, 1000); // Reduced delay for faster response
    // Register tree data provider for the sidebar
    vscode.window.createTreeView('qa-html-capture', {
        treeDataProvider: htmlCaptureProvider,
        showCollapseAll: true
    });
    // Create status bar items with higher priority
    const captureButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    captureButton.text = "$(camera) Capture";
    captureButton.tooltip = "Capture HTML Baseline";
    captureButton.command = 'qa-html-capture.captureBaseline';
    captureButton.show();
    const compareButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
    compareButton.text = "$(diff) Compare";
    compareButton.tooltip = "Compare HTML Structure";
    compareButton.command = 'qa-html-capture.compareStructure';
    compareButton.show();
    const locatorButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 998);
    locatorButton.text = "$(symbol-method) Locators";
    locatorButton.tooltip = "Generate Updated Locators";
    locatorButton.command = 'qa-html-capture.generateLocators';
    locatorButton.show();
    // Add web page capture functionality
    const webCaptureButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 997);
    webCaptureButton.text = "$(globe) Web";
    webCaptureButton.tooltip = "Capture HTML from Web Page";
    webCaptureButton.command = 'qa-html-capture.captureFromWeb';
    webCaptureButton.show();
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
        })
    ];
    // Add all commands to context
    commands.forEach(command => context.subscriptions.push(command));
    // Add status bar items to subscriptions
    context.subscriptions.push(captureButton, compareButton, locatorButton, webCaptureButton);
    // Register webview provider for diff view
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('qa-html-capture.diffView', diffViewProvider));
}
exports.activate = activate;
function deactivate() {
    console.log('QA HTML Structure Capture extension is now deactivated!');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
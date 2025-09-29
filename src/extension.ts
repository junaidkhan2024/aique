import * as vscode from 'vscode';
import { HTMLCaptureProvider } from './htmlCaptureProvider';
import { HTMLComparator } from './htmlComparator';
import { LocatorGenerator } from './locatorGenerator';
import { DiffViewProvider } from './diffViewProvider';
import { OnboardingWizard } from './onboardingWizard';

export function activate(context: vscode.ExtensionContext) {
    console.log('QA HTML Structure Capture extension is now active!');
    console.log('Status bar buttons should now be visible...');

    // Initialize providers
    const htmlCaptureProvider = new HTMLCaptureProvider(context);
    const htmlComparator = new HTMLComparator(context);
    const locatorGenerator = new LocatorGenerator();
    const diffViewProvider = new DiffViewProvider(context);
    const onboardingWizard = new OnboardingWizard(context);

    // Show onboarding wizard on first activation
    setTimeout(async () => {
        try {
            // Check if onboarding was completed
            const hasCompletedOnboarding = context.globalState.get('qa-html-capture.onboardingCompleted', false);
            
            if (!hasCompletedOnboarding) {
                // Show welcome message first
                const welcome = await vscode.window.showInformationMessage(
                    '🎉 Welcome to QA HTML Structure Capture!\n\nWould you like to set up your project now?',
                    'Setup Project',
                    'Skip for Now'
                );
                
                if (welcome === 'Setup Project') {
                    await onboardingWizard.showOnboardingWizard();
                }
            }
        } catch (error) {
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
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'qa-html-capture.diffView',
            diffViewProvider
        )
    );
}

export function deactivate() {
    console.log('QA HTML Structure Capture extension is now deactivated!');
}

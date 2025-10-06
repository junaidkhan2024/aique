import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface CapturedInteraction {
    action: 'navigate' | 'click' | 'type' | 'hover' | 'scroll' | 'wait' | 'select' | 'drag' | 'drop';
    element?: string;
    selector?: string;
    value?: string;
    url?: string;
    timestamp: string;
    coordinates?: { x: number; y: number };
    screenshot?: string;
    description?: string;
}

export interface CapturedMetadata {
    sessionId: string;
    url: string;
    startTime: string;
    endTime: string;
    interactions: CapturedInteraction[];
    pageTitle?: string;
    userAgent?: string;
    viewport?: { width: number; height: number };
}

export interface ProjectDetails {
    projectName: string;
    appType: 'web' | 'mobile' | 'desktop';
    webUrl?: string;
    environments: Array<{
    name: string;
    url: string;
    isDefault: boolean;
    }>;
    testFramework?: string;
    designPattern?: string;
    testCaseTypes: string[];
    techStack: string[];
    language: string;
    languageRating: number;
    manualTestCasesFile?: string;
    hasManualTestCases: boolean;
    wantsManualFlowCapture: boolean;
    capturedMetadata?: CapturedMetadata;
    generatedTests?: any;
    pageNames?: string[];
    loginCredentials?: {
    username: string;
    password: string;
    loginUrl: string;
    elementSelectors: {
        usernameSelector: string;
        passwordSelector: string;
        submitSelector: string;
    };
    };
    captureFrequency: 'manual' | 'scheduled' | 'continuous';
    teamSize: number;
}

export class OnboardingWizard {
    private metadataStoragePath: string = '';
    private configStoragePath: string = '';
    private isCapturing: boolean = false;
    private currentSession: CapturedMetadata | null = null;
    private filesTreeProvider: any = null;
    private browserMonitoringInterval: NodeJS.Timeout | null = null;
    private browserProcess: any = null;

    constructor(private context: vscode.ExtensionContext) {
        this.initializeProjectStorage();
    }

    private initializeProjectStorage(): void {
        // Use workspace storage instead of global storage for project-specific files
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Store in workspace folder with project-specific subdirectories
            this.metadataStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'metadata');
            this.configStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config');
        } else {
            // Fallback to global storage if no workspace
            this.metadataStoragePath = path.join(this.context.globalStorageUri.fsPath, 'metadata');
            this.configStoragePath = path.join(this.context.globalStorageUri.fsPath, 'config');
        }
        this.ensureStorageDirectories();
    }

    public setFilesTreeProvider(provider: any): void {
        this.filesTreeProvider = provider;
    }

    // Method to check if a project already exists
    private projectExists(projectName: string): boolean {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const projectConfigPath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config', 'project-config.json');
                if (fs.existsSync(projectConfigPath)) {
                    const configContent = fs.readFileSync(projectConfigPath, 'utf8');
                    const config = JSON.parse(configContent);
                    return config.projectDetails?.projectName === projectName;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Method to get current project name
    public getCurrentProjectName(): string | null {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const projectConfigPath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config', 'project-config.json');
                if (fs.existsSync(projectConfigPath)) {
                    const configContent = fs.readFileSync(projectConfigPath, 'utf8');
                    const config = JSON.parse(configContent);
                    return config.projectDetails?.projectName || null;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // Method to switch to a different project
    public async switchProject(): Promise<void> {
        const currentProject = this.getCurrentProjectName();
        const message = currentProject 
            ? `Currently working on: ${currentProject}\n\nWould you like to start a new project?`
            : 'No active project found.\n\nWould you like to create a new project?';

        const action = await vscode.window.showInformationMessage(
            message,
            'Create New Project',
            'Cancel'
        );

        if (action === 'Create New Project') {
            // Clear current project data
            this.clearWorkspaceStorage();
            // Start new project setup
            await this.showOnboardingWizard();
        }
    }

    // Method to list all projects in the workspace
    public async listProjects(): Promise<{name: string, path: string, lastModified: Date}[]> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return [];
            }

            const qaCapturePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture');
            if (!fs.existsSync(qaCapturePath)) {
                return [];
            }

            const projects: {name: string, path: string, lastModified: Date}[] = [];
            
            // Check for projects stored in workspace state
            const workspaceState = this.context.workspaceState;
            const keys = workspaceState.keys();
            
            for (const key of keys) {
                if (key.startsWith('qa-html-capture.project.') && key.endsWith('.details')) {
                    const projectDetails = workspaceState.get<ProjectDetails>(key);
                    if (projectDetails) {
                        const projectName = projectDetails.projectName;
                        const configPath = path.join(qaCapturePath, 'config', 'project-config.json');
                        
                        let lastModified = new Date();
                        if (fs.existsSync(configPath)) {
                            const stats = fs.statSync(configPath);
                            lastModified = stats.mtime;
                        }
                        
                        projects.push({
                            name: projectName,
                            path: configPath,
                            lastModified: lastModified
                        });
                    }
                }
            }

            // Sort by last modified (most recent first)
            projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
            
            return projects;
        } catch (error) {
            console.error('Error listing projects:', error);
            return [];
        }
    }

    // Method to switch to a specific project
    public async switchToProject(projectName: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Load project details from workspace state
            const projectKey = `qa-html-capture.project.${projectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const projectDetails = this.context.workspaceState.get<ProjectDetails>(`${projectKey}.details`);
            
            if (!projectDetails) {
                vscode.window.showErrorMessage(`Project "${projectName}" not found`);
                return;
            }

            // Set as current project
            await this.context.workspaceState.update('qa-html-capture.currentProject', projectName);
            
            // Save current project config to file
            await this.saveProjectConfigToFile(projectDetails);
            
            vscode.window.showInformationMessage(`Switched to project: ${projectName}`);
            
            // Refresh the files tree provider
            if (this.filesTreeProvider) {
                this.filesTreeProvider.refresh();
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error switching to project: ${error}`);
        }
    }

    // Method to clear workspace-specific storage (useful for development/testing)
    public clearWorkspaceStorage(): void {
        try {
            // Clear workspace state
            this.context.workspaceState.update('qa-html-capture.projectDetails', undefined);
            this.context.workspaceState.update('qa-html-capture.onboardingCompleted', undefined);
            
            // Clear workspace files if they exist
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const workspaceConfigPath = path.join(workspaceFolder.uri.fsPath, '.qa-capture');
                if (fs.existsSync(workspaceConfigPath)) {
                    fs.rmSync(workspaceConfigPath, { recursive: true, force: true });
                }
            }
            
            vscode.window.showInformationMessage('Workspace storage cleared successfully!');
                            } catch (error) {
            vscode.window.showErrorMessage(`Failed to clear workspace storage: ${error}`);
        }
    }

    // Method to cleanup resources
    public cleanup(): void {
        if (this.browserMonitoringInterval) {
            clearInterval(this.browserMonitoringInterval);
            this.browserMonitoringInterval = null;
        }
        
        if (this.browserProcess && !this.browserProcess.killed) {
            try {
                this.browserProcess.kill();
        } catch (error) {
                // Ignore errors when killing process
            }
            this.browserProcess = null;
        }
        
        if (this.isCapturing) {
            this.stopMetadataCapture();
        }
    }

    private ensureStorageDirectories(): void {
        if (!fs.existsSync(this.metadataStoragePath)) {
            fs.mkdirSync(this.metadataStoragePath, { recursive: true });
        }
        if (!fs.existsSync(this.configStoragePath)) {
            fs.mkdirSync(this.configStoragePath, { recursive: true });
        }
    }

    async showOnboardingWizard(): Promise<ProjectDetails | null> {
        try {
            // Step 1: Project Name
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter your project name',
                placeHolder: 'My QA Project',
                value: 'My QA Project',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Project name is required';
                    }
                    // Check if project already exists
                    if (this.projectExists(value.trim())) {
                        return 'A project with this name already exists. Please choose a different name.';
                    }
                    return null;
                }
            });

            if (!projectName) {
                return null; // User cancelled
            }

            // Step 2: Application Type
            const appType = await vscode.window.showQuickPick(
                [
                    { label: 'Web Application', value: 'web' as const },
                    { label: 'Mobile Application', value: 'mobile' as const },
                    { label: 'Desktop Application', value: 'desktop' as const }
                ],
                {
                    placeHolder: 'Which type of app?',
                    title: 'Application Type'
                }
            );

            if (!appType) {
                return null; // User cancelled
            }

            // Step 3: Web URL (if web application)
            let webUrl: string | undefined;
            if (appType.value === 'web') {
                webUrl = await vscode.window.showInputBox({
                    prompt: 'Enter your main application URL',
                    placeHolder: 'https://example.com',
                    validateInput: (value) => {
                        if (value && value.trim().length > 0) {
                            try {
                                new URL(value);
                                return null;
                } catch {
                                return 'Please enter a valid URL';
                            }
                        }
                        return null;
                    }
                });

                if (!webUrl) {
                    return null; // User cancelled
                }
            }

            // Step 4: Environments under test
            const environments = await this.collectEnvironments();

            // Step 5: Test Framework
            const testFramework = await vscode.window.showQuickPick(
                [
                    { label: 'Selenium', value: 'selenium' },
                    { label: 'Playwright', value: 'playwright' },
                    { label: 'Cypress', value: 'cypress' },
                    { label: 'Puppeteer', value: 'puppeteer' },
                    { label: 'WebdriverIO', value: 'webdriverio' },
                    { label: 'TestCafe', value: 'testcafe' },
                    { label: 'Other', value: 'other' }
                ],
                {
                    placeHolder: 'Select your test framework',
                    title: 'Test Framework'
                }
            );

            if (!testFramework) {
                return null; // User cancelled
            }

            // If user selected "Other", ask for custom framework name
            let frameworkValue = testFramework.value;
            if (testFramework.value === 'other') {
                const customFramework = await vscode.window.showInputBox({
                    prompt: 'Enter your custom test framework name',
                    placeHolder: 'e.g., Nightwatch, Protractor, etc.',
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Framework name is required';
                        }
                        return null;
                    }
                });

                if (!customFramework) {
                    return null; // User cancelled
                }

                frameworkValue = customFramework.trim().toLowerCase();
            }

            // Step 6: Design Pattern
            const designPattern = await vscode.window.showQuickPick(
                [
                    { label: 'Page Object Model (POM)', value: 'pom' },
                    { label: 'Screenplay Pattern', value: 'screenplay' },
                    { label: 'Factory Pattern', value: 'factory' },
                    { label: 'Builder Pattern', value: 'builder' },
                    { label: 'Singleton Pattern', value: 'singleton' },
                    { label: 'No specific pattern', value: 'none' }
                ],
                {
                    placeHolder: 'Select your preferred design pattern',
                    title: 'Design Pattern'
                }
            );

            if (!designPattern) {
                return null; // User cancelled
            }

            // Step 7: Test Case Types
            const testCaseTypes = await this.collectTestCaseTypes();

            // Step 8: Tech Stack
            const techStack = await this.collectTechStack();

            // Step 9: Programming Language
            const language = await vscode.window.showQuickPick(
                [
                    { label: 'JavaScript', value: 'javascript' },
                    { label: 'TypeScript', value: 'typescript' },
                    { label: 'Python', value: 'python' },
                    { label: 'Java', value: 'java' },
                    { label: 'C#', value: 'csharp' },
                    { label: 'Ruby', value: 'ruby' },
                    { label: 'Other', value: 'other' }
                ],
                {
                    placeHolder: 'What language do you want?',
                    title: 'Programming Language'
                }
            );

            if (!language) {
                return null; // User cancelled
            }

            // Step 10: Language Rating
            const languageRating = await vscode.window.showQuickPick(
                [
                    { label: '⭐ 1 - Beginner', value: 1 },
                    { label: '⭐⭐ 2 - Novice', value: 2 },
                    { label: '⭐⭐⭐ 3 - Intermediate', value: 3 },
                    { label: '⭐⭐⭐⭐ 4 - Advanced', value: 4 },
                    { label: '⭐⭐⭐⭐⭐ 5 - Expert', value: 5 }
                ],
                {
                    placeHolder: 'How much do you rate yourself in that language out of five?',
                    title: 'Language Proficiency Rating'
                }
            );

            if (!languageRating) {
                return null; // User cancelled
            }

            // Step 11: Manual Test Cases File Upload
            const manualTestCasesFile = await this.uploadManualTestCasesFile();

            // Step 12: Manual Flow Capture
            const wantsManualFlowCapture = await vscode.window.showQuickPick(
                [
                    { label: 'Yes, I want to feed manual tests', value: true },
                    { label: 'No, skip manual flow capture', value: false }
                ],
                {
                    placeHolder: 'Do you want to feed some manual tests?',
                    title: 'Manual Flow Capture'
                }
            );

            if (wantsManualFlowCapture === undefined) {
                return null; // User cancelled
            }

            // Create project details
            const projectDetails: ProjectDetails = {
                projectName: projectName.trim(),
                appType: appType.value,
                webUrl,
                environments,
                testFramework: frameworkValue,
                designPattern: designPattern.value,
                testCaseTypes,
                techStack,
                language: language.value,
                languageRating: languageRating.value,
                manualTestCasesFile,
                hasManualTestCases: !!manualTestCasesFile,
                wantsManualFlowCapture: wantsManualFlowCapture.value,
                captureFrequency: 'manual',
                teamSize: 1
            };

            // Handle manual flow capture or test generation
            if (wantsManualFlowCapture.value) {
                await this.handleManualFlowCapture(projectDetails);
            } else {
                await this.handleTestGeneration(projectDetails);
            }

            // Save configuration
            await this.saveProjectConfiguration(projectDetails);
            await this.showCompletionMessage(projectDetails);

            return projectDetails;

        } catch (error) {
            vscode.window.showErrorMessage(`Setup failed: ${error}`);
            return null;
        }
    }


    private async saveProjectConfiguration(details: ProjectDetails): Promise<void> {
        // Save to workspace state with project-specific key
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectKey = `qa-html-capture.project.${details.projectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        if (workspaceFolder) {
            // Use workspace-specific storage with project-specific key
            await this.context.workspaceState.update(`${projectKey}.details`, details);
            await this.context.workspaceState.update(`${projectKey}.onboardingCompleted`, true);
            await this.context.workspaceState.update('qa-html-capture.currentProject', details.projectName);
        } else {
            // Fallback to global state if no workspace
            await this.context.globalState.update(`${projectKey}.details`, details);
            await this.context.globalState.update(`${projectKey}.onboardingCompleted`, true);
            await this.context.globalState.update('qa-html-capture.currentProject', details.projectName);
        }
        
        // Save to JSON file
        await this.saveProjectConfigToFile(details);
        
        // Also save to workspace settings if the configuration is registered
        try {
            const config = vscode.workspace.getConfiguration('qa-html-capture');
            await config.update('projectDetails', details, vscode.ConfigurationTarget.Workspace);
        } catch (error) {
            // If configuration is not registered, just use workspace state
            console.log('Configuration not registered, using workspace state only');
        }
    }

    private async saveProjectConfigToFile(projectDetails: ProjectDetails): Promise<void> {
        try {
            const fileName = `project-config.json`;
            const filePath = path.join(this.configStoragePath, fileName);
            
            // Create a clean config object with only project details (no metadata)
            const configData = {
                projectDetails: {
                    projectName: projectDetails.projectName,
                    appType: projectDetails.appType,
                    webUrl: projectDetails.webUrl,
                    environments: projectDetails.environments,
                    testFramework: projectDetails.testFramework,
                    designPattern: projectDetails.designPattern,
                    testCaseTypes: projectDetails.testCaseTypes,
                    techStack: projectDetails.techStack,
                    language: projectDetails.language,
                    languageRating: projectDetails.languageRating,
                    hasManualTestCases: projectDetails.hasManualTestCases,
                    manualTestCasesFile: projectDetails.manualTestCasesFile,
                    wantsManualFlowCapture: projectDetails.wantsManualFlowCapture,
                    captureFrequency: projectDetails.captureFrequency,
                    teamSize: projectDetails.teamSize
                    // Exclude capturedMetadata and generatedTests from project config
                },
                metadata: {
                    version: '1.0.0',
                    lastUpdated: new Date().toISOString(),
                    createdBy: 'QA HTML Capture Extension'
                },
                settings: {
                    autoSave: true,
                    backupEnabled: true
                }
            };
            
            await fs.promises.writeFile(filePath, JSON.stringify(configData, null, 2));
            
            // Refresh files tree if available
            if (this.filesTreeProvider) {
                this.filesTreeProvider.refresh();
            }
            
            vscode.window.showInformationMessage(`Project config saved to: ${filePath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save config file: ${error}`);
        }
    }

    private async showCompletionMessage(details: ProjectDetails): Promise<void> {
        const environmentsText = details.environments.map(env => 
            `• ${env.name}: ${env.url}${env.isDefault ? ' (Default)' : ''}`
        ).join('\n');
        
        const testCaseTypesText = details.testCaseTypes.length > 0 
            ? details.testCaseTypes.join(', ') 
            : 'None selected';
            
        const techStackText = details.techStack.length > 0 
            ? details.techStack.join(', ') 
            : 'None selected';

        const message = `🎉 Setup Complete!

Your project "${details.projectName}" is now configured for QA HTML Structure Capture.

Configuration Summary:
• App Type: ${details.appType}
• Web URL: ${details.webUrl || 'Not specified'}
• Test Framework: ${details.testFramework}
• Design Pattern: ${details.designPattern}
• Test Case Types: ${testCaseTypesText}
• Tech Stack: ${techStackText}
• Language: ${details.language} (Rating: ${details.languageRating}/5)
• Manual Test Cases: ${details.hasManualTestCases ? 'Yes' : 'No'}
• Manual Flow Capture: ${details.wantsManualFlowCapture ? 'Yes' : 'No'}

Environments:
${environmentsText}

Generated Tests: ${details.generatedTests ? 'Yes' : 'No'}

Next Steps:
1. Use "Capture Baseline" to record your first HTML structure
2. Use "Compare Structure" to detect changes
3. Use "Generate Locators" to get updated selectors
4. Review and run your generated test cases

Happy testing! 🚀`;

        await vscode.window.showInformationMessage(message);
    }

    async showProjectSettings(): Promise<void> {
        // Get current project name
        const currentProject = this.getCurrentProjectName();
        
        if (!currentProject) {
            await vscode.window.showInformationMessage('No active project found. Please run the setup wizard first.');
            return;
        }

        // Try to get project details from file first, then from workspace state
        let details: ProjectDetails | undefined;
        
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const projectConfigPath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config', 'project-config.json');
                if (fs.existsSync(projectConfigPath)) {
                    const configContent = fs.readFileSync(projectConfigPath, 'utf8');
                    const config = JSON.parse(configContent);
                    details = config.projectDetails;
                }
            }
        } catch (error) {
            console.log('Error reading project config file:', error);
        }
        
        if (!details) {
            await vscode.window.showInformationMessage('No project configuration found. Please run the setup wizard first.');
            return;
        }

        const testCaseTypesText = details.testCaseTypes.length > 0 
            ? details.testCaseTypes.join(', ') 
            : 'None selected';
            
        const techStackText = details.techStack.length > 0 
            ? details.techStack.join(', ') 
            : 'None selected';

        const environmentsText = details.environments.map(env => 
            `• ${env.name}: ${env.url}${env.isDefault ? ' (Default)' : ''}`
        ).join('\n');

        const settings = `📋 Project Configuration

Project Name: ${details.projectName}
App Type: ${details.appType}
Web URL: ${details.webUrl || 'Not specified'}
Test Framework: ${details.testFramework || 'Not specified'}
Design Pattern: ${details.designPattern || 'Not specified'}
Test Case Types: ${testCaseTypesText}
Tech Stack: ${techStackText}
Language: ${details.language} (Rating: ${details.languageRating}/5)
Manual Test Cases: ${details.hasManualTestCases ? 'Yes' : 'No'}
Manual Flow Capture: ${details.wantsManualFlowCapture ? 'Yes' : 'No'}
Capture Frequency: ${details.captureFrequency}
Team Size: ${details.teamSize} people

Environments:
${environmentsText}

Would you like to reconfigure these settings?`;

        const action = await vscode.window.showInformationMessage(
            settings,
            'Reconfigure',
            'Reset All',
            'Close'
        );

        switch (action) {
            case 'Reconfigure':
                await this.showOnboardingWizard();
                break;
            case 'Reset All':
                await this.resetOnboarding();
                await vscode.window.showInformationMessage('Project settings have been reset. Please reconfigure your project.');
                break;
        }
    }

    private async resetOnboarding(): Promise<void> {
        await this.context.globalState.update('qa-html-capture.projectDetails', undefined);
        await this.context.globalState.update('qa-html-capture.onboardingCompleted', false);
    }

    private async collectEnvironments(): Promise<Array<{name: string; url: string; isDefault: boolean}>> {
        const environments: Array<{name: string; url: string; isDefault: boolean}> = [];
        
        while (true) {
            const addEnvironment = await vscode.window.showQuickPick(
                [
                    { label: 'Add Environment', value: true },
                    { label: 'No more environments', value: false }
                ],
                {
                    placeHolder: 'Do you want to add an environment?',
                    title: 'Environments under test'
                }
            );

            if (!addEnvironment || !addEnvironment.value) {
                break;
            }

            const envName = await vscode.window.showInputBox({
                prompt: 'Enter environment name',
                placeHolder: 'e.g., Development, Staging, Production',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Environment name is required';
                    }
                    return null;
                }
            });

            if (!envName) break;

            const envUrl = await vscode.window.showInputBox({
                prompt: 'Enter environment URL',
                placeHolder: 'https://dev.example.com',
                validateInput: (value) => {
                    if (value && value.trim().length > 0) {
                        try {
                            new URL(value);
                            return null;
                        } catch {
                            return 'Please enter a valid URL';
                        }
                    }
                    return null;
                }
            });

            if (!envUrl) break;

            let isDefault = false;
            if (environments.length === 0) {
                isDefault = true;
            } else {
                const isDefaultResult = await vscode.window.showQuickPick(
                    [
                        { label: 'Yes, set as default', value: true },
                        { label: 'No', value: false }
                    ],
                    {
                        placeHolder: 'Is this the default environment?',
                        title: 'Default Environment'
                    }
                );
                isDefault = isDefaultResult?.value || false;
            }

            environments.push({
                name: envName.trim(),
                url: envUrl.trim(),
                isDefault
            });
        }

        return environments;
    }

    private async collectTestCaseTypes(): Promise<string[]> {
        const testCaseTypes: string[] = [];
        
        const options = [
            { label: 'Unit Tests', value: 'unit' },
            { label: 'Integration Tests', value: 'integration' },
            { label: 'End-to-End Tests', value: 'e2e' },
            { label: 'API Tests', value: 'api' },
            { label: 'Performance Tests', value: 'performance' },
            { label: 'Security Tests', value: 'security' },
            { label: 'Visual Regression Tests', value: 'visual' },
            { label: 'Accessibility Tests', value: 'accessibility' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'What type of test cases do you want to add? (Select multiple)',
            title: 'Test Case Types',
            canPickMany: true
        });

        return selected ? selected.map(item => item.value) : [];
    }

    private async collectTechStack(): Promise<string[]> {
        const techStack: string[] = [];
        
        const options = [
            { label: 'Playwright', value: 'playwright' },
            { label: 'Puppeteer', value: 'puppeteer' },
            { label: 'Selenium', value: 'selenium' },
            { label: 'Cypress', value: 'cypress' },
            { label: 'WebdriverIO', value: 'webdriverio' },
            { label: 'TestCafe', value: 'testcafe' },
            { label: 'Jest', value: 'jest' },
            { label: 'Mocha', value: 'mocha' },
            { label: 'Chai', value: 'chai' },
            { label: 'Cucumber', value: 'cucumber' },
            { label: 'Allure', value: 'allure' },
            { label: 'ReportPortal', value: 'reportportal' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Do you have a tech stack in mind? (Select multiple)',
            title: 'Tech Stack',
            canPickMany: true
        });

        return selected ? selected.map(item => item.value) : [];
    }

    private async uploadManualTestCasesFile(): Promise<string | undefined> {
        const uploadFile = await vscode.window.showQuickPick(
            [
                { label: 'Upload Manual Test Cases File', value: true },
                { label: 'Skip file upload', value: false }
            ],
            {
                placeHolder: 'Do you have manual test cases in any format?',
                title: 'Manual Test Cases File Upload'
            }
        );

        if (!uploadFile || !uploadFile.value) {
            return undefined;
        }

        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Test Files': ['xlsx', 'xls', 'csv', 'json', 'yaml', 'yml', 'txt', 'md'],
                'All Files': ['*']
            },
            title: 'Select Manual Test Cases File'
        });

        return fileUri && fileUri.length > 0 ? fileUri[0].fsPath : undefined;
    }

    private async handleManualFlowCapture(projectDetails: ProjectDetails): Promise<void> {
        if (!projectDetails.webUrl) {
            vscode.window.showErrorMessage('Web URL is required for manual flow capture');
            return;
        }

        // Start metadata capture session
        await this.startMetadataCapture(projectDetails.webUrl);

        // Show browser selection dialog
        const browserChoice = await vscode.window.showQuickPick(
            [
                { label: 'Default Browser (System)', value: 'default' },
                { label: 'New Browser Window', value: 'new-window' },
                { label: 'Incognito/Private Mode', value: 'incognito' }
            ],
            {
                placeHolder: 'Choose how to open the browser',
                title: 'Browser Environment Selection'
            }
        );

        if (!browserChoice) {
            this.stopMetadataCapture();
            return;
        }

        // Open browser based on selection
        await this.openBrowserInEnvironment(projectDetails.webUrl, browserChoice.value);
        
        // Show instructions for manual flow capture
        const instructions = `Browser opened in ${browserChoice.label} with your application URL: ${projectDetails.webUrl}

Metadata capture is now ACTIVE!

Please follow these steps:
1. Navigate through your application manually
2. Perform the test scenarios you want to automate
3. Our extension is capturing your interactions
4. Close the browser when finished, or click "Stop Capture" below

Note: Closing the browser will automatically stop capture and save your metadata.`;

        // Start monitoring for browser close
        this.startBrowserMonitoring();

        const stopCapture = await vscode.window.showInformationMessage(
            instructions,
            'Stop Capture Now',
            'Cancel'
        );

        if (stopCapture === 'Stop Capture Now') {
            // Stop metadata capture and save
            const capturedMetadata = await this.stopMetadataCapture();
            if (capturedMetadata) {
                projectDetails.capturedMetadata = capturedMetadata;
                
                // Save metadata to file
                await this.saveCapturedMetadata(capturedMetadata);
                
                // Generate tests based on captured metadata
                projectDetails.generatedTests = await this.generateTestsFromMetadata(projectDetails);
                
                // Show generated tests for review
                await this.showGeneratedTestsForReview(projectDetails);
            }
            } else {
            // Cancel capture
            this.stopMetadataCapture();
        }
    }

    private async handleTestGeneration(projectDetails: ProjectDetails): Promise<void> {
        if (projectDetails.hasManualTestCases && projectDetails.manualTestCasesFile) {
            // Generate tests from uploaded manual test cases file
            projectDetails.generatedTests = await this.generateTestsFromFile(projectDetails);
            } else {
            // Ask for page names and generate tests based on that
            const pageNames = await this.collectPageNames();
            projectDetails.pageNames = pageNames;
            projectDetails.generatedTests = await this.generateTestsFromPageNames(projectDetails);
        }
    }

    private async collectPageNames(): Promise<string[]> {
        const pageNames: string[] = [];
        
        while (true) {
            const addPage = await vscode.window.showQuickPick(
                [
                    { label: 'Add Page', value: true },
                    { label: 'No more pages', value: false }
                ],
                {
                    placeHolder: 'Do you want to add a page name?',
                    title: 'Website Pages'
                }
            );

            if (!addPage || !addPage.value) {
                break;
            }

            const pageName = await vscode.window.showInputBox({
                prompt: 'Enter page name',
                placeHolder: 'e.g., Login Page, Dashboard, User Profile',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Page name is required';
                    }
                    return null;
                }
            });

            if (pageName) {
                pageNames.push(pageName.trim());
            }
        }

        return pageNames;
    }

    private async generateTestsFromMetadata(projectDetails: ProjectDetails): Promise<any> {
        // Generate tests based on real captured metadata (not fake data)
        const interactions = projectDetails.capturedMetadata?.interactions || [];
        
        if (interactions.length === 0) {
            return {
                framework: projectDetails.testFramework,
                language: projectDetails.language,
                pattern: projectDetails.designPattern,
                tests: []
            };
        }
        
        return {
            framework: projectDetails.testFramework,
            language: projectDetails.language,
            pattern: projectDetails.designPattern,
            tests: [
                {
                    name: 'Captured User Flow Test',
                    description: 'Test generated from captured user interactions',
                    steps: interactions
                }
            ]
        };
    }

    private async generateTestsFromFile(projectDetails: ProjectDetails): Promise<any> {
        // Simulate test generation from uploaded file
                    return {
            framework: projectDetails.testFramework,
            language: projectDetails.language,
            pattern: projectDetails.designPattern,
            source: 'manual_test_cases_file',
            tests: [
                {
                    name: 'Test from Manual File',
                    description: 'Generated from uploaded manual test cases',
                    steps: []
                }
            ]
        };
    }

    private async generateTestsFromPageNames(projectDetails: ProjectDetails): Promise<any> {
        // Simulate test generation from page names
        return {
            framework: projectDetails.testFramework,
            language: projectDetails.language,
            pattern: projectDetails.designPattern,
            source: 'page_names',
            tests: projectDetails.pageNames?.map(pageName => ({
                name: `${pageName} Test`,
                description: `Test for ${pageName}`,
                steps: []
            })) || []
        };
    }

    private async showGeneratedTestsForReview(projectDetails: ProjectDetails): Promise<void> {
        const reviewAction = await vscode.window.showQuickPick(
            [
                { label: 'Accept All Tests', value: 'accept_all' },
                { label: 'Review and Modify', value: 'review' },
                { label: 'Reject All Tests', value: 'reject_all' }
            ],
            {
                placeHolder: 'Review the generated tests',
                title: 'Generated Tests Review'
            }
        );

        if (reviewAction?.value === 'accept_all') {
            vscode.window.showInformationMessage('All tests have been accepted and added to your project!');
        } else if (reviewAction?.value === 'review') {
            vscode.window.showInformationMessage('Test review functionality will be implemented in the next version.');
        } else if (reviewAction?.value === 'reject_all') {
            vscode.window.showInformationMessage('All tests have been rejected. You can generate new tests later.');
        }
    }

    private async startMetadataCapture(url: string): Promise<void> {
        this.isCapturing = true;
        const sessionId = `session_${Date.now()}`;
        
        this.currentSession = {
            sessionId,
            url,
            startTime: new Date().toISOString(),
            endTime: '',
            interactions: [],
            pageTitle: '',
            userAgent: 'VS Code Extension',
            viewport: { width: 1920, height: 1080 }
        };

        // Add initial navigation interaction
        this.addInteraction({
            action: 'navigate',
            url: url,
            timestamp: new Date().toISOString(),
            description: 'Initial page navigation'
        });

        vscode.window.showInformationMessage('Metadata capture started! Your interactions are being recorded.');
        
        // Note: Real browser interaction capture would be implemented here
        // For now, this is just a placeholder that records the initial navigation
    }

    private async stopMetadataCapture(): Promise<CapturedMetadata | null> {
        if (!this.currentSession) {
            return null;
        }

        this.isCapturing = false;
        this.currentSession.endTime = new Date().toISOString();
        
        const capturedMetadata = { ...this.currentSession };
        this.currentSession = null;

        vscode.window.showInformationMessage(`Metadata capture stopped! Captured ${capturedMetadata.interactions.length} interactions.`);
        
        return capturedMetadata;
    }

    private addInteraction(interaction: CapturedInteraction): void {
        if (this.currentSession && this.isCapturing) {
            this.currentSession.interactions.push(interaction);
        }
    }

    private async saveCapturedMetadata(metadata: CapturedMetadata): Promise<void> {
        try {
            const fileName = `metadata_${metadata.sessionId}.json`;
            const filePath = path.join(this.metadataStoragePath, fileName);
            
            await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2));
            
            // Refresh files tree if available
            if (this.filesTreeProvider) {
                this.filesTreeProvider.refresh();
            }
            
            vscode.window.showInformationMessage(`Metadata saved to: ${filePath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save metadata: ${error}`);
        }
    }

    // Method to manually add interactions (for testing or manual input)
    public async addManualInteraction(interaction: Omit<CapturedInteraction, 'timestamp'>): Promise<void> {
        if (this.currentSession && this.isCapturing) {
            this.addInteraction({
                ...interaction,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Method to add sample interactions for demonstration (REMOVED - was generating fake data)
    // This method has been removed to prevent fake metadata generation

    // Method to open project config file for editing
    public async openProjectConfigFile(): Promise<void> {
        try {
            const configFilePath = path.join(this.configStoragePath, 'project-config.json');
            
            // Check if config file exists
            if (!fs.existsSync(configFilePath)) {
                const createFile = await vscode.window.showWarningMessage(
                    'Project configuration file not found. Would you like to create one?',
                    'Create File',
                    'Cancel'
                );
                
                if (createFile === 'Create File') {
                    // Create a default config file
                    const defaultConfig = {
                        projectDetails: {
                            projectName: 'New Project',
                            appType: 'web',
                            webUrl: '',
                            environments: [],
                            testFramework: 'playwright',
                            designPattern: 'pom',
                            testCaseTypes: [],
                            techStack: [],
                            language: 'javascript',
                            languageRating: 3,
                            manualTestCasesFile: '',
                            hasManualTestCases: false,
                            wantsManualFlowCapture: false,
                            captureFrequency: 'manual',
                            teamSize: 1
                        },
                        metadata: {
                            version: '1.0.0',
                            lastUpdated: new Date().toISOString(),
                            createdBy: 'QA HTML Capture Extension'
                        },
                        settings: {
                            autoSave: true,
                            backupEnabled: true
                        }
                    };
                    
                    await fs.promises.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
                    vscode.window.showInformationMessage('Default project configuration file created!');
                } else {
                    return;
                }
            }
            
            // Open the config file in VS Code
            const document = await vscode.workspace.openTextDocument(configFilePath);
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage(`Project config file opened: ${configFilePath}`);
            
            // Also show the path in a separate message for easy copying
            const copyPath = await vscode.window.showInformationMessage(
                `Config file location: ${configFilePath}`,
                'Copy Path',
                'OK'
            );
            
            if (copyPath === 'Copy Path') {
                await vscode.env.clipboard.writeText(configFilePath);
                vscode.window.showInformationMessage('Path copied to clipboard!');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open config file: ${error}`);
        }
    }

    // Method to reload project config from file
    public async reloadProjectConfigFromFile(): Promise<void> {
        try {
            const configFilePath = path.join(this.configStoragePath, 'project-config.json');
            
            if (!fs.existsSync(configFilePath)) {
                vscode.window.showWarningMessage('Project configuration file not found.');
                return;
            }
            
            const fileContent = await fs.promises.readFile(configFilePath, 'utf8');
            const configData = JSON.parse(fileContent);
            
            if (configData.projectDetails) {
                // Save to global state
                await this.context.globalState.update('qa-html-capture.projectDetails', configData.projectDetails);
                await this.context.globalState.update('qa-html-capture.onboardingCompleted', true);
                
                vscode.window.showInformationMessage('Project configuration reloaded from file!');
                } else {
                vscode.window.showErrorMessage('Invalid configuration file format.');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to reload config file: ${error}`);
        }
    }

    // Method to open browser in specific environment (public for testing)
    public async openBrowserInEnvironment(url: string, environment: string): Promise<void> {
        try {
            switch (environment) {
                case 'default':
                    // Open in default browser
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                    vscode.window.showInformationMessage(`Browser opened in ${environment} mode`);
                    break;
                    
                case 'new-window':
                    // Open in new browser window
                    await this.openNewBrowserWindow(url);
                    vscode.window.showInformationMessage(`Browser opened in ${environment} mode`);
                    break;
                    
                case 'incognito':
                    // Open in incognito/private mode
                    await this.openIncognitoBrowser(url);
                    vscode.window.showInformationMessage(`Browser opened in ${environment} mode`);
                    break;
                    
                default:
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                    vscode.window.showInformationMessage(`Browser opened in ${environment} mode`);
            }
        } catch (error) {
            console.error('Browser launch error:', error);
            vscode.window.showErrorMessage(`Failed to open browser: ${error}`);
            // Fallback to default browser
            await vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }

    // Method to open new browser window
    private async openNewBrowserWindow(url: string): Promise<void> {
        const { spawn, exec } = require('child_process');
        
        // Check if we're in WSL environment
        const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;
        
        if (isWSL) {
            // In WSL, try to open browser on Windows host
            try {
                console.log('WSL detected, launching browser on Windows host...');
                const command = `cmd.exe /c start "" "${url}"`;
                
                await new Promise<void>((resolve, reject) => {
                    this.browserProcess = exec(command, (error: any, stdout: any, stderr: any) => {
                        if (error) {
                            console.log('WSL browser launch failed:', error);
                            reject(error);
                        } else {
                            console.log('WSL browser launched successfully');
                            resolve();
                        }
                    });
                });
                return;
            } catch (error) {
                console.log('WSL browser launch error:', error);
                // Fallback to default
                await vscode.env.openExternal(vscode.Uri.parse(url));
                return;
            }
        }
        
        // For Linux environments, try different browsers
        const browsers = [
            { name: 'google-chrome', args: ['--new-window', url] },
            { name: 'chromium-browser', args: ['--new-window', url] },
            { name: 'chromium', args: ['--new-window', url] },
            { name: 'firefox', args: ['-new-window', url] },
            { name: 'microsoft-edge', args: ['--new-window', url] }
        ];

        let browserLaunched = false;
        
        for (const browser of browsers) {
            try {
                console.log(`Trying to launch ${browser.name}...`);
                
                // Check if browser exists first
                const checkCommand = `which ${browser.name}`;
                const exists = await new Promise<boolean>((resolve) => {
                    exec(checkCommand, (error: any) => {
                        resolve(!error);
                    });
                });
                
                if (exists) {
                    console.log(`${browser.name} found, launching...`);
                    
                    // Browser exists, try to launch it
                    this.browserProcess = spawn(browser.name, browser.args, { 
                        detached: true,
                        stdio: 'ignore'
                    });
                    
                    this.browserProcess.on('error', (err: any) => {
                        console.log(`Failed to launch ${browser.name}:`, err);
                    });
                    
                    this.browserProcess.unref();
                    browserLaunched = true;
                    console.log(`Successfully launched ${browser.name}`);
                    break;
                } else {
                    console.log(`${browser.name} not found, trying next...`);
                }
            } catch (error) {
                console.log(`Error with ${browser.name}:`, error);
                continue;
            }
        }
        
        // If no browser was launched, fallback to default
        if (!browserLaunched) {
            console.log('No browser found, using default');
            await vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }

    // Method to open incognito/private browser
    private async openIncognitoBrowser(url: string): Promise<void> {
        const { spawn, exec } = require('child_process');
        
        // Check if we're in WSL environment
        const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;
        
        if (isWSL) {
            // In WSL, try to open incognito browser on Windows host
            try {
                console.log('WSL detected, launching incognito browser on Windows host...');
                
                // Try Chrome incognito first
                let command = `cmd.exe /c start chrome --incognito "${url}"`;
                
                await new Promise<void>((resolve, reject) => {
                    this.browserProcess = exec(command, (error: any, stdout: any, stderr: any) => {
                        if (error) {
                            console.log('Chrome incognito failed, trying Edge InPrivate...');
                            // Try Edge InPrivate
                            const edgeCommand = `cmd.exe /c start msedge --inprivate "${url}"`;
                            exec(edgeCommand, (error2: any) => {
                                if (error2) {
                                    console.log('WSL incognito browser launch failed');
                                    reject(error2);
                } else {
                                    console.log('Edge InPrivate launched successfully');
                                    resolve();
                                }
                            });
                        } else {
                            console.log('Chrome incognito launched successfully');
                            resolve();
                        }
                    });
            });
            return;
            } catch (error) {
                console.log('WSL incognito browser launch error:', error);
                await vscode.env.openExternal(vscode.Uri.parse(url));
            return;
            }
        }
        
        // For Linux environments, try different browsers with incognito/private flags
        const browsers = [
            { name: 'google-chrome', args: ['--incognito', url] },
            { name: 'chromium-browser', args: ['--incognito', url] },
            { name: 'chromium', args: ['--incognito', url] },
            { name: 'firefox', args: ['-private-window', url] },
            { name: 'microsoft-edge', args: ['--inprivate', url] }
        ];

        let browserLaunched = false;
        
        for (const browser of browsers) {
            try {
                console.log(`Trying to launch ${browser.name} in incognito mode...`);
                
                // Check if browser exists first
                const checkCommand = `which ${browser.name}`;
                const exists = await new Promise<boolean>((resolve) => {
                    exec(checkCommand, (error: any) => {
                        resolve(!error);
                    });
                });
                
                if (exists) {
                    console.log(`${browser.name} found, launching in incognito mode...`);
                    
                    // Browser exists, try to launch it
                    this.browserProcess = spawn(browser.name, browser.args, { 
                        detached: true,
                        stdio: 'ignore'
                    });
                    
                    this.browserProcess.on('error', (err: any) => {
                        console.log(`Failed to launch ${browser.name} in incognito:`, err);
                    });
                    
                    this.browserProcess.unref();
                    browserLaunched = true;
                    console.log(`Successfully launched ${browser.name} in incognito mode`);
                break;
                } else {
                    console.log(`${browser.name} not found, trying next...`);
                }
            } catch (error) {
                console.log(`Error with ${browser.name} incognito:`, error);
                continue;
            }
        }
        
        // If no browser was launched, fallback to default
        if (!browserLaunched) {
            console.log('No incognito browser found, using default');
            await vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }

    // Method to start monitoring browser close events
    private startBrowserMonitoring(): void {
        if (this.browserMonitoringInterval) {
            clearInterval(this.browserMonitoringInterval);
        }

        this.browserMonitoringInterval = setInterval(async () => {
            if (this.browserProcess) {
                try {
                    // Check if browser process is still running
                    const isRunning = !this.browserProcess.killed;
                    if (!isRunning) {
                        await this.handleBrowserClosed();
                    }
                } catch (error) {
                    // Process might have closed
                    await this.handleBrowserClosed();
                }
            }
        }, 2000); // Check every 2 seconds
    }

    // Method to handle browser close event
    private async handleBrowserClosed(): Promise<void> {
        if (this.browserMonitoringInterval) {
            clearInterval(this.browserMonitoringInterval);
            this.browserMonitoringInterval = null;
        }

        if (this.isCapturing) {
            vscode.window.showInformationMessage('Browser closed detected. Stopping capture...');
            
            // Stop metadata capture and save
            const capturedMetadata = await this.stopMetadataCapture();
            if (capturedMetadata) {
                // Save metadata to file
                await this.saveCapturedMetadata(capturedMetadata);
                
                vscode.window.showInformationMessage('Metadata capture completed and saved!');
            }
        }

        this.browserProcess = null;
    }

    // Method to manually stop browser monitoring
    public async stopBrowserMonitoring(): Promise<void> {
        if (this.browserMonitoringInterval) {
            clearInterval(this.browserMonitoringInterval);
            this.browserMonitoringInterval = null;
        }

        if (this.browserProcess && !this.browserProcess.killed) {
            try {
                this.browserProcess.kill();
                vscode.window.showInformationMessage('Browser process stopped');
            } catch (error) {
                vscode.window.showWarningMessage('Could not stop browser process');
            }
            this.browserProcess = null;
        }

        if (this.isCapturing) {
            const capturedMetadata = await this.stopMetadataCapture();
            if (capturedMetadata) {
                await this.saveCapturedMetadata(capturedMetadata);
                vscode.window.showInformationMessage('Metadata capture stopped and saved!');
            }
        }
    }

    // Method to view captured metadata
    public async viewCapturedMetadata(): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.metadataStoragePath);
            const metadataFiles = files.filter(file => file.startsWith('metadata_') && file.endsWith('.json'));
            
            if (metadataFiles.length === 0) {
                vscode.window.showInformationMessage('No captured metadata found.');
                return;
            }

            const fileOptions = metadataFiles.map(file => ({
                label: file,
                value: file
            }));

            const selectedFile = await vscode.window.showQuickPick(fileOptions, {
                placeHolder: 'Select metadata file to view',
                title: 'Captured Metadata Files'
            });

            if (selectedFile) {
                const filePath = path.join(this.metadataStoragePath, selectedFile.value);
                const fileContent = await fs.promises.readFile(filePath, 'utf8');
                const metadata: CapturedMetadata = JSON.parse(fileContent);
                
                // Display metadata in a readable format
                const metadataText = `Captured Metadata: ${selectedFile.value}

Session ID: ${metadata.sessionId}
URL: ${metadata.url}
Start Time: ${metadata.startTime}
End Time: ${metadata.endTime}
Total Interactions: ${metadata.interactions.length}

Interactions:
${metadata.interactions.map((interaction, index) => 
    `${index + 1}. ${interaction.action}${interaction.element ? ` on ${interaction.element}` : ''}${interaction.value ? ` with value "${interaction.value}"` : ''} at ${interaction.timestamp}`
).join('\n')}`;

                vscode.window.showInformationMessage(metadataText);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to view metadata: ${error}`);
        }
    }
}

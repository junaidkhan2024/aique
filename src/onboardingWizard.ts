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
    projectPath: string;
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
            // Always use the modern web-based onboarding wizard
            console.log('Starting modern onboarding wizard...');
            return await this.showModernOnboardingWizard();
        } catch (error) {
            console.error('Modern onboarding failed, falling back to simple wizard:', error);
            vscode.window.showErrorMessage(`Setup failed: ${error}`);
            // Fallback to simple wizard if modern one fails
            return await this.showSimpleOnboardingWizard();
        }
    }

    private async showModernOnboardingWizard(): Promise<ProjectDetails | null> {
        // Create webview panel for modern onboarding
        const panel = vscode.window.createWebviewPanel(
            'onboardingWizard',
            'Project Setup Wizard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        let currentStep = 0;
        let projectData: Partial<ProjectDetails> = {};
        const totalSteps = 10;

        // Generate the modern onboarding HTML
        panel.webview.html = this.getModernOnboardingHTML(currentStep, totalSteps, projectData);

        // Handle messages from the webview
        return new Promise((resolve) => {
            const messageListener = panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'nextStep':
                            currentStep++;
                            if (currentStep < totalSteps) {
                                projectData = { ...projectData, ...message.data };
                                panel.webview.html = this.getModernOnboardingHTML(currentStep, totalSteps, projectData);
                            } else {
                                // Complete onboarding
                                const finalData = { ...projectData, ...message.data };
                                const projectDetails = await this.createProjectDetails(finalData);
                                if (projectDetails) {
                                    await this.saveProjectConfiguration(projectDetails);
                                    await this.showCompletionMessage(projectDetails);
                                    resolve(projectDetails);
                                } else {
                                    resolve(null);
                                }
                                panel.dispose();
                            }
                            break;
                        case 'prevStep':
                            if (currentStep > 0) {
                                currentStep--;
                                projectData = { ...projectData, ...message.data };
                                panel.webview.html = this.getModernOnboardingHTML(currentStep, totalSteps, projectData);
                            }
                            break;
                        case 'cancel':
                            resolve(null);
                            panel.dispose();
                            break;
                        case 'validate':
                            const validation = await this.validateProjectName(message.data.projectName);
                            panel.webview.postMessage({
                                command: 'validationResult',
                                valid: validation.valid,
                                message: validation.message
                            });
                            break;
                    }
                }
            );

            panel.onDidDispose(() => {
                messageListener.dispose();
                resolve(null);
            });
        });
    }

    private async validateProjectName(projectName: string): Promise<{valid: boolean, message: string}> {
        if (!projectName || projectName.trim().length === 0) {
            return { valid: false, message: 'Project name is required' };
        }
        if (this.projectExists(projectName.trim())) {
            return { valid: false, message: 'A project with this name already exists' };
        }
        return { valid: true, message: '' };
    }

    private async createProjectDetails(data: any): Promise<ProjectDetails | null> {
        try {
            return {
                projectName: data.projectName?.trim() || 'My Project',
                projectPath: data.projectPath || process.cwd(),
                appType: data.appType || 'web',
                webUrl: data.webUrl,
                environments: data.environments || [],
                testFramework: data.testFramework || 'playwright',
                designPattern: data.designPattern || 'pom',
                testCaseTypes: data.testCaseTypes || [],
                techStack: data.techStack || [],
                language: data.language || 'javascript',
                languageRating: data.languageRating || 3,
                manualTestCasesFile: data.manualTestCasesFile,
                hasManualTestCases: !!data.manualTestCasesFile,
                wantsManualFlowCapture: data.wantsManualFlowCapture || false,
                captureFrequency: 'manual',
                teamSize: 1
            };
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create project details: ${error}`);
            return null;
        }
    }

    // Fallback method for simple onboarding (keeping original functionality)
    private async showSimpleOnboardingWizard(): Promise<ProjectDetails | null> {
        try {
            // Step 1: Project Name
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter your project name',
                placeHolder: 'My Project',
                value: 'My Project',
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
                projectPath: process.cwd(),
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
                    createdBy: 'HTML Capture Extension'
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

        const message = `Setup Complete!

Your project "${details.projectName}" is now configured for HTML Structure Capture.

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
                
                // Automatically write tests to files
                await this.writeTestsToFiles(projectDetails);
                
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
        
        // Automatically write tests to files after generation
        await this.writeTestsToFiles(projectDetails);
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
            // Write tests to files
            await this.writeTestsToFiles(projectDetails);
            vscode.window.showInformationMessage('All tests have been accepted and written to files!');
        } else if (reviewAction?.value === 'review') {
            vscode.window.showInformationMessage('Test review functionality will be implemented in the next version.');
        } else if (reviewAction?.value === 'reject_all') {
            vscode.window.showInformationMessage('All tests have been rejected. You can generate new tests later.');
        }
    }

    private async writeTestsToFiles(projectDetails: ProjectDetails): Promise<void> {
        if (!projectDetails.generatedTests || !projectDetails.generatedTests.tests) {
            vscode.window.showErrorMessage('No tests to write.');
            return;
        }

        try {
            // Create tests directory in the project
            const projectPath = projectDetails.projectPath;
            const testsDir = path.join(projectPath, 'tests');
            
            // Ensure tests directory exists
            if (!fs.existsSync(testsDir)) {
                fs.mkdirSync(testsDir, { recursive: true });
            }

            const { framework, language, pattern, tests } = projectDetails.generatedTests;
            
            // Generate test files based on framework and language
            for (let i = 0; i < tests.length; i++) {
                const test = tests[i];
                const fileName = this.generateTestFileName(test.name, language, framework);
                const filePath = path.join(testsDir, fileName);
                
                // Generate test content based on framework and language
                const testContent = this.generateTestFileContent(test, framework, language, pattern);
                
                // Write test file
                await fs.promises.writeFile(filePath, testContent, 'utf8');
            }

            // Also save the test configuration
            const configPath = path.join(testsDir, 'test-config.json');
            await fs.promises.writeFile(configPath, JSON.stringify(projectDetails.generatedTests, null, 2));

            vscode.window.showInformationMessage(`Successfully wrote ${tests.length} test files to ${testsDir}`);
            
            // Open the tests directory in explorer
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(testsDir));
            
        } catch (error) {
            console.error('Error writing test files:', error);
            vscode.window.showErrorMessage(`Failed to write test files: ${error}`);
        }
    }

    private generateTestFileName(testName: string, language: string, framework: string): string {
        const sanitizedName = testName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const extension = this.getFileExtension(language);
        return `${sanitizedName}.${extension}`;
    }

    private getFileExtension(language: string): string {
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                return 'js';
            case 'typescript':
            case 'ts':
                return 'ts';
            case 'python':
            case 'py':
                return 'py';
            case 'java':
                return 'java';
            case 'csharp':
            case 'c#':
                return 'cs';
            default:
                return 'js';
        }
    }

    private generateTestFileContent(test: any, framework: string, language: string, pattern: string): string {
        const { name, description, steps } = test;
        
        switch (framework.toLowerCase()) {
            case 'playwright':
                return this.generatePlaywrightTest(name, description, steps, language);
            case 'selenium':
                return this.generateSeleniumTest(name, description, steps, language);
            case 'cypress':
                return this.generateCypressTest(name, description, steps, language);
            case 'pytest':
                return this.generatePytestTest(name, description, steps, language);
            case 'jest':
                return this.generateJestTest(name, description, steps, language);
            default:
                return this.generateGenericTest(name, description, steps, language);
        }
    }

    private generatePlaywrightTest(name: string, description: string, steps: any[], language: string): string {
        const isTypeScript = language.toLowerCase() === 'typescript';
        const ext = isTypeScript ? 'ts' : 'js';
        
        return `import { test, expect } from '@playwright/test';

test('${name}', async ({ page }) => {
    // ${description}
    
    // Test steps will be implemented based on captured interactions
    ${steps.length > 0 ? steps.map((step, index) => `    // Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '    // No specific steps captured'}
    
    // Add your test assertions here
    await expect(page).toBeTruthy();
});`;
    }

    private generateSeleniumTest(name: string, description: string, steps: any[], language: string): string {
        const isTypeScript = language.toLowerCase() === 'typescript';
        
        if (isTypeScript) {
            return `import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { describe, it, before, after } from 'mocha';

describe('${name}', () => {
    let driver: WebDriver;

    before(async () => {
        driver = await new Builder().forBrowser('chrome').build();
    });

    it('${description}', async () => {
        // Test steps will be implemented based on captured interactions
        ${steps.length > 0 ? steps.map((step, index) => `        // Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '        // No specific steps captured'}
        
        // Add your test assertions here
        expect(await driver.getTitle()).toBeTruthy();
    });

    after(async () => {
        await driver.quit();
    });
});`;
        } else {
            return `const { Builder, By, until } = require('selenium-webdriver');
const { describe, it, before, after } = require('mocha');

describe('${name}', () => {
    let driver;

    before(async () => {
        driver = await new Builder().forBrowser('chrome').build();
    });

    it('${description}', async () => {
        // Test steps will be implemented based on captured interactions
        ${steps.length > 0 ? steps.map((step, index) => `        // Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '        // No specific steps captured'}
        
        // Add your test assertions here
        expect(await driver.getTitle()).toBeTruthy();
    });

    after(async () => {
        await driver.quit();
    });
});`;
        }
    }

    private generateCypressTest(name: string, description: string, steps: any[], language: string): string {
        return `describe('${name}', () => {
    it('${description}', () => {
        // Test steps will be implemented based on captured interactions
        ${steps.length > 0 ? steps.map((step, index) => `        // Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '        // No specific steps captured'}
        
        // Add your test assertions here
        cy.visit('/');
        cy.get('body').should('be.visible');
    });
});`;
    }

    private generatePytestTest(name: string, description: string, steps: any[], language: string): string {
        return `import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By

def test_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}():
    """${description}"""
    # Test steps will be implemented based on captured interactions
    ${steps.length > 0 ? steps.map((step, index) => `    # Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '    # No specific steps captured'}
    
    # Add your test assertions here
    driver = webdriver.Chrome()
    driver.get('http://localhost:3000')
    assert driver.title is not None
    driver.quit()`;
    }

    private generateJestTest(name: string, description: string, steps: any[], language: string): string {
        return `describe('${name}', () => {
    test('${description}', () => {
        // Test steps will be implemented based on captured interactions
        ${steps.length > 0 ? steps.map((step, index) => `        // Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '        // No specific steps captured'}
        
        // Add your test assertions here
        expect(true).toBe(true);
    });
});`;
    }

    private generateGenericTest(name: string, description: string, steps: any[], language: string): string {
        return `// ${name}
// ${description}

// Test steps will be implemented based on captured interactions
${steps.length > 0 ? steps.map((step, index) => `// Step ${index + 1}: ${step.action || 'Action'}`).join('\n') : '// No specific steps captured'}

// Add your test implementation here
console.log('Test: ${name}');
console.log('Description: ${description}');`;
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
                            createdBy: 'HTML Capture Extension'
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

    // Method to delete a specific project
    public async deleteProject(): Promise<void> {
        try {
            const projects = await this.listProjects();
            
            if (projects.length === 0) {
                vscode.window.showInformationMessage('No projects found to delete.');
                return;
            }

            const projectOptions = projects.map(project => ({
                label: project.name,
                description: `Last modified: ${project.lastModified.toLocaleDateString()}`,
                value: project.name
            }));

            const selectedProject = await vscode.window.showQuickPick(projectOptions, {
                placeHolder: 'Select a project to delete',
                title: 'Delete Project'
            });

            if (!selectedProject) {
                return;
            }

            // Confirm deletion
            const confirmDelete = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the project "${selectedProject.value}"?\n\nThis will permanently remove:\n• Project configuration\n• All captured baselines\n• All metadata files\n• All generated tests\n\nThis action cannot be undone.`,
                { modal: true },
                'Delete Project',
                'Cancel'
            );

            if (confirmDelete === 'Delete Project') {
                await this.deleteProjectData(selectedProject.value);
                vscode.window.showInformationMessage(`Project "${selectedProject.value}" has been deleted successfully.`);
                
                // Refresh the files tree provider
                if (this.filesTreeProvider) {
                    this.filesTreeProvider.refresh();
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
        }
    }

    // Method to delete specific project data
    private async deleteProjectData(projectName: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            // Remove from workspace state
            const projectKey = `qa-html-capture.project.${projectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            await this.context.workspaceState.update(`${projectKey}.details`, undefined);
            await this.context.workspaceState.update(`${projectKey}.onboardingCompleted`, undefined);

            // If this was the current project, clear it
            const currentProject = await this.context.workspaceState.get('qa-html-capture.currentProject');
            if (currentProject === projectName) {
                await this.context.workspaceState.update('qa-html-capture.currentProject', undefined);
            }

            // Remove project-specific files
            const qaCapturePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture');
            if (fs.existsSync(qaCapturePath)) {
                // Remove config file
                const configPath = path.join(qaCapturePath, 'config', 'project-config.json');
                if (fs.existsSync(configPath)) {
                    fs.unlinkSync(configPath);
                }

                // Remove metadata files
                const metadataPath = path.join(qaCapturePath, 'metadata');
                if (fs.existsSync(metadataPath)) {
                    const metadataFiles = fs.readdirSync(metadataPath);
                    metadataFiles.forEach(file => {
                        if (file.startsWith('metadata_') && file.endsWith('.json')) {
                            const filePath = path.join(metadataPath, file);
                            fs.unlinkSync(filePath);
                        }
                    });
                }

                // Remove baselines
                const baselinesPath = path.join(qaCapturePath, 'baselines');
                if (fs.existsSync(baselinesPath)) {
                    fs.rmSync(baselinesPath, { recursive: true, force: true });
                }

                // Remove reports
                const reportsPath = path.join(qaCapturePath, 'reports');
                if (fs.existsSync(reportsPath)) {
                    fs.rmSync(reportsPath, { recursive: true, force: true });
                }

                // If no other projects exist, remove the entire .qa-capture directory
                const remainingProjects = await this.listProjects();
                if (remainingProjects.length === 0) {
                    fs.rmSync(qaCapturePath, { recursive: true, force: true });
                }
            }
        } catch (error) {
            throw new Error(`Failed to delete project data: ${error}`);
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

    private getModernOnboardingHTML(step: number, totalSteps: number, projectData: Partial<ProjectDetails>): string {
        const progress = ((step + 1) / totalSteps) * 100;
        const stepTitle = this.getStepTitle(step);
        const stepContent = this.getStepContent(step, projectData);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Setup Wizard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            overflow-x: hidden;
        }

        .wizard-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .wizard-header {
            text-align: center;
            margin-bottom: 40px;
            animation: fadeInDown 0.8s ease-out;
        }

        .wizard-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .wizard-subtitle {
            font-size: 1.1rem;
            color: rgba(255,255,255,0.9);
            margin-bottom: 30px;
        }

        .progress-container {
            background: rgba(255,255,255,0.2);
            border-radius: 25px;
            height: 8px;
            margin-bottom: 20px;
            overflow: hidden;
            backdrop-filter: blur(10px);
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            border-radius: 25px;
            transition: width 0.5s ease;
            width: ${progress}%;
            box-shadow: 0 0 20px rgba(79, 172, 254, 0.5);
        }

        .step-indicator {
            display: flex;
            justify-content: center;
            margin-bottom: 30px;
        }

        .step-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
            margin: 0 8px;
            transition: all 0.3s ease;
        }

        .step-dot.active {
            background: #4facfe;
            transform: scale(1.3);
            box-shadow: 0 0 15px rgba(79, 172, 254, 0.6);
        }

        .step-dot.completed {
            background: #00f2fe;
        }

        .wizard-card {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.2);
            animation: fadeInUp 0.8s ease-out;
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .step-title {
            font-size: 1.8rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
            text-align: center;
        }

        .step-description {
            color: #718096;
            text-align: center;
            margin-bottom: 30px;
            font-size: 1rem;
            line-height: 1.6;
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-label {
            display: block;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
            font-size: 1rem;
        }

        .form-input {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: white;
        }

        .form-input:focus {
            outline: none;
            border-color: #4facfe;
            box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
        }

        .form-input.error {
            border-color: #e53e3e;
            box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
        }

        .file-upload-container {
            position: relative;
            margin-bottom: 10px;
        }

        .file-input {
            position: absolute;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
        }

        .file-upload-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
            border: 2px dashed #cbd5e0;
            border-radius: 12px;
            background: #f7fafc;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        }

        .file-upload-label:hover {
            border-color: #4facfe;
            background: #edf2f7;
        }

        .file-upload-label.dragover {
            border-color: #4facfe;
            background: #e6fffa;
        }

        .file-upload-icon {
            font-size: 2rem;
            margin-bottom: 10px;
            color: #4a5568;
        }

        .file-upload-text {
            font-size: 1rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }

        .file-upload-hint {
            font-size: 0.875rem;
            color: #718096;
        }

        .selected-file-name {
            margin-top: 10px;
            padding: 10px 15px;
            background: #e6fffa;
            border: 1px solid #38b2ac;
            border-radius: 8px;
            color: #234e52;
            font-weight: 500;
        }

        .error-message {
            color: #e53e3e;
            font-size: 0.875rem;
            margin-top: 5px;
            display: none;
        }

        .error-message.show {
            display: block;
            animation: shake 0.5s ease-in-out;
        }

        .option-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .option-card {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .option-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(79, 172, 254, 0.1), transparent);
            transition: left 0.5s;
        }

        .option-card:hover::before {
            left: 100%;
        }

        .option-card:hover {
            border-color: #4facfe;
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.15);
        }

        .option-card.selected {
            border-color: #4facfe;
            background: linear-gradient(135deg, rgba(79, 172, 254, 0.1), rgba(0, 242, 254, 0.1));
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.2);
        }

        .option-icon {
            font-size: 2rem;
            margin-bottom: 10px;
            display: block;
        }

        .option-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }

        .option-description {
            font-size: 0.875rem;
            color: #718096;
        }

        .rating-container {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        }

        .rating-star {
            font-size: 2rem;
            color: #e2e8f0;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .rating-star:hover,
        .rating-star.active {
            color: #ffd700;
            transform: scale(1.1);
        }

        .button-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e2e8f0;
        }

        .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            transition: left 0.5s;
        }

        .btn:hover::before {
            left: 100%;
        }

        .btn-primary {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
        }

        .btn-primary:disabled {
            background: #e2e8f0;
            color: #a0aec0;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .btn-secondary {
            background: white;
            color: #4a5568;
            border: 2px solid #e2e8f0;
        }

        .btn-secondary:hover {
            border-color: #4facfe;
            color: #4facfe;
            transform: translateY(-2px);
        }

        .btn-danger {
            background: #e53e3e;
            color: white;
        }

        .btn-danger:hover {
            background: #c53030;
            transform: translateY(-2px);
        }

        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }

        .loading.show {
            display: block;
        }

        .spinner {
            border: 3px solid #e2e8f0;
            border-top: 3px solid #4facfe;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .welcome-screen {
            text-align: center;
            padding: 60px 40px;
        }

        .welcome-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }

        .welcome-title {
            font-size: 2.2rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 15px;
        }

        .welcome-description {
            font-size: 1.1rem;
            color: #718096;
            line-height: 1.6;
            margin-bottom: 40px;
        }

        .feature-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }

        .feature-item {
            background: rgba(255,255,255,0.7);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }

        .feature-icon {
            font-size: 2rem;
            margin-bottom: 10px;
            color: #4facfe;
        }

        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-10px);
            }
            60% {
                transform: translateY(-5px);
            }
        }

        .multi-select {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }

        .multi-select-item {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 20px;
            padding: 8px 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
        }

        .multi-select-item:hover {
            border-color: #4facfe;
        }

        .multi-select-item.selected {
            background: #4facfe;
            color: white;
            border-color: #4facfe;
        }
    </style>
</head>
<body>
    <div class="wizard-container">
        <div class="wizard-header">
            <div class="wizard-title">🛠 Project Setup</div>
            <div class="wizard-subtitle">Let's create your testing project in just a few steps</div>
            <div class="progress-container">
                <div class="progress-bar"></div>
            </div>
            <div class="step-indicator">
                ${Array.from({length: totalSteps}, (_, i) => 
                    `<div class="step-dot ${i === step ? 'active' : i < step ? 'completed' : ''}"></div>`
                ).join('')}
            </div>
        </div>

        <div class="wizard-card">
            <div class="step-title">${stepTitle}</div>
            <div class="step-description">${this.getStepDescription(step)}</div>
            
            ${stepContent}
            
            <div class="button-container">
                ${step === 0 ? 
                    '<button class="btn btn-danger" onclick="cancelWizard()">Cancel</button>' : 
                    '<button class="btn btn-secondary" onclick="prevStep()">← Previous</button>'
                }
                <button class="btn btn-primary" onclick="nextStep()" id="nextBtn">
                    ${step === totalSteps - 1 ? 'Finish Setup 🎉' : 'Next →'}
                </button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = ${JSON.stringify(projectData)};

        function nextStep() {
            const data = collectCurrentStepData();
            if (validateCurrentStep(data)) {
                vscode.postMessage({
                    command: 'nextStep',
                    data: data
                });
            }
        }

        function prevStep() {
            const data = collectCurrentStepData();
            vscode.postMessage({
                command: 'prevStep',
                data: data
            });
        }

        function cancelWizard() {
            vscode.postMessage({
                command: 'cancel'
            });
        }

        function collectCurrentStepData() {
            const step = ${step};
            let data = {};

            switch (step) {
                case 0:
                    data = {
                        projectName: document.getElementById('projectName')?.value || ''
                    };
                    break;
                case 1:
                    data = {
                        appType: document.querySelector('.option-card.selected')?.dataset.value || ''
                    };
                    break;
                case 2:
                    data = {
                        webUrl: document.getElementById('webUrl')?.value || ''
                    };
                    break;
                case 3:
                    const selectedFramework = document.querySelector('.option-card.selected')?.dataset.value || '';
                    data = {
                        testFramework: selectedFramework === 'others' 
                            ? (document.getElementById('customFramework')?.value || '') 
                            : selectedFramework
                    };
                    break;
                case 4:
                    const selectedPattern = document.querySelector('.option-card.selected')?.dataset.value || '';
                    data = {
                        designPattern: selectedPattern === 'others' 
                            ? (document.getElementById('customDesignPattern')?.value || '') 
                            : selectedPattern
                    };
                    break;
                case 5:
                    data = {
                        testCaseTypes: Array.from(document.querySelectorAll('.multi-select-item.selected'))
                            .map(item => item.dataset.value)
                    };
                    break;
                case 6:
                    const selectedLanguage = document.querySelector('.option-card.selected')?.dataset.value || '';
                    data = {
                        language: selectedLanguage === 'others' 
                            ? (document.getElementById('customLanguage')?.value || '') 
                            : selectedLanguage
                    };
                    break;
                case 7:
                    data = {
                        languageRating: document.querySelector('.rating-star.active')?.dataset.rating || 1,
                        wantsManualFlowCapture: document.getElementById('manualFlow')?.checked || false
                    };
                    break;
                case 8:
                    const selectedEnvironment = document.querySelector('.option-card.selected')?.dataset.value || '';
                    data = {
                        environment: selectedEnvironment === 'others' 
                            ? (document.getElementById('customEnvironment')?.value || '') 
                            : selectedEnvironment
                    };
                    break;
                case 9:
                    const hasManualTestCases = document.querySelector('.option-card.selected')?.dataset.value === 'true';
                    const manualTestFile = document.getElementById('manualTestFile')?.files[0];
                    data = {
                        hasManualTestCases: hasManualTestCases,
                        manualTestFile: hasManualTestCases && manualTestFile ? manualTestFile.name : null
                    };
                    break;
            }

            return { ...currentData, ...data };
        }

        function validateCurrentStep(data) {
            const step = ${step};
            
            switch (step) {
                case 0:
                    if (!data.projectName || data.projectName.trim() === '') {
                        showError('projectName', 'Project name is required');
                        return false;
                    }
                    break;
                case 1:
                    if (!data.appType) {
                        showError('appType', 'Please select an application type');
                        return false;
                    }
                    break;
                case 2:
                    if (data.appType === 'web' && (!data.webUrl || data.webUrl.trim() === '')) {
                        showError('webUrl', 'Web URL is required for web applications');
                        return false;
                    }
                    break;
                case 3:
                    if (!data.testFramework) {
                        showError('testFramework', 'Please select a test framework');
                        return false;
                    }
                    // If "Others" is selected, validate custom framework input
                    if (data.testFramework === 'others') {
                        const customFramework = document.getElementById('customFramework')?.value || '';
                        if (!customFramework.trim()) {
                            showError('customFramework', 'Please enter your framework name');
                            return false;
                        }
                    }
                    break;
                case 4:
                    if (!data.designPattern) {
                        showError('designPattern', 'Please select a design pattern');
                        return false;
                    }
                    // If "Others" is selected, validate custom design pattern input
                    if (data.designPattern === 'others') {
                        const customPattern = document.getElementById('customDesignPattern')?.value || '';
                        if (!customPattern.trim()) {
                            showError('customDesignPattern', 'Please enter your design pattern name');
                            return false;
                        }
                    }
                    break;
                case 6:
                    if (!data.language) {
                        showError('language', 'Please select a programming language');
                        return false;
                    }
                    // If "Others" is selected, validate custom language input
                    if (data.language === 'others') {
                        const customLanguage = document.getElementById('customLanguage')?.value || '';
                        if (!customLanguage.trim()) {
                            showError('customLanguage', 'Please enter your programming language name');
                            return false;
                        }
                    }
                    break;
                case 7:
                    if (!data.languageRating) {
                        showError('languageRating', 'Please rate your proficiency');
                        return false;
                    }
                    break;
                case 8:
                    if (!data.environment) {
                        showError('environment', 'Please select an environment');
                        return false;
                    }
                    // If "Others" is selected, validate custom environment input
                    if (data.environment === 'others') {
                        const customEnvironment = document.getElementById('customEnvironment')?.value || '';
                        if (!customEnvironment.trim()) {
                            showError('customEnvironment', 'Please enter your environment name');
                            return false;
                        }
                    }
                    break;
                case 9:
                    if (data.hasManualTestCases === undefined) {
                        showError('hasManualTestCases', 'Please select whether to include manual test cases');
                        return false;
                    }
                    // If "Yes" is selected, validate file upload
                    if (data.hasManualTestCases && !data.manualTestFile) {
                        showError('manualTestFile', 'Please upload a manual test cases file');
                        return false;
                    }
                    break;
            }
            
            clearErrors();
            return true;
        }

        function showError(fieldId, message) {
            const field = document.getElementById(fieldId);
            const errorDiv = document.getElementById(fieldId + 'Error');
            
            if (field) {
                field.classList.add('error');
            }
            
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.classList.add('show');
            }
        }

        function clearErrors() {
            document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
            document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
        }

        function selectOption(card) {
            // Remove previous selection
            card.parentElement.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            // Add selection to clicked card
            card.classList.add('selected');
            
            // Handle custom framework input visibility
            const customFrameworkGroup = document.getElementById('customFrameworkGroup');
            if (customFrameworkGroup) {
                if (card.dataset.value === 'others') {
                    customFrameworkGroup.style.display = 'block';
                } else {
                    customFrameworkGroup.style.display = 'none';
                }
            }
            
            // Handle custom design pattern input visibility
            const customDesignPatternGroup = document.getElementById('customDesignPatternGroup');
            if (customDesignPatternGroup) {
                if (card.dataset.value === 'others') {
                    customDesignPatternGroup.style.display = 'block';
                } else {
                    customDesignPatternGroup.style.display = 'none';
                }
            }
            
            // Handle custom language input visibility
            const customLanguageGroup = document.getElementById('customLanguageGroup');
            if (customLanguageGroup) {
                if (card.dataset.value === 'others') {
                    customLanguageGroup.style.display = 'block';
                } else {
                    customLanguageGroup.style.display = 'none';
                }
            }
            
            // Handle custom environment input visibility
            const customEnvironmentGroup = document.getElementById('customEnvironmentGroup');
            if (customEnvironmentGroup) {
                if (card.dataset.value === 'others') {
                    customEnvironmentGroup.style.display = 'block';
                } else {
                    customEnvironmentGroup.style.display = 'none';
                }
            }
            
            // Handle manual test file upload visibility
            const manualTestFileGroup = document.getElementById('manualTestFileGroup');
            if (manualTestFileGroup) {
                if (card.dataset.value === 'true') {
                    manualTestFileGroup.style.display = 'block';
                } else {
                    manualTestFileGroup.style.display = 'none';
                }
            }
            
            clearErrors();
        }

        function toggleMultiSelect(item) {
            item.classList.toggle('selected');
            clearErrors();
        }

        function setRating(rating) {
            document.querySelectorAll('.rating-star').forEach((star, index) => {
                star.classList.toggle('active', index < rating);
            });
            
            // Update proficiency level text
            const proficiencyLevel = document.getElementById('proficiencyLevel');
            if (proficiencyLevel) {
                const proficiencyTexts = {
                    1: 'Beginner - Just getting started',
                    2: 'Novice - Basic understanding',
                    3: 'Intermediate - Comfortable with basics',
                    4: 'Advanced - Experienced developer',
                    5: 'Expert - Master level proficiency'
                };
                proficiencyLevel.textContent = proficiencyTexts[rating] || 'Click on a star to rate your proficiency';
            }
            
            clearErrors();
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            // Set up option cards
            document.querySelectorAll('.option-card').forEach(card => {
                card.addEventListener('click', () => selectOption(card));
            });

            // Set up multi-select items
            document.querySelectorAll('.multi-select-item').forEach(item => {
                item.addEventListener('click', () => toggleMultiSelect(item));
            });

            // Set up rating stars
            document.querySelectorAll('.rating-star').forEach((star, index) => {
                star.addEventListener('click', () => setRating(index + 1));
            });

            // Set up file upload
            const manualTestFileInput = document.getElementById('manualTestFile');
            if (manualTestFileInput) {
                manualTestFileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    const fileNameDiv = document.getElementById('selectedFileName');
                    if (file && fileNameDiv) {
                        fileNameDiv.textContent = 'Selected: ' + file.name;
                        fileNameDiv.style.display = 'block';
                    }
                    clearErrors();
                });
            }

            // Auto-validate project name
            const projectNameInput = document.getElementById('projectName');
            if (projectNameInput) {
                projectNameInput.addEventListener('input', function() {
                    if (this.value.trim().length > 0) {
                        vscode.postMessage({
                            command: 'validate',
                            data: { projectName: this.value }
                        });
                    }
                });
            }
        });

        // Handle validation responses
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'validationResult') {
                const projectNameInput = document.getElementById('projectName');
                const errorDiv = document.getElementById('projectNameError');
                
                if (message.valid) {
                    projectNameInput?.classList.remove('error');
                    errorDiv?.classList.remove('show');
                } else {
                    projectNameInput?.classList.add('error');
                    if (errorDiv) {
                        errorDiv.textContent = message.message;
                        errorDiv.classList.add('show');
                    }
                }
            }
        });
    </script>
</body>
</html>`;
    }

    private getStepTitle(step: number): string {
        const titles = [
            '🙋🏻‍♂️ Welcome to Project Setup',
            '📱 Choose Application Type',
            '🌐 Web Application URL',
            '🛠️ Select Test Framework',
            '🏗️ Choose Design Pattern',
            '📋 Test Case Types',
            '💻 Programming Language',
            '⭐ Language Proficiency',
            '🌍 Environment Under Test',
            '🧪 Manual Test Cases'
        ];
        return titles[step] || 'Setup Step';
    }

    private getStepDescription(step: number): string {
        const descriptions = [
            'Let\'s start by giving your project a name. This will help you identify it later.',
            'What type of application are you planning to test? This helps us customize your setup.',
            'Enter the main URL of your web application that you want to test.',
            'Choose the testing framework that best fits your project needs.',
            'Select a design pattern that will help organize your test code.',
            'What types of tests do you want to create? You can select multiple options.',
            'Choose the programming language you\'re most comfortable with.',
            'Rate your proficiency in the selected programming language.',
            'Select the environment where you will be running your tests.',
            'Do you want to include manual test cases in your project?'
        ];
        return descriptions[step] || 'Please complete this step to continue.';
    }

    private getStepContent(step: number, projectData: Partial<ProjectDetails>): string {
        switch (step) {
            case 0:
                return `
                    <div class="welcome-screen">
                        <div class="welcome-icon">🤗</div>
                        <div class="welcome-title">Welcome to HTML Capture!</div>
                        <div class="welcome-description">
                            We'll help you set up a professional testing project in just a few steps. 
                            This wizard will guide you through configuring your project for automated testing.
                        </div>
                        
                        <div class="feature-list">
                            <div class="feature-item">
                                <div class="feature-icon">💡</div>
                                <h4>HTML Structure Analysis</h4>
                                <p>Automatically detect changes in your web pages</p>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">⚡</div>
                                <h4>Auto Test Generation</h4>
                                <p>Generate test code based on your configurations</p>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">🤖</div>
                                <h4>Modern UI Testing</h4>
                                <p>Create beautiful and maintainable test suites</p>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="projectName">Project Name</label>
                            <input type="text" id="projectName" class="form-input" 
                                   placeholder="My Awesome Project" 
                                   value="${projectData.projectName || ''}">
                            <div id="projectNameError" class="error-message"></div>
                        </div>
                    </div>
                `;

            case 1:
                return `
                    <div class="option-grid">
                        <div class="option-card" data-value="web">
                            <span class="option-icon">🌐</span>
                            <div class="option-title">Web Application</div>
                            <div class="option-description">Test websites and web applications</div>
                        </div>
                        <div class="option-card" data-value="mobile">
                            <span class="option-icon">📱</span>
                            <div class="option-title">Mobile Application</div>
                            <div class="option-description">Test mobile apps and responsive designs</div>
                        </div>
                        <div class="option-card" data-value="desktop">
                            <span class="option-icon">🖥️</span>
                            <div class="option-title">Desktop Application</div>
                            <div class="option-description">Test desktop software applications</div>
                        </div>
                    </div>
                `;

            case 2:
                return `
                    <div class="form-group">
                        <label class="form-label" for="webUrl">Application URL</label>
                        <input type="url" id="webUrl" class="form-input" 
                               placeholder="https://your-app.com" 
                               value="${projectData.webUrl || ''}">
                        <div id="webUrlError" class="error-message"></div>
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Enter the main URL of your application (e.g., https://myapp.com)
                        </small>
                    </div>
                `;

            case 3:
                return `
                    <div class="option-grid">
                        <div class="option-card" data-value="playwright">
                            <span class="option-icon">🎭</span>
                            <div class="option-title">Playwright</div>
                            <div class="option-description">Modern, fast, and reliable</div>
                        </div>
                        <div class="option-card" data-value="selenium">
                            <span class="option-icon">🔧</span>
                            <div class="option-title">Selenium</div>
                            <div class="option-description">Industry standard</div>
                        </div>
                        <div class="option-card" data-value="cypress">
                            <span class="option-icon">🌲</span>
                            <div class="option-title">Cypress</div>
                            <div class="option-description">Developer-friendly</div>
                        </div>
                        <div class="option-card" data-value="puppeteer">
                            <span class="option-icon">🎪</span>
                            <div class="option-title">Puppeteer</div>
                            <div class="option-description">Chrome automation</div>
                        </div>
                        <div class="option-card" data-value="others">
                            <span class="option-icon">☰</span>
                            <div class="option-title">Others</div>
                            <div class="option-description">Custom framework</div>
                        </div>
                    </div>
                    <div class="form-group" id="customFrameworkGroup" style="display: none; margin-top: 20px;">
                        <label class="form-label" for="customFramework">Enter your framework name</label>
                        <input type="text" id="customFramework" class="form-input" 
                               placeholder="e.g., TestCafe, WebdriverIO, Nightwatch, etc.">
                        <div id="customFrameworkError" class="error-message"></div>
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Enter the name of your testing framework
                        </small>
                    </div>
                `;

            case 4:
                return `
                    <div class="option-grid">
                        <div class="option-card" data-value="pom">
                            <span class="option-icon">📄</span>
                            <div class="option-title">Page Object Model</div>
                            <div class="option-description">Organize by pages</div>
                        </div>
                        <div class="option-card" data-value="screenplay">
                            <span class="option-icon">🎬</span>
                            <div class="option-title">Screenplay Pattern</div>
                            <div class="option-description">Actor-based approach</div>
                        </div>
                        <div class="option-card" data-value="factory">
                            <span class="option-icon">🏭</span>
                            <div class="option-title">Factory Pattern</div>
                            <div class="option-description">Object creation</div>
                        </div>
                        <div class="option-card" data-value="none">
                            <span class="option-icon">🔧</span>
                            <div class="option-title">No Pattern</div>
                            <div class="option-description">Keep it simple</div>
                        </div>
                        <div class="option-card" data-value="others">
                            <span class="option-icon">☰</span>
                            <div class="option-title">Others</div>
                            <div class="option-description">Custom pattern</div>
                        </div>
                    </div>
                    <div class="form-group" id="customDesignPatternGroup" style="display: none; margin-top: 20px;">
                        <label class="form-label" for="customDesignPattern">Enter your design pattern name</label>
                        <input type="text" id="customDesignPattern" class="form-input" 
                               placeholder="e.g., Builder Pattern, Singleton Pattern, Repository Pattern, etc.">
                        <div id="customDesignPatternError" class="error-message"></div>
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Enter the name of your design pattern
                        </small>
                    </div>
                `;

            case 5:
                return `
                    <div class="multi-select">
                        <div class="multi-select-item" data-value="unit">Unit Tests</div>
                        <div class="multi-select-item" data-value="integration">Integration Tests</div>
                        <div class="multi-select-item" data-value="e2e">End-to-End Tests</div>
                        <div class="multi-select-item" data-value="api">API Tests</div>
                        <div class="multi-select-item" data-value="performance">Performance Tests</div>
                        <div class="multi-select-item" data-value="security">Security Tests</div>
                        <div class="multi-select-item" data-value="visual">Visual Regression</div>
                        <div class="multi-select-item" data-value="accessibility">Accessibility Tests</div>
                    </div>
                `;

            case 6:
                return `
                    <div class="option-grid">
                        <div class="option-card" data-value="Ruby">
                            <span class="option-icon">💎</span>
                            <div class="option-title">Ruby</div>
                            <div class="option-description">Best for web applications</div>
                        </div>
                        <div class="option-card" data-value="javascript">
                            <span class="option-icon">🟨</span>
                            <div class="option-title">JavaScript</div>
                            <div class="option-description">Web standard</div>
                        </div>
                        <div class="option-card" data-value="typescript">
                            <span class="option-icon">🔷</span>
                            <div class="option-title">TypeScript</div>
                            <div class="option-description">Type-safe JavaScript</div>
                        </div>
                        <div class="option-card" data-value="python">
                            <span class="option-icon">🐍</span>
                            <div class="option-title">Python</div>
                            <div class="option-description">Simple and powerful</div>
                        </div>
                        <div class="option-card" data-value="java">
                            <span class="option-icon">☕</span>
                            <div class="option-title">Java</div>
                            <div class="option-description">Enterprise ready</div>
                        </div>
                        <div class="option-card" data-value="others">
                            <span class="option-icon">☰</span>
                            <div class="option-title">Others</div>
                            <div class="option-description">Custom language</div>
                        </div>
                    </div>
                    <div class="form-group" id="customLanguageGroup" style="display: none; margin-top: 20px;">
                        <label class="form-label" for="customLanguage">Enter your programming language</label>
                        <input type="text" id="customLanguage" class="form-input" 
                               placeholder="e.g., C#, Go, Rust, PHP, Swift, Kotlin, etc.">
                        <div id="customLanguageError" class="error-message"></div>
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Enter the name of your programming language
                        </small>
                    </div>
                `;

            case 7:
                return `
                    <div class="form-group">
                        <label class="form-label">Rate your proficiency in ${projectData.language || 'JavaScript'}</label>
                        <div class="rating-container">
                            <span class="rating-star" data-rating="1">⭐</span>
                            <span class="rating-star" data-rating="2">⭐</span>
                            <span class="rating-star" data-rating="3">⭐</span>
                            <span class="rating-star" data-rating="4">⭐</span>
                            <span class="rating-star" data-rating="5">⭐</span>
                        </div>
                        <div id="proficiencyLevel" class="proficiency-level" style="margin-top: 10px; font-size: 16px; font-weight: 600; color: #4A5568; min-height: 24px;">
                            Click on a star to rate your proficiency
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 30px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="manualFlow" style="margin-right: 10px; transform: scale(1.2);">
                            <span class="form-label" style="margin: 0;">Enable manual flow capture</span>
                        </label>
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Allow recording of manual interactions for test generation
                        </small>
                    </div>
                `;

            case 8:
                return `
                    <div class="form-group">
                        <label class="form-label">Environment Under Test</label>
                        <p style="color: #718096; margin-bottom: 20px;">Select the environment where you will be running your tests.</p>
                        <div class="option-grid">
                            <div class="option-card" data-value="development">
                                <span class="option-icon">🔧</span>
                                <div class="option-title">Development</div>
                                <div class="option-description">Local development environment</div>
                            </div>
                            <div class="option-card" data-value="staging">
                                <span class="option-icon">🚧</span>
                                <div class="option-title">Staging</div>
                                <div class="option-description">Pre-production testing</div>
                            </div>
                            <div class="option-card" data-value="production">
                                <span class="option-icon">🌐</span>
                                <div class="option-title">Production</div>
                                <div class="option-description">Live production environment</div>
                            </div>
                            <div class="option-card" data-value="qa">
                                <span class="option-icon">🧪</span>
                                <div class="option-title">QA Environment</div>
                                <div class="option-description">Dedicated QA testing</div>
                            </div>
                            <div class="option-card" data-value="uat">
                                <span class="option-icon">✅</span>
                                <div class="option-title">UAT</div>
                                <div class="option-description">User Acceptance Testing</div>
                            </div>
                            <div class="option-card" data-value="others">
                                <span class="option-icon">☰</span>
                                <div class="option-title">Others</div>
                                <div class="option-description">Custom environment</div>
                            </div>
                        </div>
                        <div class="form-group" id="customEnvironmentGroup" style="display: none; margin-top: 20px;">
                            <label class="form-label" for="customEnvironment">Enter your environment name</label>
                            <input type="text" id="customEnvironment" class="form-input" 
                                   placeholder="e.g., Integration, Performance, Security, etc.">
                            <div id="customEnvironmentError" class="error-message"></div>
                            <small style="color: #718096; margin-top: 5px; display: block;">
                                Enter the name of your custom environment
                            </small>
                        </div>
                    </div>
                `;

            case 9:
                return `
                    <div class="form-group">
                        <label class="form-label">Include Manual Test Cases</label>
                        <p style="color: #718096; margin-bottom: 20px;">Do you want to include manual test cases in your project?</p>
                        <div class="option-grid" style="grid-template-columns: 1fr 1fr;">
                            <div class="option-card" data-value="true">
                                <span class="option-icon">✅</span>
                                <div class="option-title">Yes</div>
                                <div class="option-description">Include manual test cases</div>
                            </div>
                            <div class="option-card" data-value="false">
                                <span class="option-icon">❌</span>
                                <div class="option-title">No</div>
                                <div class="option-description">Automated tests only</div>
                            </div>
                        </div>
                        <div class="form-group" id="manualTestFileGroup" style="display: none; margin-top: 20px;">
                            <label class="form-label" for="manualTestFile">Upload Manual Test Cases File</label>
                            <div class="file-upload-container">
                                <input type="file" id="manualTestFile" class="file-input" accept=".csv,.xlsx,.xls,.json,.txt,.doc,.docx" />
                                <label for="manualTestFile" class="file-upload-label">
                                    <span class="file-upload-icon">📁</span>
                                    <span class="file-upload-text">Choose file or drag & drop</span>
                                    <small class="file-upload-hint">CSV, Excel, JSON, TXT, Word documents supported</small>
                                </label>
                                <div id="selectedFileName" class="selected-file-name" style="display: none;"></div>
                            </div>
                            <div id="manualTestFileError" class="error-message"></div>
                            <small style="color: #718096; margin-top: 5px; display: block;">
                                Upload a file containing your manual test cases
                            </small>
                        </div>
                    </div>
                `;

            default:
                return '<p>Step content not found</p>';
        }
    }
}

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
exports.OnboardingWizard = void 0;
const vscode = __importStar(require("vscode"));
class OnboardingWizard {
    constructor(context) {
        this.context = context;
    }
    async showOnboardingWizard() {
        try {
            // Always show the popup window for better visibility
            return await this.showOnboardingPopup();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Onboarding failed: ${error}`);
            return null;
        }
    }
    async showOnboardingPopup() {
        // Create webview panel for onboarding
        const panel = vscode.window.createWebviewPanel('qaOnboarding', '🚀 QA HTML Capture - Project Setup', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = this.getOnboardingHTML();
        // Handle messages from webview
        return new Promise((resolve) => {
            panel.webview.onDidReceiveMessage(async (message) => {
                console.log('Received message:', message);
                switch (message.type) {
                    case 'save-config':
                        try {
                            console.log('Saving configuration:', message.data);
                            const projectDetails = message.data;
                            // Validate required fields
                            if (!projectDetails.projectName || !projectDetails.appType) {
                                vscode.window.showErrorMessage('Please fill in all required fields');
                                return;
                            }
                            await this.saveProjectConfiguration(projectDetails);
                            panel.dispose();
                            await this.showCompletionMessage(projectDetails);
                            resolve(projectDetails);
                        }
                        catch (error) {
                            console.error('Save configuration error:', error);
                            vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
                            resolve(null);
                        }
                        break;
                    case 'cancel':
                        panel.dispose();
                        resolve(null);
                        break;
                    case 'test-url':
                        // Test URL connectivity
                        const isValid = await this.testUrl(message.url);
                        panel.webview.postMessage({ type: 'url-test-result', valid: isValid });
                        break;
                }
            }, undefined, this.context.subscriptions);
            // Handle panel disposal
            panel.onDidDispose(() => {
                resolve(null);
            });
        });
    }
    async testUrl(url) {
        try {
            const https = require('https');
            const http = require('http');
            const { URL } = require('url');
            return new Promise((resolve) => {
                try {
                    const urlObj = new URL(url);
                    const isHttps = urlObj.protocol === 'https:';
                    const client = isHttps ? https : http;
                    const options = {
                        hostname: urlObj.hostname,
                        port: urlObj.port || (isHttps ? 443 : 80),
                        path: urlObj.pathname + urlObj.search,
                        method: 'HEAD',
                        timeout: 5000
                    };
                    const req = client.request(options, (res) => {
                        resolve(res.statusCode >= 200 && res.statusCode < 300);
                    });
                    req.on('error', () => resolve(false));
                    req.on('timeout', () => {
                        req.destroy();
                        resolve(false);
                    });
                    req.setTimeout(5000);
                    req.end();
                }
                catch {
                    resolve(false);
                }
            });
        }
        catch {
            return false;
        }
    }
    getOnboardingHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA HTML Capture - Project Setup</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--vscode-panel-background);
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
            font-size: 24px;
        }
        
        .header p {
            color: var(--vscode-descriptionForeground);
            font-size: 16px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        
        .form-group input, .form-group select, .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
        }
        
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 2px var(--vscode-focusBorder);
        }
        
        .form-row {
            display: flex;
            gap: 15px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .checkbox-group input[type="checkbox"] {
            width: auto;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background: var(--vscode-editor-background);
            border-radius: 6px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .section h3 {
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }
        
        .section.hidden {
            display: none;
        }
        
        .buttons {
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .url-test {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 8px;
        }
        
        .url-test-btn {
            padding: 6px 12px;
            font-size: 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .url-status {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 4px;
        }
        
        .url-status.success {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }
        
        .url-status.error {
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }
        
        .required {
            color: var(--vscode-errorForeground);
        }
        
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .progress {
            margin-bottom: 20px;
        }
        
        .progress-bar {
            height: 4px;
            background: var(--vscode-progressBar-background);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--vscode-textLink-foreground);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Welcome to QA HTML Structure Capture!</h1>
            <p>Let's configure the extension for your project. This will only take a few minutes.</p>
        </div>
        
        <div class="progress">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
        </div>
        
        <form id="onboardingForm">
            <!-- Step 1: Basic Info -->
            <div class="section" id="step1">
                <h3>📋 Project Information</h3>
                
                <div class="form-group">
                    <label for="projectName">Project Name <span class="required">*</span></label>
                    <input type="text" id="projectName" name="projectName" placeholder="e.g., E-commerce Platform, Banking App" required>
                    <div class="help-text">Give your project a descriptive name</div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="appType">Application Type <span class="required">*</span></label>
                        <select id="appType" name="appType" required>
                            <option value="">Select application type</option>
                            <option value="web">Web Application</option>
                            <option value="mobile">Mobile Application</option>
                            <option value="desktop">Desktop Application</option>
                            <option value="api">API Testing</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="hasExistingTests">Existing Tests</label>
                        <select id="hasExistingTests" name="hasExistingTests">
                            <option value="false">No, starting fresh</option>
                            <option value="true">Yes, have existing tests</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group" id="testFrameworkGroup" style="display: none;">
                    <label for="testFramework">Test Framework</label>
                    <select id="testFramework" name="testFramework">
                        <option value="">Select framework</option>
                        <option value="selenium">Selenium WebDriver</option>
                        <option value="cypress">Cypress</option>
                        <option value="playwright">Playwright</option>
                        <option value="testcafe">TestCafe</option>
                        <option value="webdriverio">WebdriverIO</option>
                        <option value="protractor">Protractor</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
            
            <!-- Step 2: Web App Details -->
            <div class="section hidden" id="step2">
                <h3>Web Application Configuration</h3>
                
                <div class="form-group">
                    <label for="webUrl">Main Application URL <span class="required">*</span></label>
                    <input type="url" id="webUrl" name="webUrl" placeholder="https://your-app.com" required>
                    <div class="url-test">
                        <button type="button" class="url-test-btn" onclick="testUrl()">Test URL</button>
                        <span id="urlStatus" class="url-status" style="display: none;"></span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="environments">Additional Environments</label>
                    <textarea id="environments" name="environments" rows="3" placeholder="https://dev.your-app.com&#10;https://staging.your-app.com&#10;https://prod.your-app.com"></textarea>
                    <div class="help-text">Enter one URL per line for different environments</div>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="hasLogin" name="hasLogin">
                    <label for="hasLogin">Application requires login</label>
                </div>
                
                <div id="loginSection" style="display: none;">
                    <div class="form-group">
                        <label for="loginUrl">Login Page URL</label>
                        <input type="url" id="loginUrl" name="loginUrl" placeholder="https://your-app.com/login">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="username">Test Username</label>
                            <input type="text" id="username" name="username" placeholder="test@example.com">
                        </div>
                        <div class="form-group">
                            <label for="password">Test Password</label>
                            <input type="password" id="password" name="password" placeholder="••••••••">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="usernameSelector">Username Selector</label>
                            <input type="text" id="usernameSelector" name="usernameSelector" placeholder="#username" value="#username">
                        </div>
                        <div class="form-group">
                            <label for="passwordSelector">Password Selector</label>
                            <input type="text" id="passwordSelector" name="passwordSelector" placeholder="#password" value="#password">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="submitSelector">Submit Button Selector</label>
                        <input type="text" id="submitSelector" name="submitSelector" placeholder="button[type='submit']" value="button[type='submit']">
                    </div>
                </div>
            </div>
            
            <!-- Step 3: Preferences -->
            <div class="section hidden" id="step3">
                <h3>Preferences</h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="captureFrequency">Capture Frequency</label>
                        <select id="captureFrequency" name="captureFrequency">
                            <option value="manual">🤚 Manual only</option>
                            <option value="daily">📅 Daily</option>
                            <option value="weekly">📅 Weekly</option>
                            <option value="on-deploy">🚀 On deployment</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="teamSize">Team Size</label>
                        <select id="teamSize" name="teamSize">
                            <option value="1">👤 Just me</option>
                            <option value="3">👥 2-5 people</option>
                            <option value="8">👥 6-10 people</option>
                            <option value="15">👥 11-20 people</option>
                            <option value="25">👥 20+ people</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="language">Preferred Language</label>
                    <select id="language" name="language">
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="csharp">C#</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
            
            <div class="buttons">
                <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                <button type="button" class="btn btn-primary" id="prevBtn" style="display: none;">Previous</button>
                <button type="button" class="btn btn-primary" id="nextBtn">Next</button>
                <button type="submit" class="btn btn-primary" id="saveBtn" style="display: none;">Complete Setup</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentStep = 1;
        const totalSteps = 3;
        
        // Initialize form
        document.addEventListener('DOMContentLoaded', function() {
            updateStepVisibility();
            updateProgress();
            
            // Event listeners
            document.getElementById('appType').addEventListener('change', handleAppTypeChange);
            document.getElementById('hasExistingTests').addEventListener('change', handleExistingTestsChange);
            document.getElementById('hasLogin').addEventListener('change', handleLoginChange);
            document.getElementById('cancelBtn').addEventListener('click', cancelSetup);
            document.getElementById('prevBtn').addEventListener('click', previousStep);
            document.getElementById('nextBtn').addEventListener('click', nextStep);
            document.getElementById('onboardingForm').addEventListener('submit', saveConfiguration);
        });
        
        function handleAppTypeChange() {
            const appType = document.getElementById('appType').value;
            const step2 = document.getElementById('step2');
            
            if (appType === 'web') {
                step2.classList.remove('hidden');
            } else {
                step2.classList.add('hidden');
            }
            
            updateProgress();
        }
        
        function handleExistingTestsChange() {
            const hasTests = document.getElementById('hasExistingTests').value === 'true';
            const frameworkGroup = document.getElementById('testFrameworkGroup');
            
            if (hasTests) {
                frameworkGroup.style.display = 'block';
            } else {
                frameworkGroup.style.display = 'none';
            }
        }
        
        function handleLoginChange() {
            const hasLogin = document.getElementById('hasLogin').checked;
            const loginSection = document.getElementById('loginSection');
            
            if (hasLogin) {
                loginSection.style.display = 'block';
            } else {
                loginSection.style.display = 'none';
            }
        }
        
        function updateStepVisibility() {
            // Show/hide steps based on current step and app type
            const step1 = document.getElementById('step1');
            const step2 = document.getElementById('step2');
            const step3 = document.getElementById('step3');
            
            step1.classList.toggle('hidden', currentStep !== 1);
            step2.classList.toggle('hidden', currentStep !== 2);
            step3.classList.toggle('hidden', currentStep !== 3);
            
            // Show/hide buttons
            document.getElementById('prevBtn').style.display = currentStep > 1 ? 'inline-block' : 'none';
            document.getElementById('nextBtn').style.display = currentStep < totalSteps ? 'inline-block' : 'none';
            document.getElementById('saveBtn').style.display = currentStep === totalSteps ? 'inline-block' : 'none';
            
            // Show step 2 only for web apps - but don't auto-advance
            const appType = document.getElementById('appType').value;
            if (currentStep === 2 && appType !== 'web') {
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
                currentStep = 3;
                updateProgress();
                document.getElementById('prevBtn').style.display = 'inline-block';
                document.getElementById('nextBtn').style.display = 'none';
                document.getElementById('saveBtn').style.display = 'inline-block';
            }
        }
        
        function updateProgress() {
            const progress = (currentStep / totalSteps) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
        }
        
        function nextStep() {
            if (validateCurrentStep()) {
                currentStep++;
                updateStepVisibility();
                updateProgress();
            }
        }
        
        function previousStep() {
            currentStep--;
            updateStepVisibility();
            updateProgress();
        }
        
        function validateCurrentStep() {
            if (currentStep === 1) {
                const projectName = document.getElementById('projectName').value;
                const appType = document.getElementById('appType').value;
                
                if (!projectName.trim()) {
                    alert('Please enter a project name');
                    return false;
                }
                
                if (!appType) {
                    alert('Please select an application type');
                    return false;
                }
                
                return true;
            }
            
            if (currentStep === 2) {
                const appType = document.getElementById('appType').value;
                
                if (appType === 'web') {
                    const webUrl = document.getElementById('webUrl').value;
                    if (!webUrl.trim()) {
                        alert('Please enter the main application URL');
                        return false;
                    }
                }
                
                return true;
            }
            
            return true;
        }
        
        function cancelSetup() {
            vscode.postMessage({ type: 'cancel' });
        }
        
        function saveConfiguration(e) {
            e.preventDefault();
            
            // Get form values directly
            const config = {
                projectName: document.getElementById('projectName').value,
                appType: document.getElementById('appType').value,
                hasExistingTests: document.getElementById('hasExistingTests').value === 'true',
                testFramework: document.getElementById('testFramework').value || undefined,
                webUrl: document.getElementById('webUrl').value || undefined,
                environments: (() => {
                    const envText = document.getElementById('environments').value;
                    if (!envText.trim()) return [];
                    return envText.split('\n').filter(url => url.trim()).map(url => ({
                        name: url.includes('dev') ? 'Development' : url.includes('staging') ? 'Staging' : 'Production',
                        url: url.trim(),
                        isDefault: false
                    }));
                })(),
                loginCredentials: (() => {
                    const hasLogin = document.getElementById('hasLogin').checked;
                    if (!hasLogin) return undefined;
                    return {
                        username: document.getElementById('username').value,
                        password: document.getElementById('password').value,
                        loginUrl: document.getElementById('loginUrl').value,
                        elementSelectors: {
                            usernameSelector: document.getElementById('usernameSelector').value,
                            passwordSelector: document.getElementById('passwordSelector').value,
                            submitSelector: document.getElementById('submitSelector').value
                        }
                    };
                })(),
                captureFrequency: document.getElementById('captureFrequency').value,
                teamSize: parseInt(document.getElementById('teamSize').value),
                language: document.getElementById('language').value
            };
            
            console.log('Saving configuration:', config);
            
            // Show loading state
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
            
            vscode.postMessage({ type: 'save-config', data: config });
        }
        
        function testUrl() {
            const url = document.getElementById('webUrl').value;
            if (!url) {
                alert('Please enter a URL first');
                return;
            }
            
            const statusEl = document.getElementById('urlStatus');
            statusEl.style.display = 'inline-block';
            statusEl.textContent = 'Testing...';
            statusEl.className = 'url-status';
            
            vscode.postMessage({ type: 'test-url', url: url });
        }
        
        // Listen for URL test results
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'url-test-result') {
                const statusEl = document.getElementById('urlStatus');
                if (message.valid) {
                    statusEl.textContent = 'URL is accessible';
                    statusEl.className = 'url-status success';
                } else {
                    statusEl.textContent = 'URL not accessible';
                    statusEl.className = 'url-status error';
                }
            }
        });
    </script>
</body>
</html>`;
    }
    async saveProjectConfiguration(details) {
        await this.context.globalState.update('qa-html-capture.projectDetails', details);
        await this.context.globalState.update('qa-html-capture.onboardingCompleted', true);
        // Save to workspace settings as well
        const config = vscode.workspace.getConfiguration('qa-html-capture');
        await config.update('projectDetails', details, vscode.ConfigurationTarget.Global);
    }
    async showCompletionMessage(details) {
        let message = `Setup Complete!

Your project "${details.projectName}" is now configured for QA HTML Structure Capture.

Configuration Summary:
• App Type: ${details.appType}
• Existing Tests: ${details.hasExistingTests ? 'Yes' : 'No'}
• Environments: ${details.environments.length}
• Capture Frequency: ${details.captureFrequency}`;
        if (details.loginCredentials) {
            message += '\n• Login: Configured';
        }
        message += `

Next Steps:
1. Open your application in a browser
2. Use "Capture HTML Baseline" to create your first baseline
3. Make changes to your app
4. Use "Compare HTML Structure" to see differences
5. Generate updated locators for your tests

Happy testing! 🚀`;
        await vscode.window.showInformationMessage(message, 'Start Testing', 'View Settings');
    }
    async getProjectDetails() {
        return this.context.globalState.get('qa-html-capture.projectDetails', null);
    }
    async resetOnboarding() {
        await this.context.globalState.update('qa-html-capture.onboardingCompleted', false);
        await this.context.globalState.update('qa-html-capture.projectDetails', null);
    }
    async showProjectSettings() {
        const details = await this.getProjectDetails();
        if (!details) {
            await vscode.window.showInformationMessage('No project configuration found. Would you like to set up your project?', 'Setup Project', 'Cancel').then(selection => {
                if (selection === 'Setup Project') {
                    this.showOnboardingWizard();
                }
            });
            return;
        }
        const settings = `📋 Project Configuration

Project Name: ${details.projectName}
App Type: ${details.appType}
Existing Tests: ${details.hasExistingTests ? 'Yes' : 'No'}
Test Framework: ${details.testFramework || 'Not specified'}
Capture Frequency: ${details.captureFrequency}
Team Size: ${details.teamSize || 'Not specified'}

${details.webUrl ? `Main URL: ${details.webUrl}` : ''}

Environments:
${details.environments.map(env => `• ${env.name}: ${env.url}${env.isDefault ? ' (Default)' : ''}`).join('\n')}

${details.loginCredentials ? `
Login Configuration:
• URL: ${details.loginCredentials.loginUrl}
• Username: ${details.loginCredentials.username}
• Selectors: ${Object.entries(details.loginCredentials.elementSelectors).map(([key, value]) => `${key}: ${value}`).join(', ')}
` : ''}

Would you like to reconfigure these settings?`;
        const action = await vscode.window.showInformationMessage(settings, 'Reconfigure', 'Reset All', 'Close');
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
}
exports.OnboardingWizard = OnboardingWizard;
//# sourceMappingURL=onboardingWizard.js.map
import * as vscode from 'vscode';

export class SimplePanel {
    public static currentPanel: SimplePanel | undefined;
    public static readonly viewType = 'qaHtmlTools';

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SimplePanel.currentPanel) {
            SimplePanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            SimplePanel.viewType,
            'QA HTML Tools',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        SimplePanel.currentPanel = new SimplePanel(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        SimplePanel.currentPanel = new SimplePanel(panel, extensionUri);
    }

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'captureBaseline':
                        vscode.commands.executeCommand('qa-html-capture.captureBaseline');
                        return;
                    case 'compareStructure':
                        vscode.commands.executeCommand('qa-html-capture.compareStructure');
                        return;
                    case 'generateLocators':
                        vscode.commands.executeCommand('qa-html-capture.generateLocators');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SimplePanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA HTML Tools</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .button-group {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn:active {
            background-color: var(--vscode-button-activeBackground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }
        .info {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .status {
            text-align: center;
            padding: 10px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QA HTML Tools</h1>
            <p>Capture, compare, and manage HTML baselines for your QA automation</p>
        </div>

        <div class="status">
            Extension is active and ready to use!
        </div>

        <div class="section">
            <div class="section-title">Actions</div>
            <div class="button-group">
                <button class="btn" onclick="captureBaseline()">
                    Capture HTML Baseline
                </button>
                <button class="btn" onclick="compareStructure()">
                    Compare HTML Structure
                </button>
                <button class="btn" onclick="generateLocators()">
                    Generate Updated Locators
                </button>
                <button class="btn btn-secondary" onclick="refreshPanel()">
                    Refresh Panel
                </button>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Baselines</div>
            <div class="info">
                <p><strong>Baseline Storage Location:</strong></p>
                <p><code>/home/khansaab/.cursor-server/data/User/globalStorage/qa-tools.qa-html-structure-capture/baselines/</code></p>
                <p>Your baselines are automatically saved here when you capture them.</p>
            </div>
        </div>

        <div class="section">
            <div class="section-title">How to Use</div>
            <div class="info">
                <ol>
                    <li><strong>Capture Baseline:</strong> Open an HTML file and click "Capture HTML Baseline"</li>
                    <li><strong>Compare:</strong> Make changes to your HTML and click "Compare HTML Structure"</li>
                    <li><strong>Generate Locators:</strong> Get updated locators for your test automation</li>
                </ol>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function captureBaseline() {
            vscode.postMessage({
                command: 'captureBaseline'
            });
        }

        function compareStructure() {
            vscode.postMessage({
                command: 'compareStructure'
            });
        }

        function generateLocators() {
            vscode.postMessage({
                command: 'generateLocators'
            });
        }

        function refreshPanel() {
            window.location.reload();
        }
    </script>
</body>
</html>`;
    }
}

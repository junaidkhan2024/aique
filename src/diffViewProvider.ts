import * as vscode from 'vscode';
import { ComparisonResult } from './htmlComparator';

export class DiffViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qa-html-capture.diffView';

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            data => {
                switch (data.type) {
                    case 'copyLocator':
                        vscode.env.clipboard.writeText(data.locator);
                        vscode.window.showInformationMessage('Locator copied to clipboard!');
                        break;
                    case 'viewElement':
                        this.highlightElementInEditor(data.xpath);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    public showDiff(comparisonResult: ComparisonResult) {
        // Create a side-by-side diff view
        this.createSideBySideDiff(comparisonResult);
    }

    private async createSideBySideDiff(comparisonResult: ComparisonResult): Promise<void> {
        // Get baseline HTML from comparison result
        const baselineHtml = comparisonResult.baselineHtml;
        const currentHtml = comparisonResult.currentHtml;

        // Create webview panel for side-by-side diff
        const panel = vscode.window.createWebviewPanel(
            'qaHtmlDiff',
            `HTML Diff: ${comparisonResult.baselineName}`,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateSideBySideDiffHTML(baselineHtml, currentHtml, comparisonResult);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'copyLocator':
                        vscode.env.clipboard.writeText(message.locator);
                        vscode.window.showInformationMessage('Locator copied to clipboard!');
                        break;
                    case 'highlightElement':
                        this.highlightElementInEditor(message.xpath);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async getBaselineHtml(baselineId: string): Promise<string> {
        try {
            // Try to get baseline from the HTMLCaptureProvider
            const { HTMLCaptureProvider } = await import('./htmlCaptureProvider');
            const provider = new HTMLCaptureProvider(this.context);
            const baseline = provider.getBaseline(baselineId);
            return baseline ? baseline.html : '';
        } catch (error) {
            console.error('Error retrieving baseline HTML:', error);
            return '';
        }
    }

    private generateSideBySideDiffHTML(baselineHtml: string, currentHtml: string, comparisonResult: ComparisonResult): string {
        const { summary, differences } = comparisonResult;
        
        // Generate highlighted HTML with inline differences
        const highlightedHtml = this.generateHighlightedDiff(baselineHtml, currentHtml, differences);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Structure Diff - ${comparisonResult.baselineName}</title>
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
            height: 100vh;
            overflow: hidden;
        }
        
        .header {
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        
        .summary {
            display: flex;
            gap: 15px;
            font-size: 12px;
        }
        
        .summary-item {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
        }
        
        .added { background: #4caf50; color: white; }
        .removed { background: #f44336; color: white; }
        .modified { background: #9c27b0; color: white; }
        .moved { background: #ff9800; color: white; }
        
        .diff-container {
            display: flex;
            height: calc(100vh - 60px);
        }
        
        .diff-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
        }
        
        .diff-panel:last-child {
            border-right: none;
        }
        
        .panel-header {
            background: var(--vscode-panel-background);
            padding: 8px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-panelTitle-activeForeground);
        }
        
        .baseline-header {
            background: #e3f2fd;
            color: #1976d2;
        }
        
        .current-header {
            background: #f3e5f5;
            color: #7b1fa2;
        }
        
        .code-viewer {
            flex: 1;
            overflow: auto;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            background: var(--vscode-editor-background);
        }
        
        .line {
            display: flex;
            align-items: center;
            margin: 2px 0;
            padding: 2px 8px;
            border-radius: 3px;
        }
        
        .line-number {
            color: var(--vscode-editorLineNumber-foreground);
            margin-right: 15px;
            min-width: 40px;
            text-align: right;
            font-size: 11px;
        }
        
        .line-content {
            flex: 1;
            word-break: break-all;
        }
        
        .added-line {
            background: rgba(76, 175, 80, 0.2);
            border-left: 3px solid #4caf50;
        }
        
        .removed-line {
            background: rgba(244, 67, 54, 0.2);
            border-left: 3px solid #f44336;
        }
        
        .modified-line {
            background: rgba(156, 39, 176, 0.2);
            border-left: 3px solid #9c27b0;
        }
        
        .unchanged-line {
            color: var(--vscode-editor-foreground);
        }
        
        .element-info {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 15px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: none;
        }
        
        .element-info h4 {
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }
        
        .locator-list {
            margin-top: 8px;
        }
        
        .locator {
            background: var(--vscode-textBlockQuote-background);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            margin: 2px 0;
            cursor: pointer;
            border: 1px solid var(--vscode-textBlockQuote-border);
        }
        
        .locator:hover {
            background: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
        }
        
        .controls {
            position: fixed;
            top: 70px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .control-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .synchronized-scroll {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
        }
        
        .diff-highlight {
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: bold;
        }
        
        .diff-added {
            background: rgba(76, 175, 80, 0.3);
            color: #4caf50;
            border: 1px solid #4caf50;
        }
        
        .diff-removed {
            background: rgba(244, 67, 54, 0.3);
            color: #f44336;
            border: 1px solid #f44336;
            text-decoration: line-through;
        }
        
        .diff-modified {
            background: rgba(156, 39, 176, 0.3);
            color: #9c27b0;
            border: 1px solid #9c27b0;
        }
        
        .diff-context {
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>HTML Structure Diff: ${comparisonResult.baselineName}</h1>
        <div class="summary">
            <span class="summary-item added">Added: ${summary.addedElements}</span>
            <span class="summary-item removed">Removed: ${summary.removedElements}</span>
            <span class="summary-item modified">Modified: ${summary.modifiedElements}</span>
            <span class="summary-item moved">Moved: ${summary.movedElements}</span>
        </div>
    </div>
    
    <div class="diff-container">
        <div class="diff-panel">
            <div class="panel-header baseline-header">
                📷 Baseline (${comparisonResult.baselineName})
            </div>
            <div class="code-viewer" id="baseline-viewer">
                ${highlightedHtml.baseline}
            </div>
        </div>
        
        <div class="diff-panel">
            <div class="panel-header current-header">
                🔄 Current HTML
            </div>
            <div class="code-viewer" id="current-viewer">
                ${highlightedHtml.current}
            </div>
        </div>
    </div>
    
    <div class="controls">
        <button class="control-btn" onclick="toggleSynchronizedScroll()">
            <span id="sync-text">🔗 Sync Scroll</span>
        </button>
        <button class="control-btn" onclick="exportDiff()">📄 Export</button>
        <button class="control-btn" onclick="generateLocators()">⚙️ Generate Locators</button>
    </div>
    
    <div class="element-info" id="element-info">
        <h4>Element Details</h4>
        <div id="element-details"></div>
        <div class="locator-list" id="locator-list"></div>
    </div>

    <script>
        let synchronizedScroll = true;
        const baselineViewer = document.getElementById('baseline-viewer');
        const currentViewer = document.getElementById('current-viewer');
        
        function toggleSynchronizedScroll() {
            synchronizedScroll = !synchronizedScroll;
            document.getElementById('sync-text').textContent = synchronizedScroll ? '🔗 Sync Scroll' : '🔓 Free Scroll';
        }
        
        function syncScroll(source, target) {
            if (!synchronizedScroll) return;
            target.scrollTop = source.scrollTop;
            target.scrollLeft = source.scrollLeft;
        }
        
        baselineViewer.addEventListener('scroll', () => syncScroll(baselineViewer, currentViewer));
        currentViewer.addEventListener('scroll', () => syncScroll(currentViewer, baselineViewer));
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                vscode.postMessage({
                    command: 'copyLocator',
                    locator: text
                });
            });
        }
        
        function exportDiff() {
            // Implementation for exporting diff
            alert('Export functionality would be implemented here');
        }
        
        function generateLocators() {
            // Implementation for generating locators
            alert('Generate locators functionality would be implemented here');
        }
        
        // Handle element clicks to show details
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('locator')) {
                copyToClipboard(e.target.textContent);
            }
        });
        
        // Send message to VS Code
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    private generateHighlightedDiff(baselineHtml: string, currentHtml: string, differences: any[]): { baseline: string; current: string } {
        const baselineLines = baselineHtml.split('\n');
        const currentLines = currentHtml.split('\n');
        
        // Create a simple line-by-line diff with highlighting
        const maxLines = Math.max(baselineLines.length, currentLines.length);
        
        let baselineHighlighted = '';
        let currentHighlighted = '';
        
        for (let i = 0; i < maxLines; i++) {
            const baselineLine = baselineLines[i] || '';
            const currentLine = currentLines[i] || '';
            
            const lineNumber = i + 1;
            
            if (baselineLine === currentLine) {
                // Lines are identical - no highlighting
                baselineHighlighted += `<div class="line unchanged-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content">${this.escapeHtml(baselineLine)}</span>
                </div>`;
                currentHighlighted += `<div class="line unchanged-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content">${this.escapeHtml(currentLine)}</span>
                </div>`;
            } else if (!baselineLine) {
                // Line added in current
                currentHighlighted += `<div class="line added-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content"><span class="diff-highlight diff-added">${this.escapeHtml(currentLine)}</span></span>
                </div>`;
                baselineHighlighted += `<div class="line">
                    <span class="line-number"></span>
                    <span class="line-content"></span>
                </div>`;
            } else if (!currentLine) {
                // Line removed from baseline
                baselineHighlighted += `<div class="line removed-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content"><span class="diff-highlight diff-removed">${this.escapeHtml(baselineLine)}</span></span>
                </div>`;
                currentHighlighted += `<div class="line">
                    <span class="line-number"></span>
                    <span class="line-content"></span>
                </div>`;
            } else {
                // Lines are different - highlight the differences
                const highlightedBaseline = this.highlightLineDifferences(baselineLine, currentLine, 'removed');
                const highlightedCurrent = this.highlightLineDifferences(currentLine, baselineLine, 'added');
                
                baselineHighlighted += `<div class="line modified-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content">${highlightedBaseline}</span>
                </div>`;
                currentHighlighted += `<div class="line modified-line">
                    <span class="line-number">${lineNumber}</span>
                    <span class="line-content">${highlightedCurrent}</span>
                </div>`;
            }
        }
        
        return {
            baseline: baselineHighlighted,
            current: currentHighlighted
        };
    }

    private highlightLineDifferences(line1: string, line2: string, type: 'added' | 'removed'): string {
        // Enhanced comparison for HTML attributes
        return this.highlightHTMLDifferences(line1, line2, type);
    }

    private highlightHTMLDifferences(line1: string, line2: string, type: 'added' | 'removed'): string {
        // Split by HTML tokens (tags, attributes, text)
        const tokens1 = this.tokenizeHTML(line1);
        const tokens2 = this.tokenizeHTML(line2);
        
        let result = '';
        let i = 0, j = 0;
        
        while (i < tokens1.length && j < tokens2.length) {
            if (tokens1[i] === tokens2[j]) {
                result += this.escapeHtml(tokens1[i]);
                i++;
                j++;
            } else {
                // Check if it's an attribute change
                if (this.isAttributeChange(tokens1, tokens2, i, j)) {
                    const attrChange = this.handleAttributeChange(tokens1, tokens2, i, j, type);
                    result += attrChange.result;
                    i = attrChange.i;
                    j = attrChange.j;
                } else {
                    // Regular word difference
                    result += `<span class="diff-highlight diff-${type}">${this.escapeHtml(tokens1[i])}</span>`;
                    i++;
                }
            }
        }
        
        // Add remaining tokens
        while (i < tokens1.length) {
            result += `<span class="diff-highlight diff-${type}">${this.escapeHtml(tokens1[i])}</span>`;
            i++;
        }
        
        return result;
    }

    private tokenizeHTML(html: string): string[] {
        // Tokenize HTML into meaningful parts
        const tokens: string[] = [];
        let current = '';
        let inTag = false;
        let inAttribute = false;
        let quote = '';
        
        for (let i = 0; i < html.length; i++) {
            const char = html[i];
            
            if (char === '<') {
                if (current.trim()) tokens.push(current);
                tokens.push('<');
                current = '';
                inTag = true;
            } else if (char === '>') {
                if (current.trim()) tokens.push(current);
                tokens.push('>');
                current = '';
                inTag = false;
                inAttribute = false;
                quote = '';
            } else if (inTag && char === '=' && !inAttribute) {
                if (current.trim()) tokens.push(current);
                tokens.push('=');
                current = '';
                inAttribute = true;
            } else if (inTag && (char === '"' || char === "'") && inAttribute) {
                if (quote === '') {
                    quote = char;
                    tokens.push(char);
                } else if (quote === char) {
                    if (current.trim()) tokens.push(current);
                    tokens.push(char);
                    current = '';
                    quote = '';
                    inAttribute = false;
                } else {
                    current += char;
                }
            } else if (inTag && char === ' ' && !inAttribute) {
                if (current.trim()) tokens.push(current);
                tokens.push(' ');
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) tokens.push(current);
        return tokens.filter(token => token.length > 0);
    }

    private isAttributeChange(tokens1: string[], tokens2: string[], i: number, j: number): boolean {
        // Check if we're dealing with an attribute change
        if (i < tokens1.length - 2 && j < tokens2.length - 2) {
            const next1 = tokens1[i + 1];
            const next2 = tokens2[j + 1];
            const nextNext1 = tokens1[i + 2];
            const nextNext2 = tokens2[j + 2];
            
            // Look for pattern: attributeName="value"
            return (next1 === '=' && nextNext1.startsWith('"') && nextNext1.endsWith('"')) ||
                   (next2 === '=' && nextNext2.startsWith('"') && nextNext2.endsWith('"'));
        }
        return false;
    }

    private handleAttributeChange(tokens1: string[], tokens2: string[], i: number, j: number, type: 'added' | 'removed'): { result: string; i: number; j: number } {
        let result = '';
        
        // Check if it's the same attribute name but different value
        if (i < tokens1.length - 2 && j < tokens2.length - 2) {
            const attrName1 = tokens1[i];
            const attrName2 = tokens2[j];
            const equals1 = tokens1[i + 1];
            const equals2 = tokens2[j + 1];
            const value1 = tokens1[i + 2];
            const value2 = tokens2[j + 2];
            
            if (attrName1 === attrName2 && equals1 === '=' && equals2 === '=') {
                // Same attribute, different value - show as modified
                if (type === 'removed') {
                    result += `${this.escapeHtml(attrName1)}${this.escapeHtml(equals1)}<span class="diff-highlight diff-modified">${this.escapeHtml(value1)}</span>`;
                } else {
                    result += `${this.escapeHtml(attrName2)}${this.escapeHtml(equals2)}<span class="diff-highlight diff-added">${this.escapeHtml(value2)}</span>`;
                }
                return { result, i: i + 3, j: j + 3 };
            }
        }
        
        // Fallback to regular highlighting
        result += `<span class="diff-highlight diff-${type}">${this.escapeHtml(tokens1[i])}</span>`;
        return { result, i: i + 1, j: j + 1 };
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private async createDiffDocument(comparisonResult: ComparisonResult): Promise<void> {
        const diffContent = this.generateDiffContent(comparisonResult);
        
        const doc = await vscode.workspace.openTextDocument({
            content: diffContent,
            language: 'html'
        });

        await vscode.window.showTextDocument(doc);
    }

    private generateDiffContent(comparisonResult: ComparisonResult): string {
        const { summary, differences } = comparisonResult;
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Structure Diff - ${comparisonResult.baselineName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .summary {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary h2 {
            margin-top: 0;
            color: #1976d2;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .summary-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            border-left: 4px solid #1976d2;
        }
        .summary-item h3 {
            margin: 0 0 5px 0;
            font-size: 24px;
            color: #1976d2;
        }
        .summary-item p {
            margin: 0;
            color: #666;
            font-size: 14px;
        }
        .diff-section {
            margin-bottom: 30px;
        }
        .diff-section h3 {
            color: #333;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }
        .diff-item {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin: 10px 0;
            padding: 15px;
            position: relative;
        }
        .diff-item.added {
            border-left: 4px solid #4caf50;
            background: #f1f8e9;
        }
        .diff-item.removed {
            border-left: 4px solid #f44336;
            background: #ffebee;
        }
        .diff-item.modified {
            border-left: 4px solid #ff9800;
            background: #fff3e0;
        }
        .diff-item.moved {
            border-left: 4px solid #9c27b0;
            background: #f3e5f5;
        }
        .diff-type {
            position: absolute;
            top: 10px;
            right: 15px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .diff-type.added { background: #4caf50; color: white; }
        .diff-type.removed { background: #f44336; color: white; }
        .diff-type.modified { background: #ff9800; color: white; }
        .diff-type.moved { background: #9c27b0; color: white; }
        .element-id {
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 8px;
        }
        .description {
            margin-bottom: 10px;
            color: #333;
        }
        .locators {
            margin-top: 10px;
        }
        .locators h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #666;
        }
        .locator-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .locator {
            background: #e8f5e8;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            border: 1px solid #c8e6c9;
        }
        .locator.old {
            background: #ffebee;
            border-color: #ffcdd2;
            text-decoration: line-through;
        }
        .locator.new {
            background: #e8f5e8;
            border-color: #c8e6c9;
        }
        .copy-btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            margin-left: 8px;
        }
        .copy-btn:hover {
            background: #1565c0;
        }
        .recommendations {
            background: #fff9c4;
            border: 1px solid #fff176;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
        }
        .recommendations h4 {
            margin-top: 0;
            color: #f57f17;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>HTML Structure Comparison Report</h1>
        
        <div class="summary">
            <h2>Comparison Summary</h2>
            <p><strong>Baseline:</strong> ${comparisonResult.baselineName}</p>
            <p><strong>Date:</strong> ${comparisonResult.timestamp.toLocaleString()}</p>
            
            <div class="summary-grid">
                <div class="summary-item">
                    <h3>${summary.totalElements}</h3>
                    <p>Total Elements</p>
                </div>
                <div class="summary-item">
                    <h3>${summary.addedElements}</h3>
                    <p>Added</p>
                </div>
                <div class="summary-item">
                    <h3>${summary.removedElements}</h3>
                    <p>Removed</p>
                </div>
                <div class="summary-item">
                    <h3>${summary.modifiedElements}</h3>
                    <p>Modified</p>
                </div>
                <div class="summary-item">
                    <h3>${summary.movedElements}</h3>
                    <p>Moved</p>
                </div>
                <div class="summary-item">
                    <h3>${summary.locatorChanges}</h3>
                    <p>Locator Changes</p>
                </div>
            </div>
        </div>`;

        if (differences.length > 0) {
            // Group differences by type
            const byType = differences.reduce((acc, diff) => {
                if (!acc[diff.type]) acc[diff.type] = [];
                acc[diff.type].push(diff);
                return acc;
            }, {} as Record<string, typeof differences>);

            Object.entries(byType).forEach(([type, diffs]) => {
                html += `
                <div class="diff-section">
                    <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Elements (${diffs.length})</h3>`;

                diffs.forEach(diff => {
                    html += `
                    <div class="diff-item ${diff.type}">
                        <span class="diff-type ${diff.type}">${diff.type}</span>
                        <div class="element-id">${diff.elementId}</div>
                        <div class="description">${diff.description}</div>`;

                    if (diff.oldLocators && diff.newLocators) {
                        html += `
                        <div class="locators">
                            <h4>Locator Changes:</h4>
                            <div class="locator-list">`;
                        
                        diff.oldLocators.forEach(locator => {
                            html += `<span class="locator old">${locator}</span>`;
                        });
                        
                        diff.newLocators.forEach(locator => {
                            html += `<span class="locator new">${locator} <button class="copy-btn" onclick="copyToClipboard('${locator}')">Copy</button></span>`;
                        });
                        
                        html += `
                            </div>
                        </div>`;
                    }

                    html += `
                    </div>`;
                });

                html += `
                </div>`;
            });

            // Add recommendations section
            html += `
            <div class="recommendations">
                <h4>QA Recommendations</h4>
                <ul>
                    <li>Review all modified elements to ensure functionality remains intact</li>
                    <li>Update test scripts with new locators for changed elements</li>
                    <li>Consider adding stable attributes (ID, data-*) to frequently changing elements</li>
                    <li>Test the application thoroughly after implementing locator updates</li>
                    <li>Document any new elements that require test coverage</li>
                </ul>
            </div>`;
        } else {
            html += `
            <div class="diff-section">
                <h3>No Changes Detected</h3>
                <p>The HTML structure is identical to the baseline. No locator updates are needed.</p>
            </div>`;
        }

        html += `
    </div>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Locator copied to clipboard!');
            });
        }
    </script>
</body>
</html>`;

        return html;
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA HTML Capture - Diff View</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .welcome {
            text-align: center;
            padding: 40px 20px;
        }
        .welcome h2 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 16px;
        }
        .welcome p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .actions {
            margin-top: 30px;
        }
        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .instructions {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 16px;
            margin: 20px 0;
        }
        .instructions h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="welcome">
        <h2>QA HTML Structure Capture</h2>
        <p>Welcome to the HTML structure comparison tool!</p>
        
        <div class="instructions">
            <h3>How to use:</h3>
            <ol>
                <li>Open an HTML file in the editor</li>
                <li>Use "Capture HTML Baseline" to save the current structure</li>
                <li>Make changes to your HTML</li>
                <li>Use "Compare HTML Structure" to detect changes</li>
                <li>View detailed diff reports and updated locators</li>
            </ol>
        </div>

        <div class="actions">
            <button class="action-btn" onclick="vscode.postMessage({type: 'capture'})">
                Capture Baseline
            </button>
            <button class="action-btn" onclick="vscode.postMessage({type: 'compare'})">
                Compare Structure
            </button>
            <button class="action-btn" onclick="vscode.postMessage({type: 'generate'})">
                Generate Locators
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    private async highlightElementInEditor(xpath: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // This is a simplified implementation
        // In a real scenario, you'd need to parse the XPath and find the corresponding line
        vscode.window.showInformationMessage(`Highlighting element: ${xpath}`);
    }
}

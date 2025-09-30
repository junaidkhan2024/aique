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
exports.DiffViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class DiffViewProvider {
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'copyLocator':
                    vscode.env.clipboard.writeText(data.locator);
                    vscode.window.showInformationMessage('Locator copied to clipboard!');
                    break;
                case 'viewElement':
                    this.highlightElementInEditor(data.xpath);
                    break;
            }
        }, undefined, this.context.subscriptions);
    }
    showDiff(comparisonResult) {
        // Create a side-by-side diff view
        this.createSideBySideDiff(comparisonResult);
    }
    async createSideBySideDiff(comparisonResult) {
        // Get baseline HTML from comparison result
        const baselineHtml = comparisonResult.baselineHtml;
        const currentHtml = comparisonResult.currentHtml;
        // Create webview panel for side-by-side diff
        const panel = vscode.window.createWebviewPanel('qaHtmlDiff', `HTML Diff: ${comparisonResult.baselineName}`, vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = this.generateSideBySideDiffHTML(baselineHtml, currentHtml, comparisonResult);
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'copyLocator':
                    vscode.env.clipboard.writeText(message.locator);
                    vscode.window.showInformationMessage('Locator copied to clipboard!');
                    break;
                case 'highlightElement':
                    this.highlightElementInEditor(message.xpath);
                    break;
                case 'exportDiff':
                    this.exportDiffReport(comparisonResult, message.data);
                    break;
                case 'generateLocators':
                    this.generateLocatorsFromDiff(comparisonResult);
                    break;
            }
        }, undefined, this.context.subscriptions);
    }
    async getBaselineHtml(baselineId) {
        try {
            // Try to get baseline from the HTMLCaptureProvider
            const { HTMLCaptureProvider } = await Promise.resolve().then(() => __importStar(require('./htmlCaptureProvider')));
            const provider = new HTMLCaptureProvider(this.context);
            const baseline = provider.getBaseline(baselineId);
            return baseline ? baseline.html : '';
        }
        catch (error) {
            console.error('Error retrieving baseline HTML:', error);
            return '';
        }
    }
    generateSideBySideDiffHTML(baselineHtml, currentHtml, comparisonResult) {
        const { summary, differences } = comparisonResult;
        // Generate highlighted HTML with inline differences
        const highlightedHtml = this.generateHighlightedDiff(baselineHtml, currentHtml, comparisonResult);
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
        
        .added { 
            background: #28a745; 
            color: white; 
        }
        .removed { 
            background: #dc3545; 
            color: white; 
        }
        .modified { 
            background: #17a2b8; 
            color: white; 
        }
        .moved { 
            background: #6c757d; 
            color: white; 
        }
        
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
            margin: 1px 0;
            padding: 4px 8px;
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
            background: #d4edda !important;
            border-left: 4px solid #28a745 !important;
            color: #155724 !important;
            font-weight: bold !important;
        }
        
        .removed-line {
            background: #f8d7da !important;
            border-left: 4px solid #dc3545 !important;
            color: #721c24 !important;
            text-decoration: line-through !important;
            font-weight: bold !important;
        }
        
        .modified-line {
            background: #d1ecf1 !important;
            border-left: 4px solid #17a2b8 !important;
            color: #0c5460 !important;
            font-weight: bold !important;
        }
        
        .moved-line {
            background: #e2e3e5 !important;
            border-left: 4px solid #6c757d !important;
            color: #383d41 !important;
            font-weight: bold !important;
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
            background: #d4edda !important;
            color: #155724 !important;
            border: 1px solid #28a745 !important;
            border-radius: 2px;
            font-weight: bold !important;
            padding: 1px 3px;
            text-decoration: underline !important;
        }
        
        .diff-removed {
            background: #f8d7da !important;
            color: #721c24 !important;
            border: 1px solid #dc3545 !important;
            border-radius: 2px;
            text-decoration: line-through !important;
            font-weight: bold !important;
            padding: 1px 3px;
        }
        
        .diff-modified {
            background: #d1ecf1 !important;
            color: #0c5460 !important;
            border: 1px solid #17a2b8 !important;
            border-radius: 2px;
            font-weight: bold !important;
            padding: 1px 3px;
        }
        
        .diff-moved {
            background: #e2e3e5 !important;
            color: #383d41 !important;
            border: 1px solid #6c757d !important;
            border-radius: 2px;
            font-weight: bold !important;
            padding: 1px 3px;
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
                Baseline (${comparisonResult.baselineName})
            </div>
            <div class="code-viewer" id="baseline-viewer">
                ${highlightedHtml.baseline}
            </div>
        </div>
        
        <div class="diff-panel">
            <div class="panel-header current-header">
                Current HTML
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
        <button class="control-btn" onclick="generateLocators()">Generate Locators</button>
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
            // Send message to VS Code to export the diff
            vscode.postMessage({
                command: 'exportDiff',
                data: {
                    baselineName: '${comparisonResult.baselineName}',
                    summary: {
                        added: ${summary.addedElements},
                        removed: ${summary.removedElements},
                        modified: ${summary.modifiedElements},
                        moved: ${summary.movedElements}
                    }
                }
            });
        }
        
        function generateLocators() {
            // Send message to VS Code to generate locators
            vscode.postMessage({
                command: 'generateLocators',
                data: {
                    baselineName: '${comparisonResult.baselineName}'
                }
            });
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
    generateHighlightedDiff(baselineHtml, currentHtml, comparisonResult) {
        const baselineLines = baselineHtml.split('\n');
        const currentLines = currentHtml.split('\n');
        // Use a more sophisticated diff algorithm
        const diff = this.computeLineDiff(baselineLines, currentLines);
        let baselineHighlighted = '';
        let currentHighlighted = '';
        let baselineLineNumber = 1;
        let currentLineNumber = 1;
        for (const change of diff) {
            switch (change.type) {
                case 'equal':
                    // Lines are identical - no highlighting
                    if (change.lines) {
                        for (let i = 0; i < change.count; i++) {
                            const line = change.lines[i];
                            baselineHighlighted += `<div class="line unchanged-line">
                                <span class="line-number">${baselineLineNumber}</span>
                                <span class="line-content">${this.escapeHtml(line)}</span>
                            </div>`;
                            currentHighlighted += `<div class="line unchanged-line">
                                <span class="line-number">${currentLineNumber}</span>
                                <span class="line-content">${this.escapeHtml(line)}</span>
                            </div>`;
                            baselineLineNumber++;
                            currentLineNumber++;
                        }
                    }
                    break;
                case 'delete':
                    // Lines removed from baseline
                    if (change.lines) {
                        for (let i = 0; i < change.count; i++) {
                            const line = change.lines[i];
                            baselineHighlighted += `<div class="line removed-line">
                                <span class="line-number">${baselineLineNumber}</span>
                                <span class="line-content"><span class="diff-highlight diff-removed">${this.escapeHtml(line)}</span></span>
                            </div>`;
                            currentHighlighted += `<div class="line">
                                <span class="line-number"></span>
                                <span class="line-content"></span>
                            </div>`;
                            baselineLineNumber++;
                        }
                    }
                    break;
                case 'insert':
                    // Lines added to current
                    if (change.lines) {
                        for (let i = 0; i < change.count; i++) {
                            const line = change.lines[i];
                            baselineHighlighted += `<div class="line">
                                <span class="line-number"></span>
                                <span class="line-content"></span>
                            </div>`;
                            currentHighlighted += `<div class="line added-line">
                                <span class="line-number">${currentLineNumber}</span>
                                <span class="line-content"><span class="diff-highlight diff-added">${this.escapeHtml(line)}</span></span>
                            </div>`;
                            currentLineNumber++;
                        }
                    }
                    break;
                case 'replace':
                    // Lines replaced - highlight as modified
                    if (change.baselineLines && change.currentLines) {
                        for (let i = 0; i < change.count; i++) {
                            const baselineLine = change.baselineLines[i];
                            const currentLine = change.currentLines[i];
                            const baselineHighlightedContent = this.highlightInlineChanges(baselineLine, currentLine, 'removed');
                            const currentHighlightedContent = this.highlightInlineChanges(baselineLine, currentLine, 'added');
                            baselineHighlighted += `<div class="line modified-line">
                                <span class="line-number">${baselineLineNumber}</span>
                                <span class="line-content">${baselineHighlightedContent}</span>
                            </div>`;
                            currentHighlighted += `<div class="line modified-line">
                                <span class="line-number">${currentLineNumber}</span>
                                <span class="line-content">${currentHighlightedContent}</span>
                            </div>`;
                            baselineLineNumber++;
                            currentLineNumber++;
                        }
                    }
                    break;
            }
        }
        return {
            baseline: baselineHighlighted,
            current: currentHighlighted
        };
    }
    computeLineDiff(baselineLines, currentLines) {
        const changes = [];
        let baselineIndex = 0;
        let currentIndex = 0;
        while (baselineIndex < baselineLines.length || currentIndex < currentLines.length) {
            // Find the next common line
            let commonLength = 0;
            while (baselineIndex + commonLength < baselineLines.length &&
                currentIndex + commonLength < currentLines.length &&
                baselineLines[baselineIndex + commonLength] === currentLines[currentIndex + commonLength]) {
                commonLength++;
            }
            if (commonLength > 0) {
                // Add common lines
                changes.push({
                    type: 'equal',
                    count: commonLength,
                    lines: baselineLines.slice(baselineIndex, baselineIndex + commonLength)
                });
                baselineIndex += commonLength;
                currentIndex += commonLength;
            }
            else {
                // Find deletions and insertions
                let deleteCount = 0;
                let insertCount = 0;
                // Count consecutive deletions
                while (baselineIndex + deleteCount < baselineLines.length) {
                    const baselineLine = baselineLines[baselineIndex + deleteCount];
                    let found = false;
                    for (let i = currentIndex; i < currentLines.length; i++) {
                        if (baselineLine === currentLines[i]) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        deleteCount++;
                    }
                    else {
                        break;
                    }
                }
                // Count consecutive insertions
                while (currentIndex + insertCount < currentLines.length) {
                    const currentLine = currentLines[currentIndex + insertCount];
                    let found = false;
                    for (let i = baselineIndex; i < baselineLines.length; i++) {
                        if (currentLine === baselineLines[i]) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        insertCount++;
                    }
                    else {
                        break;
                    }
                }
                if (deleteCount > 0 && insertCount > 0) {
                    // Replace operation
                    changes.push({
                        type: 'replace',
                        count: Math.min(deleteCount, insertCount),
                        baselineLines: baselineLines.slice(baselineIndex, baselineIndex + Math.min(deleteCount, insertCount)),
                        currentLines: currentLines.slice(currentIndex, currentIndex + Math.min(deleteCount, insertCount))
                    });
                    baselineIndex += Math.min(deleteCount, insertCount);
                    currentIndex += Math.min(deleteCount, insertCount);
                }
                else if (deleteCount > 0) {
                    // Delete operation
                    changes.push({
                        type: 'delete',
                        count: deleteCount,
                        lines: baselineLines.slice(baselineIndex, baselineIndex + deleteCount)
                    });
                    baselineIndex += deleteCount;
                }
                else if (insertCount > 0) {
                    // Insert operation
                    changes.push({
                        type: 'insert',
                        count: insertCount,
                        lines: currentLines.slice(currentIndex, currentIndex + insertCount)
                    });
                    currentIndex += insertCount;
                }
                else {
                    // No more changes
                    break;
                }
            }
        }
        return changes;
    }
    highlightInlineChanges(baselineLine, currentLine, type) {
        // Simple word-by-word comparison for inline highlighting
        const baselineWords = baselineLine.split(/(\s+)/);
        const currentWords = currentLine.split(/(\s+)/);
        let result = '';
        const maxLength = Math.max(baselineWords.length, currentWords.length);
        for (let i = 0; i < maxLength; i++) {
            const baselineWord = baselineWords[i] || '';
            const currentWord = currentWords[i] || '';
            if (baselineWord === currentWord) {
                result += this.escapeHtml(baselineWord);
            }
            else {
                if (type === 'removed') {
                    result += `<span class="diff-highlight diff-removed">${this.escapeHtml(baselineWord)}</span>`;
                }
                else {
                    result += `<span class="diff-highlight diff-added">${this.escapeHtml(currentWord)}</span>`;
                }
            }
        }
        return result;
    }
    highlightLineDifferences(line1, line2, type) {
        // Enhanced comparison for HTML attributes
        return this.highlightHTMLDifferences(line1, line2, type);
    }
    highlightHTMLDifferences(line1, line2, type) {
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
            }
            else {
                // Check if it's an attribute change
                if (this.isAttributeChange(tokens1, tokens2, i, j)) {
                    const attrChange = this.handleAttributeChange(tokens1, tokens2, i, j, type);
                    result += attrChange.result;
                    i = attrChange.i;
                    j = attrChange.j;
                }
                else {
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
    tokenizeHTML(html) {
        // Tokenize HTML into meaningful parts
        const tokens = [];
        let current = '';
        let inTag = false;
        let inAttribute = false;
        let quote = '';
        for (let i = 0; i < html.length; i++) {
            const char = html[i];
            if (char === '<') {
                if (current.trim())
                    tokens.push(current);
                tokens.push('<');
                current = '';
                inTag = true;
            }
            else if (char === '>') {
                if (current.trim())
                    tokens.push(current);
                tokens.push('>');
                current = '';
                inTag = false;
                inAttribute = false;
                quote = '';
            }
            else if (inTag && char === '=' && !inAttribute) {
                if (current.trim())
                    tokens.push(current);
                tokens.push('=');
                current = '';
                inAttribute = true;
            }
            else if (inTag && (char === '"' || char === "'") && inAttribute) {
                if (quote === '') {
                    quote = char;
                    tokens.push(char);
                }
                else if (quote === char) {
                    if (current.trim())
                        tokens.push(current);
                    tokens.push(char);
                    current = '';
                    quote = '';
                    inAttribute = false;
                }
                else {
                    current += char;
                }
            }
            else if (inTag && char === ' ' && !inAttribute) {
                if (current.trim())
                    tokens.push(current);
                tokens.push(' ');
                current = '';
            }
            else {
                current += char;
            }
        }
        if (current.trim())
            tokens.push(current);
        return tokens.filter(token => token.length > 0);
    }
    isAttributeChange(tokens1, tokens2, i, j) {
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
    handleAttributeChange(tokens1, tokens2, i, j, type) {
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
                }
                else {
                    result += `${this.escapeHtml(attrName2)}${this.escapeHtml(equals2)}<span class="diff-highlight diff-added">${this.escapeHtml(value2)}</span>`;
                }
                return { result, i: i + 3, j: j + 3 };
            }
        }
        // Fallback to regular highlighting
        result += `<span class="diff-highlight diff-${type}">${this.escapeHtml(tokens1[i])}</span>`;
        return { result, i: i + 1, j: j + 1 };
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    async createDiffDocument(comparisonResult) {
        const diffContent = this.generateDiffContent(comparisonResult);
        const doc = await vscode.workspace.openTextDocument({
            content: diffContent,
            language: 'html'
        });
        await vscode.window.showTextDocument(doc);
    }
    generateDiffContent(comparisonResult) {
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
                if (!acc[diff.type])
                    acc[diff.type] = [];
                acc[diff.type].push(diff);
                return acc;
            }, {});
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
        }
        else {
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
    getHtmlForWebview(webview) {
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
    async highlightElementInEditor(xpath) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        // This is a simplified implementation
        // In a real scenario, you'd need to parse the XPath and find the corresponding line
        vscode.window.showInformationMessage(`Highlighting element: ${xpath}`);
    }
    async exportDiffReport(comparisonResult, data) {
        try {
            const fs = require('fs');
            const path = require('path');
            // Create reports directory if it doesn't exist
            const reportsDir = path.join(this.context.extensionPath, 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            // Generate report content
            const reportContent = this.generateDiffReportContent(comparisonResult, data);
            // Save report file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `diff-report-${comparisonResult.baselineName}-${timestamp}.html`;
            const filePath = path.join(reportsDir, fileName);
            fs.writeFileSync(filePath, reportContent);
            // Show success message and offer to open file
            const action = await vscode.window.showInformationMessage(`Diff report exported successfully to: ${fileName}`, 'Open Report', 'Open Folder', 'Close');
            if (action === 'Open Report') {
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            }
            else if (action === 'Open Folder') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export diff report: ${error}`);
        }
    }
    generateDiffReportContent(comparisonResult, data) {
        const summary = comparisonResult.summary;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Structure Diff Report - ${comparisonResult.baselineName}</title>
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
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .summary-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #007bff;
        }
        .summary-item.added { border-left-color: #28a745; }
        .summary-item.removed { border-left-color: #dc3545; }
        .summary-item.modified { border-left-color: #ffc107; }
        .summary-item.moved { border-left-color: #6f42c1; }
        .summary-item h3 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .summary-item p {
            margin: 0;
            color: #666;
        }
        .details {
            margin-top: 30px;
        }
        .details h3 {
            color: #333;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }
        .element-list {
            margin: 15px 0;
        }
        .element-item {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin: 10px 0;
            padding: 15px;
        }
        .element-item.added {
            border-left: 4px solid #28a745;
            background: #f1f8e9;
        }
        .element-item.removed {
            border-left: 4px solid #dc3545;
            background: #ffebee;
        }
        .element-item.modified {
            border-left: 4px solid #ffc107;
            background: #fff3e0;
        }
        .element-item.moved {
            border-left: 4px solid #6f42c1;
            background: #f3e5f5;
        }
        .element-id {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 8px;
        }
        .locator {
            background: #e8f5e8;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 2px 4px 2px 0;
            display: inline-block;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>HTML Structure Diff Report</h1>
            <p>Baseline: ${comparisonResult.baselineName}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-item added">
                <h3>${summary.addedElements}</h3>
                <p>Added Elements</p>
            </div>
            <div class="summary-item removed">
                <h3>${summary.removedElements}</h3>
                <p>Removed Elements</p>
            </div>
            <div class="summary-item modified">
                <h3>${summary.modifiedElements}</h3>
                <p>Modified Elements</p>
            </div>
            <div class="summary-item moved">
                <h3>${summary.movedElements}</h3>
                <p>Moved Elements</p>
            </div>
        </div>
        
        <div class="details">
            <h3>Element Changes</h3>
            ${this.generateElementChangesHTML(comparisonResult)}
        </div>
        
        <div class="footer">
            <p>Report generated by QA HTML Structure Capture Extension</p>
        </div>
    </div>
</body>
</html>`;
    }
    generateElementChangesHTML(comparisonResult) {
        let html = '';
        // Group differences by type
        const addedElements = comparisonResult.differences.filter(diff => diff.type === 'added');
        const removedElements = comparisonResult.differences.filter(diff => diff.type === 'removed');
        const modifiedElements = comparisonResult.differences.filter(diff => diff.type === 'modified');
        const movedElements = comparisonResult.differences.filter(diff => diff.type === 'moved');
        // Add elements
        if (addedElements.length > 0) {
            html += '<h4>Added Elements</h4><div class="element-list">';
            addedElements.forEach(diff => {
                const element = diff.newElement;
                if (element) {
                    html += `
                        <div class="element-item added">
                            <div class="element-id">${element.tagName}${element.attributes.id ? `#${element.attributes.id}` : ''}${element.attributes.class ? `.${element.attributes.class}` : ''}</div>
                            <div>${element.text || 'No text content'}</div>
                            <div>Locators: ${element.locators.map((loc) => `<span class="locator">${loc}</span>`).join('')}</div>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }
        // Removed elements
        if (removedElements.length > 0) {
            html += '<h4>Removed Elements</h4><div class="element-list">';
            removedElements.forEach(diff => {
                const element = diff.oldElement;
                if (element) {
                    html += `
                        <div class="element-item removed">
                            <div class="element-id">${element.tagName}${element.attributes.id ? `#${element.attributes.id}` : ''}${element.attributes.class ? `.${element.attributes.class}` : ''}</div>
                            <div>${element.text || 'No text content'}</div>
                            <div>Locators: ${element.locators.map((loc) => `<span class="locator">${loc}</span>`).join('')}</div>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }
        // Modified elements
        if (modifiedElements.length > 0) {
            html += '<h4>Modified Elements</h4><div class="element-list">';
            modifiedElements.forEach(diff => {
                const oldElement = diff.oldElement;
                const newElement = diff.newElement;
                if (oldElement && newElement) {
                    html += `
                        <div class="element-item modified">
                            <div class="element-id">${newElement.tagName}${newElement.attributes.id ? `#${newElement.attributes.id}` : ''}${newElement.attributes.class ? `.${newElement.attributes.class}` : ''}</div>
                            <div>${newElement.text || 'No text content'}</div>
                            <div>Old Locators: ${oldElement.locators.map((loc) => `<span class="locator">${loc}</span>`).join('')}</div>
                            <div>New Locators: ${newElement.locators.map((loc) => `<span class="locator">${loc}</span>`).join('')}</div>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }
        // Moved elements
        if (movedElements.length > 0) {
            html += '<h4>Moved Elements</h4><div class="element-list">';
            movedElements.forEach(diff => {
                const element = diff.newElement;
                if (element) {
                    html += `
                        <div class="element-item moved">
                            <div class="element-id">${element.tagName}${element.attributes.id ? `#${element.attributes.id}` : ''}${element.attributes.class ? `.${element.attributes.class}` : ''}</div>
                            <div>${element.text || 'No text content'}</div>
                            <div>Locators: ${element.locators.map((loc) => `<span class="locator">${loc}</span>`).join('')}</div>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }
        return html;
    }
    async generateLocatorsFromDiff(comparisonResult) {
        try {
            const { LocatorGenerator } = await Promise.resolve().then(() => __importStar(require('./locatorGenerator')));
            const locatorGenerator = new LocatorGenerator();
            // Generate locators for the current HTML
            await locatorGenerator.generateUpdatedLocatorsFromComparison(comparisonResult);
            vscode.window.showInformationMessage('Updated locators generated successfully!');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to generate locators: ${error}`);
        }
    }
}
exports.DiffViewProvider = DiffViewProvider;
DiffViewProvider.viewType = 'qa-html-capture.diffView';
//# sourceMappingURL=diffViewProvider.js.map
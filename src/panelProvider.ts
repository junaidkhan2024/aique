import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HTMLCaptureProvider } from './htmlCaptureProvider';
import { HTMLComparator } from './htmlComparator';

export interface PanelItem {
    label: string;
    iconPath?: vscode.ThemeIcon;
    command?: vscode.Command;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    children?: PanelItem[];
    contextValue?: string;
    baselineId?: string;
}

export class PanelProvider implements vscode.TreeDataProvider<PanelItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PanelItem | undefined | null | void> = new vscode.EventEmitter<PanelItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PanelItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private htmlCaptureProvider: HTMLCaptureProvider;
    private htmlComparator: HTMLComparator;

    constructor(
        private context: vscode.ExtensionContext,
        htmlCaptureProvider: HTMLCaptureProvider,
        htmlComparator: HTMLComparator
    ) {
        this.htmlCaptureProvider = htmlCaptureProvider;
        this.htmlComparator = htmlComparator;
    }

    getTreeItem(element: PanelItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        
        if (element.iconPath) {
            treeItem.iconPath = element.iconPath;
        }
        
        if (element.command) {
            treeItem.command = element.command;
        }
        
        if (element.contextValue) {
            treeItem.contextValue = element.contextValue;
        }

        return treeItem;
    }

    getChildren(element?: PanelItem): Thenable<PanelItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                {
                    label: 'Actions',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    children: [
                        {
                            label: 'Capture Baseline',
                            iconPath: new vscode.ThemeIcon('camera'),
                            command: {
                                command: 'qa-html-capture.captureBaseline',
                                title: 'Capture HTML Baseline'
                            }
                        },
                        {
                            label: 'Compare with Baseline',
                            iconPath: new vscode.ThemeIcon('diff'),
                            command: {
                                command: 'qa-html-capture.compareWithBaseline',
                                title: 'Compare with Baseline'
                            }
                        },
                        {
                            label: 'Generate Locator Report',
                            iconPath: new vscode.ThemeIcon('graph'),
                            command: {
                                command: 'qa-html-capture.generateLocatorReport',
                                title: 'Generate Locator Report'
                            }
                        },
                        {
                            label: 'Refresh Panel',
                            iconPath: new vscode.ThemeIcon('refresh'),
                            command: {
                                command: 'qa-html-capture.refreshPanel',
                                title: 'Refresh Panel'
                            }
                        }
                    ]
                },
                {
                    label: 'Baselines',
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    children: this.getBaselineItems()
                },
                {
                    label: 'Settings',
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    children: [
                        {
                            label: 'Open Baselines Folder',
                            iconPath: new vscode.ThemeIcon('folder-opened'),
                            command: {
                                command: 'qa-html-capture.openBaselinesFolder',
                                title: 'Open Baselines Folder'
                            }
                        },
                        {
                            label: 'Clear All Baselines',
                            iconPath: new vscode.ThemeIcon('trash'),
                            command: {
                                command: 'qa-html-capture.clearAllBaselines',
                                title: 'Clear All Baselines'
                            }
                        }
                    ]
                }
            ]);
        }

        return Promise.resolve(element.children || []);
    }

    private getBaselineItems(): PanelItem[] {
        const baselines = this.htmlCaptureProvider.getAllBaselines();
        
        if (baselines.length === 0) {
            return [
                {
                    label: 'No baselines found',
                    iconPath: new vscode.ThemeIcon('info'),
                    collapsibleState: vscode.TreeItemCollapsibleState.None
                }
            ];
        }

        return baselines.map(baseline => ({
            label: `${baseline.name} (${new Date(baseline.timestamp).toLocaleDateString()})`,
            iconPath: new vscode.ThemeIcon('file-code'),
            contextValue: 'baseline',
            baselineId: baseline.id,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'qa-html-capture.selectBaseline',
                title: 'Select Baseline',
                arguments: [baseline]
            }
        }));
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async openBaselinesFolder(): Promise<void> {
        const storagePath = path.join(this.context.globalStorageUri.fsPath, 'baselines');
        const uri = vscode.Uri.file(storagePath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    }

    async clearAllBaselines(): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all baselines? This action cannot be undone.',
            'Yes, Clear All',
            'Cancel'
        );

        if (result === 'Yes, Clear All') {
            try {
                const storagePath = path.join(this.context.globalStorageUri.fsPath, 'baselines');
                const files = fs.readdirSync(storagePath);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        fs.unlinkSync(path.join(storagePath, file));
                    }
                }

                this.refresh();
                vscode.window.showInformationMessage('All baselines have been cleared.');
            } catch (error) {
                vscode.window.showErrorMessage(`Error clearing baselines: ${error}`);
            }
        }
    }

    async selectBaseline(baseline: any): Promise<void> {
        const action = await vscode.window.showQuickPick([
            {
                label: 'Compare with Current File',
                description: 'Compare this baseline with the currently open HTML file'
            },
            {
                label: 'View Baseline Details',
                description: 'View detailed information about this baseline'
            },
            {
                label: 'Delete Baseline',
                description: 'Permanently delete this baseline'
            }
        ], {
            placeHolder: `What would you like to do with "${baseline.name}"?`
        });

        if (!action) return;

        switch (action.label) {
            case 'Compare with Current File':
                await vscode.commands.executeCommand('qa-html-capture.compareWithBaseline', baseline.id);
                break;
            case 'View Baseline Details':
                await this.showBaselineDetails(baseline);
                break;
            case 'Delete Baseline':
                await this.deleteBaseline(baseline);
                break;
        }
    }

    private async showBaselineDetails(baseline: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'baselineDetails',
            `Baseline: ${baseline.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateBaselineDetailsHTML(baseline);
    }

    private generateBaselineDetailsHTML(baseline: any): string {
        const timestamp = new Date(baseline.timestamp).toLocaleString();
        const elementCount = Object.keys(baseline.elementMap || {}).length;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baseline Details</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-item {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
        }
        .info-label {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        .info-value {
            color: var(--vscode-foreground);
            word-break: break-all;
        }
        .html-preview {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
        }
        .html-content {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${baseline.name}</h1>
    </div>
    
    <div class="info-grid">
        <div class="info-item">
            <div class="info-label">ID</div>
            <div class="info-value">${baseline.id}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Created</div>
            <div class="info-value">${timestamp}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Source URL</div>
            <div class="info-value">${baseline.url}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Elements</div>
            <div class="info-value">${elementCount} elements</div>
        </div>
    </div>
    
    <div class="info-item">
        <div class="info-label">HTML Content</div>
        <div class="html-preview">
            <div class="html-content">${this.escapeHtml(baseline.html)}</div>
        </div>
    </div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private async deleteBaseline(baseline: any): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete baseline "${baseline.name}"? This action cannot be undone.`,
            'Yes, Delete',
            'Cancel'
        );

        if (result === 'Yes, Delete') {
            try {
                await this.htmlCaptureProvider.deleteBaseline({ 
                    label: baseline.name,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    type: 'baseline',
                    baseline 
                });
                this.refresh();
                vscode.window.showInformationMessage(`Baseline "${baseline.name}" has been deleted.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Error deleting baseline: ${error}`);
            }
        }
    }
}

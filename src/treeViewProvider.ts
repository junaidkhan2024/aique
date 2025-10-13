import * as vscode from 'vscode';
import { HTMLCaptureProvider } from './htmlCaptureProvider';

export class TreeViewProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private htmlCaptureProvider: HTMLCaptureProvider) {}

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                new TreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'actions'),
                new TreeItem('Baselines', vscode.TreeItemCollapsibleState.Expanded, 'baselines'),
                new TreeItem('Settings', vscode.TreeItemCollapsibleState.Collapsed, 'settings')
            ]);
        }

        switch (element.contextValue) {
            case 'actions':
                return Promise.resolve([
                    new TreeItem('Capture Baseline', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.captureBaseline', title: 'Capture Baseline' }),
                    new TreeItem('Compare Structure', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.compareStructure', title: 'Compare Structure' }),
                    new TreeItem('Generate Locators', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.generateLocators', title: 'Generate Locators' }),
                    new TreeItem('Iterate Diff Results', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.iterateDiffResults', title: 'Iterate Diff Results' }),
                    new TreeItem('Setup Project', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.reconfigureProject', title: 'Setup Project' }),
                    new TreeItem('Edit Setup', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.viewProjectSettings', title: 'Edit Setup' }),
                    new TreeItem('Delete Project', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.deleteProject', title: 'Delete Project' }),
                    new TreeItem('Clear All Data', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.clearWorkspaceStorage', title: 'Clear All Data' }),
                    new TreeItem('Refresh Panel', vscode.TreeItemCollapsibleState.None, 'action', { command: 'qa-html-capture.refreshPanel', title: 'Refresh Panel' })
                ]);

            case 'baselines':
                const baselines = this.htmlCaptureProvider.getAllBaselines();
                if (baselines.length === 0) {
                    return Promise.resolve([
                        new TreeItem('No baselines found', vscode.TreeItemCollapsibleState.None, 'empty')
                    ]);
                }
                return Promise.resolve(
                    baselines.map(baseline => 
                        new TreeItem(
                            `${baseline.name} (${new Date(baseline.timestamp).toLocaleDateString()})`,
                            vscode.TreeItemCollapsibleState.None,
                            'baseline',
                            undefined,
                            baseline
                        )
                    )
                );

            case 'settings':
                return Promise.resolve([
                    new TreeItem('Show Baselines Folder', vscode.TreeItemCollapsibleState.Collapsed, 'showBaselines'),
                    new TreeItem('Clear All Baselines', vscode.TreeItemCollapsibleState.None, 'setting', { command: 'qa-html-capture.clearAllBaselines', title: 'Clear All Baselines' })
                ]);

            case 'showBaselines':
                return this.getBaselineFiles();

            default:
                return Promise.resolve([]);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private async getBaselineFiles(): Promise<TreeItem[]> {
        try {
            const baselines = this.htmlCaptureProvider.getAllBaselines();
            if (baselines.length === 0) {
                return [
                    new TreeItem('No baseline files found', vscode.TreeItemCollapsibleState.None, 'empty')
                ];
            }

            return baselines.map(baseline => {
                console.log('Creating TreeItem for baseline:', baseline);
                return new TreeItem(
                    `${baseline.name} ${baseline.id}.json`,
                    vscode.TreeItemCollapsibleState.None,
                    'baselineFile',
                    { command: 'qa-html-capture.openBaselineFile', title: 'Open Baseline File', arguments: [baseline] }
                );
            });
        } catch (error) {
            return [
                new TreeItem(`Error loading files: ${error}`, vscode.TreeItemCollapsibleState.None, 'error')
            ];
        }
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly command?: vscode.Command,
        public readonly baseline?: any
    ) {
        super(label, collapsibleState);
        
        if (command) {
            this.command = command;
        }
        
        if (contextValue === 'baseline') {
            this.iconPath = new vscode.ThemeIcon('file-code');
            // Add delete command for baseline items
            this.command = {
                command: 'qa-html-capture.deleteBaseline',
                title: 'Delete Baseline',
                arguments: [baseline]
            };
        } else if (contextValue === 'baselineFile') {
            this.iconPath = new vscode.ThemeIcon('file');
            // Don't override the command for baselineFile - use the one passed in constructor
            // The command is already set in the constructor for opening files
        } else if (contextValue === 'action') {
            this.iconPath = new vscode.ThemeIcon('play');
        } else if (contextValue === 'setting') {
            this.iconPath = new vscode.ThemeIcon('gear');
        } else if (contextValue === 'showBaselines') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
            // Add command to show path when clicked
            this.command = {
                command: 'qa-html-capture.showBaselinesFolder',
                title: 'Show Baselines Folder'
            };
        } else if (contextValue === 'empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (contextValue === 'error') {
            this.iconPath = new vscode.ThemeIcon('error');
        }
    }
}

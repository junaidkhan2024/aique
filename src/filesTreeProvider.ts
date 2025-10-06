import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface FileItem {
    label: string;
    filePath: string;
    type: 'config' | 'metadata';
    timestamp?: string;
    size?: string;
}

export class FilesTreeProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private configStoragePath: string;
    private metadataStoragePath: string;

    constructor(private context: vscode.ExtensionContext) {
        // Use workspace storage instead of global storage for project-specific files
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Store in workspace folder
            this.configStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config');
            this.metadataStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'metadata');
        } else {
            // Fallback to global storage if no workspace
            this.configStoragePath = path.join(context.globalStorageUri.fsPath, 'config');
            this.metadataStoragePath = path.join(context.globalStorageUri.fsPath, 'metadata');
        }
    }

    refresh(): void {
        // Update storage paths in case workspace changed
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Store in workspace folder
            this.configStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config');
            this.metadataStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'metadata');
        } else {
            // Fallback to global storage if no workspace
            this.configStoragePath = path.join(this.context.globalStorageUri.fsPath, 'config');
            this.metadataStoragePath = path.join(this.context.globalStorageUri.fsPath, 'metadata');
        }
        
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        // Check if this is a directory (folder) or a file
        const isDirectory = element.label.includes('Project Configuration') || element.label.includes('Captured Metadata');
        
        const treeItem = new vscode.TreeItem(
            element.label, 
            isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );
        
        // Set appropriate icon based on file type
        if (isDirectory) {
            treeItem.iconPath = new vscode.ThemeIcon('folder');
            treeItem.contextValue = 'folder';
            // Add command to open folder in file explorer
            treeItem.command = {
                command: 'qa-html-capture.openFolder',
                title: 'Open Folder',
                arguments: [element]
            };
        } else if (element.type === 'config') {
            treeItem.iconPath = new vscode.ThemeIcon('settings-gear');
            treeItem.contextValue = 'configFile';
        } else if (element.type === 'metadata') {
            treeItem.iconPath = new vscode.ThemeIcon('database');
            treeItem.contextValue = 'metadataFile';
        }

        // Set tooltip with file information
        if (isDirectory) {
            treeItem.tooltip = `Folder: ${element.label}\nPath: ${element.filePath}`;
        } else {
            treeItem.tooltip = `File: ${element.label}\nPath: ${element.filePath}${element.timestamp ? `\nModified: ${element.timestamp}` : ''}${element.size ? `\nSize: ${element.size}` : ''}`;
        }
        
        // Set command for files (folders already have their command set above)
        if (!isDirectory) {
            treeItem.command = {
                command: 'qa-html-capture.openFile',
                title: 'Open File',
                arguments: [element]
            };
        }

        return treeItem;
    }

    getChildren(element?: FileItem): FileItem[] {
        if (!element) {
            // Root level - return categories
            return [
                {
                    label: 'Project Configuration',
                    filePath: this.configStoragePath,
                    type: 'config'
                },
                {
                    label: 'Captured Metadata',
                    filePath: this.metadataStoragePath,
                    type: 'metadata'
                }
            ];
        }

        // Check if this is a directory that should be expanded
        const isDirectory = element.label.includes('Project Configuration') || element.label.includes('Captured Metadata');
        if (isDirectory) {
            // Return files in the selected directory
            return this.getFilesInDirectory(element.filePath, element.type);
        }

        // If it's a file, return empty array (files don't have children)
        return [];
    }

    private getFilesInDirectory(dirPath: string, type: 'config' | 'metadata'): FileItem[] {
        try {
            if (!fs.existsSync(dirPath)) {
                return [];
            }

            const files = fs.readdirSync(dirPath);
            const fileItems: FileItem[] = [];

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);

                if (stats.isFile()) {
                    // Filter files based on type
                    let shouldInclude = false;
                    if (type === 'config' && file.endsWith('.json')) {
                        shouldInclude = true;
                    } else if (type === 'metadata' && file.startsWith('metadata_') && file.endsWith('.json')) {
                        shouldInclude = true;
                    }

                    if (shouldInclude) {
                        const fileItem: FileItem = {
                            label: file,
                            filePath: filePath,
                            type: type,
                            timestamp: stats.mtime.toLocaleString(),
                            size: this.formatFileSize(stats.size)
                        };
                        fileItems.push(fileItem);
                    }
                }
            }

            // Sort files by modification time (newest first)
            return fileItems.sort((a, b) => {
                const aTime = fs.statSync(a.filePath).mtime.getTime();
                const bTime = fs.statSync(b.filePath).mtime.getTime();
                return bTime - aTime;
            });
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Method to get file content for preview
    public async getFileContent(filePath: string): Promise<string> {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read file: ${error}`);
        }
    }

    // Method to get file stats
    public getFileStats(filePath: string): fs.Stats | null {
        try {
            return fs.statSync(filePath);
        } catch (error) {
            return null;
        }
    }
}

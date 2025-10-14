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
exports.FilesTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FilesTreeProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Use workspace storage instead of global storage for project-specific files
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Store in workspace folder
            this.configStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config');
            this.metadataStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'metadata');
            this.testsStoragePath = path.join(workspaceFolder.uri.fsPath, 'tests');
        }
        else {
            // Fallback to global storage if no workspace
            this.configStoragePath = path.join(context.globalStorageUri.fsPath, 'config');
            this.metadataStoragePath = path.join(context.globalStorageUri.fsPath, 'metadata');
            this.testsStoragePath = path.join(context.globalStorageUri.fsPath, 'tests');
        }
    }
    refresh() {
        // Update storage paths in case workspace changed
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Store in workspace folder
            this.configStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'config');
            this.metadataStoragePath = path.join(workspaceFolder.uri.fsPath, '.qa-capture', 'metadata');
            this.testsStoragePath = path.join(workspaceFolder.uri.fsPath, 'tests');
        }
        else {
            // Fallback to global storage if no workspace
            this.configStoragePath = path.join(this.context.globalStorageUri.fsPath, 'config');
            this.metadataStoragePath = path.join(this.context.globalStorageUri.fsPath, 'metadata');
            this.testsStoragePath = path.join(this.context.globalStorageUri.fsPath, 'tests');
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        // Check if this is a directory (folder) or a file
        const isDirectory = element.label.includes('Project Configuration') || element.label.includes('Captured Metadata') || element.label.includes('Generated Tests');
        const treeItem = new vscode.TreeItem(element.label, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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
        }
        else if (element.type === 'config') {
            treeItem.iconPath = new vscode.ThemeIcon('settings-gear');
            treeItem.contextValue = 'configFile';
        }
        else if (element.type === 'metadata') {
            treeItem.iconPath = new vscode.ThemeIcon('database');
            treeItem.contextValue = 'metadataFile';
        }
        else if (element.type === 'test') {
            treeItem.iconPath = new vscode.ThemeIcon('beaker');
            treeItem.contextValue = 'testFile';
        }
        // Set tooltip with file information
        if (isDirectory) {
            treeItem.tooltip = `Folder: ${element.label}\nPath: ${element.filePath}`;
        }
        else {
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
    getChildren(element) {
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
                },
                {
                    label: 'Generated Tests',
                    filePath: this.testsStoragePath,
                    type: 'test'
                }
            ];
        }
        // Check if this is a directory that should be expanded
        const isDirectory = element.label.includes('Project Configuration') || element.label.includes('Captured Metadata') || element.label.includes('Generated Tests');
        if (isDirectory) {
            // Return files in the selected directory
            return this.getFilesInDirectory(element.filePath, element.type);
        }
        // If it's a file, return empty array (files don't have children)
        return [];
    }
    getFilesInDirectory(dirPath, type) {
        try {
            if (!fs.existsSync(dirPath)) {
                return [];
            }
            const files = fs.readdirSync(dirPath);
            const fileItems = [];
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    // Filter files based on type
                    let shouldInclude = false;
                    if (type === 'config' && file.endsWith('.json')) {
                        shouldInclude = true;
                    }
                    else if (type === 'metadata' && file.startsWith('metadata_') && file.endsWith('.json')) {
                        shouldInclude = true;
                    }
                    else if (type === 'test' && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py') || file.endsWith('.java') || file.endsWith('.cs') || file.endsWith('.json'))) {
                        shouldInclude = true;
                    }
                    if (shouldInclude) {
                        const fileItem = {
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
        }
        catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    // Method to get file content for preview
    async getFileContent(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        }
        catch (error) {
            throw new Error(`Failed to read file: ${error}`);
        }
    }
    // Method to get file stats
    getFileStats(filePath) {
        try {
            return fs.statSync(filePath);
        }
        catch (error) {
            return null;
        }
    }
}
exports.FilesTreeProvider = FilesTreeProvider;
//# sourceMappingURL=filesTreeProvider.js.map
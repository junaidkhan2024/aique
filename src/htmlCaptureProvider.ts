import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface BaselineItem {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    baseline?: BaselineData;
    type: 'baseline' | 'comparison' | 'diff';
    contextValue?: string;
}

export interface BaselineData {
    id: string;
    name: string;
    url: string;
    timestamp: Date;
    html: string;
    structure: any;
    elementMap: Map<string, ElementInfo>;
}

export interface ElementInfo {
    tagName: string;
    attributes: { [key: string]: string };
    text: string;
    xpath: string;
    cssSelector: string;
    locators: string[];
}

export class HTMLCaptureProvider implements vscode.TreeDataProvider<BaselineItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BaselineItem | undefined | null | void> = new vscode.EventEmitter<BaselineItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BaselineItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private baselines: Map<string, BaselineData> = new Map();
    private storagePath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.storagePath = path.join(context.globalStorageUri.fsPath, 'baselines');
        this.ensureStorageDirectory();
        this.loadBaselines();
    }

    private ensureStorageDirectory(): void {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    private loadBaselines(): void {
        try {
            const files = fs.readdirSync(this.storagePath);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.storagePath, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const baseline: BaselineData = {
                        ...data,
                        timestamp: new Date(data.timestamp),
                        elementMap: new Map(Object.entries(data.elementMap || {}))
                    };
                    this.baselines.set(baseline.id, baseline);
                }
            });
        } catch (error) {
            console.error('Error loading baselines:', error);
        }
    }

    private saveBaseline(baseline: BaselineData): void {
        const filePath = path.join(this.storagePath, `${baseline.id}.json`);
        const dataToSave = {
            ...baseline,
            elementMap: Object.fromEntries(baseline.elementMap)
        };
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    }

    async captureBaseline(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found. Please open an HTML file.');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'html') {
            vscode.window.showErrorMessage('Current file is not an HTML file.');
            return;
        }

        const htmlContent = document.getText();
        
        // Ask for baseline name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this baseline',
            placeHolder: 'e.g., Homepage v1.0'
        });

        if (!name) {
            return;
        }

        try {
            const baseline = await this.processHTML(htmlContent, name, document.uri.toString());
            this.baselines.set(baseline.id, baseline);
            this.saveBaseline(baseline);
            this._onDidChangeTreeData.fire();
            
            vscode.window.showInformationMessage(`Baseline "${name}" captured successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error capturing baseline: ${error}`);
        }
    }

    private async processHTML(html: string, name: string, url: string): Promise<BaselineData> {
        const $ = cheerio.load(html);
        const elementMap = new Map<string, ElementInfo>();

        // Process each element
        $('*').each((index, element) => {
            const $el = $(element);
            const elementInfo: ElementInfo = {
                tagName: (element as any).tagName || 'unknown',
                attributes: this.getAttributes(element),
                text: $el.text().trim(),
                xpath: this.generateXPath(element),
                cssSelector: this.generateCSSSelector(element),
                locators: this.generateLocators(element, $el)
            };

            const elementId = this.generateElementId(element, index);
            elementMap.set(elementId, elementInfo);
        });

        return {
            id: Date.now().toString(),
            name,
            url,
            timestamp: new Date(),
            html,
            structure: this.extractStructure($),
            elementMap
        };
    }

    private getAttributes(element: any): { [key: string]: string } {
        const attrs: { [key: string]: string } = {};
        if (element.attribs) {
            for (const [key, value] of Object.entries(element.attribs)) {
                attrs[key] = value as string;
            }
        }
        return attrs;
    }

    private generateXPath(element: any): string {
        // Simple XPath generation - can be enhanced
        const parts: string[] = [];
        let current = element;
        
        while (current && current.parent) {
            let index = 1;
            let sibling = current.prev;
            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    index++;
                }
                sibling = sibling.prev;
            }
            
            const tagName = current.tagName.toLowerCase();
            const id = current.attribs?.id;
            const className = current.attribs?.class;
            
            if (id) {
                parts.unshift(`//*[@id='${id}']`);
                break;
            } else if (className) {
                parts.unshift(`${tagName}[contains(@class,'${className.split(' ')[0]}')][${index}]`);
            } else {
                parts.unshift(`${tagName}[${index}]`);
            }
            
            current = current.parent;
        }
        
        return parts.join('/') || '/';
    }

    private generateCSSSelector(element: any): string {
        // Simple CSS selector generation
        const parts: string[] = [];
        let current = element;
        
        while (current && current.parent) {
            let selector = current.tagName.toLowerCase();
            
            if (current.attribs?.id) {
                selector += `#${current.attribs.id}`;
                parts.unshift(selector);
                break;
            }
            
            if (current.attribs?.class) {
                const classes = current.attribs.class.split(' ').filter((c: string) => c.trim());
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }
            
            parts.unshift(selector);
            current = current.parent;
        }
        
        return parts.join(' > ') || element.tagName.toLowerCase();
    }

    private generateLocators(element: any, $el: any): string[] {
        const locators: string[] = [];
        
        // ID locator
        if (element.attribs?.id) {
            locators.push(`#${element.attribs.id}`);
        }
        
        // Class locators
        if (element.attribs?.class) {
            const classes = element.attribs.class.split(' ').filter((c: string) => c.trim());
            classes.forEach((cls: string) => locators.push(`.${cls}`));
        }
        
        // Data attribute locators
        Object.keys(element.attribs || {}).forEach(attr => {
            if (attr.startsWith('data-')) {
                locators.push(`[${attr}="${element.attribs[attr]}"]`);
            }
        });
        
        // Text content locator (if unique)
        const text = $el.text().trim();
        if (text && text.length < 50) {
            locators.push(`text=${text}`);
        }
        
        return locators;
    }

    private generateElementId(element: any, index: number): string {
        if (element.attribs?.id) {
            return element.attribs.id;
        }
        return `element_${index}_${element.tagName}`;
    }

    private extractStructure($: cheerio.CheerioAPI): any {
        return {
            title: $('title').text(),
            body: this.extractElementStructure($('body')[0], $),
            metadata: {
                totalElements: $('*').length,
                hasForm: $('form').length > 0,
                hasTable: $('table').length > 0,
                hasImages: $('img').length > 0
            }
        };
    }

    private extractElementStructure(element: any, $: cheerio.CheerioAPI): any {
        if (!element) return null;
        
        return {
            tagName: element.tagName,
            attributes: this.getAttributes(element),
            children: Array.from(element.children || []).map((child: any) => 
                child.type === 'tag' ? this.extractElementStructure(child, $) : null
            ).filter(Boolean)
        };
    }

    deleteBaseline(item: BaselineItem): void {
        if (item.baseline) {
            this.baselines.delete(item.baseline.id);
            const filePath = path.join(this.storagePath, `${item.baseline.id}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Baseline "${item.baseline.name}" deleted.`);
        }
    }

    getTreeItem(element: BaselineItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        treeItem.contextValue = element.contextValue;
        
        if (element.baseline) {
            treeItem.tooltip = `${element.baseline.name}\nURL: ${element.baseline.url}\nCaptured: ${element.baseline.timestamp.toLocaleString()}`;
        }
        
        return treeItem;
    }

    getChildren(element?: BaselineItem): BaselineItem[] {
        if (!element) {
            // Root level - show all baselines
            return Array.from(this.baselines.values()).map(baseline => ({
                label: baseline.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                baseline,
                type: 'baseline' as const,
                contextValue: 'baseline'
            }));
        }

        if (element.type === 'baseline' && element.baseline) {
            // Show baseline details
            return [
                {
                    label: `URL: ${element.baseline.url}`,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    type: 'baseline' as const
                },
                {
                    label: `Captured: ${element.baseline.timestamp.toLocaleString()}`,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    type: 'baseline' as const
                },
                {
                    label: `Elements: ${element.baseline.elementMap.size}`,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    type: 'baseline' as const
                }
            ];
        }

        return [];
    }

    private async fetchWebPage(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async captureFromWeb(): Promise<void> {
        // Ask for URL
        const url = await vscode.window.showInputBox({
            prompt: 'Enter the URL of the webpage to capture',
            placeHolder: 'https://example.com',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (!url) {
            return;
        }

        // Ask for baseline name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this web page baseline',
            placeHolder: 'e.g., Homepage v1.0'
        });

        if (!name) {
            return;
        }

        try {
            vscode.window.showInformationMessage('Fetching webpage...');
            
            // Fetch the webpage using Node.js HTTP
            const htmlContent = await this.fetchWebPage(url);
            
            // Process the HTML
            const baseline = await this.processHTML(htmlContent, name, url);
            this.baselines.set(baseline.id, baseline);
            this.saveBaseline(baseline);
            this._onDidChangeTreeData.fire();
            
            vscode.window.showInformationMessage(`Web page baseline "${name}" captured successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error capturing web page: ${error}`);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getBaseline(id: string): BaselineData | undefined {
        return this.baselines.get(id);
    }

    getAllBaselines(): BaselineData[] {
        return Array.from(this.baselines.values());
    }
}

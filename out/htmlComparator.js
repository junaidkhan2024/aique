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
exports.HTMLComparator = void 0;
const vscode = __importStar(require("vscode"));
const cheerio = __importStar(require("cheerio"));
const htmlCaptureProvider_1 = require("./htmlCaptureProvider");
class HTMLComparator {
    constructor(context) {
        this.context = context;
    }
    async compareStructure() {
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
        // Get all available baselines
        const htmlCaptureProvider = new htmlCaptureProvider_1.HTMLCaptureProvider(this.context);
        const baselines = htmlCaptureProvider.getAllBaselines();
        if (baselines.length === 0) {
            vscode.window.showErrorMessage('No baselines found. Please capture a baseline first.');
            return;
        }
        // Let user select baseline to compare against
        const baselineItems = baselines.map(b => ({
            label: b.name,
            description: `Captured: ${b.timestamp.toLocaleString()}`,
            baseline: b
        }));
        const selectedBaseline = await vscode.window.showQuickPick(baselineItems, {
            placeHolder: 'Select a baseline to compare against',
            title: 'HTML Structure Comparison'
        });
        if (!selectedBaseline) {
            return;
        }
        try {
            const currentHtml = document.getText();
            const comparisonResult = await this.compareHTML(selectedBaseline.baseline, currentHtml, document.uri.toString());
            // Store comparison result
            await this.saveComparisonResult(comparisonResult);
            // Show results
            await this.showComparisonResults(comparisonResult);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error comparing structures: ${error}`);
        }
    }
    async compareHTML(baseline, currentHtml, currentUrl) {
        const $current = cheerio.load(currentHtml);
        const $baseline = cheerio.load(baseline.html);
        // Extract current structure
        const currentElements = this.extractElements($current);
        const baselineElements = baseline.elementMap;
        const differences = [];
        const summary = {
            totalElements: currentElements.size,
            addedElements: 0,
            removedElements: 0,
            modifiedElements: 0,
            movedElements: 0,
            locatorChanges: 0
        };
        // Find added and modified elements
        for (const [elementId, currentElement] of currentElements) {
            const baselineElement = baselineElements.get(elementId);
            if (!baselineElement) {
                // New element
                differences.push({
                    type: 'added',
                    elementId,
                    newElement: currentElement,
                    newXPath: currentElement.xpath,
                    newLocators: currentElement.locators,
                    description: `New element: ${currentElement.tagName}`
                });
                summary.addedElements++;
            }
            else {
                // Check for modifications
                const elementDiff = this.compareElements(baselineElement, currentElement);
                if (elementDiff) {
                    differences.push(elementDiff);
                    switch (elementDiff.type) {
                        case 'modified':
                            summary.modifiedElements++;
                            break;
                        case 'moved':
                            summary.movedElements++;
                            break;
                    }
                    // Check for locator changes
                    if (this.hasLocatorChanges(baselineElement.locators, currentElement.locators)) {
                        summary.locatorChanges++;
                    }
                }
            }
        }
        // Find removed elements
        for (const [elementId, baselineElement] of baselineElements) {
            if (!currentElements.has(elementId)) {
                differences.push({
                    type: 'removed',
                    elementId,
                    oldElement: baselineElement,
                    oldXPath: baselineElement.xpath,
                    oldLocators: baselineElement.locators,
                    description: `Removed element: ${baselineElement.tagName}`
                });
                summary.removedElements++;
            }
        }
        return {
            baselineId: baseline.id,
            baselineName: baseline.name,
            baselineHtml: baseline.html,
            currentHtml,
            differences,
            summary,
            timestamp: new Date()
        };
    }
    extractElements($) {
        const elementMap = new Map();
        $('*').each((index, element) => {
            const $el = $(element);
            const elementInfo = {
                tagName: element.tagName || 'unknown',
                attributes: this.getAttributes(element),
                text: $el.text().trim(),
                xpath: this.generateXPath(element),
                cssSelector: this.generateCSSSelector(element),
                locators: this.generateLocators(element, $el)
            };
            const elementId = this.generateElementId(element, index);
            elementMap.set(elementId, elementInfo);
        });
        return elementMap;
    }
    getAttributes(element) {
        const attrs = {};
        if (element.attribs) {
            for (const [key, value] of Object.entries(element.attribs)) {
                attrs[key] = value;
            }
        }
        return attrs;
    }
    generateXPath(element) {
        const parts = [];
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
            }
            else if (className) {
                parts.unshift(`${tagName}[contains(@class,'${className.split(' ')[0]}')][${index}]`);
            }
            else {
                parts.unshift(`${tagName}[${index}]`);
            }
            current = current.parent;
        }
        return parts.join('/') || '/';
    }
    generateCSSSelector(element) {
        const parts = [];
        let current = element;
        while (current && current.parent) {
            let selector = current.tagName.toLowerCase();
            if (current.attribs?.id) {
                selector += `#${current.attribs.id}`;
                parts.unshift(selector);
                break;
            }
            if (current.attribs?.class) {
                const classes = current.attribs.class.split(' ').filter((c) => c.trim());
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }
            parts.unshift(selector);
            current = current.parent;
        }
        return parts.join(' > ') || element.tagName.toLowerCase();
    }
    generateLocators(element, $el) {
        const locators = [];
        if (element.attribs?.id) {
            locators.push(`#${element.attribs.id}`);
        }
        if (element.attribs?.class) {
            const classes = element.attribs.class.split(' ').filter((c) => c.trim());
            classes.forEach((cls) => locators.push(`.${cls}`));
        }
        Object.keys(element.attribs || {}).forEach(attr => {
            if (attr.startsWith('data-')) {
                locators.push(`[${attr}="${element.attribs[attr]}"]`);
            }
        });
        const text = $el.text().trim();
        if (text && text.length < 50) {
            locators.push(`text=${text}`);
        }
        return locators;
    }
    generateElementId(element, index) {
        if (element.attribs?.id) {
            return element.attribs.id;
        }
        return `element_${index}_${element.tagName}`;
    }
    compareElements(baseline, current) {
        const differences = [];
        // Compare tag name
        if (baseline.tagName !== current.tagName) {
            differences.push(`Tag changed: ${baseline.tagName} → ${current.tagName}`);
        }
        // Compare attributes
        const baselineAttrs = new Set(Object.keys(baseline.attributes));
        const currentAttrs = new Set(Object.keys(current.attributes));
        const addedAttrs = [...currentAttrs].filter(attr => !baselineAttrs.has(attr));
        const removedAttrs = [...baselineAttrs].filter(attr => !currentAttrs.has(attr));
        const modifiedAttrs = [...baselineAttrs]
            .filter(attr => currentAttrs.has(attr))
            .filter(attr => baseline.attributes[attr] !== current.attributes[attr]);
        if (addedAttrs.length > 0) {
            differences.push(`Added attributes: ${addedAttrs.join(', ')}`);
        }
        if (removedAttrs.length > 0) {
            differences.push(`Removed attributes: ${removedAttrs.join(', ')}`);
        }
        if (modifiedAttrs.length > 0) {
            differences.push(`Modified attributes: ${modifiedAttrs.join(', ')}`);
        }
        // Compare text content
        if (baseline.text !== current.text) {
            differences.push(`Text changed: "${baseline.text}" → "${current.text}"`);
        }
        // Compare XPath (for moved elements)
        if (baseline.xpath !== current.xpath) {
            differences.push(`XPath changed: ${baseline.xpath} → ${current.xpath}`);
        }
        if (differences.length === 0) {
            return null;
        }
        // Determine type of change
        let type = 'modified';
        if (baseline.xpath !== current.xpath && baseline.tagName === current.tagName &&
            JSON.stringify(baseline.attributes) === JSON.stringify(current.attributes)) {
            type = 'moved';
        }
        return {
            type,
            elementId: baseline.tagName,
            oldElement: baseline,
            newElement: current,
            oldXPath: baseline.xpath,
            newXPath: current.xpath,
            oldLocators: baseline.locators,
            newLocators: current.locators,
            description: differences.join('; ')
        };
    }
    hasLocatorChanges(oldLocators, newLocators) {
        const oldSet = new Set(oldLocators);
        const newSet = new Set(newLocators);
        return oldSet.size !== newSet.size ||
            [...oldSet].some(locator => !newSet.has(locator)) ||
            [...newSet].some(locator => !oldSet.has(locator));
    }
    async saveComparisonResult(result) {
        const storagePath = this.context.globalStorageUri.fsPath;
        const comparisonsDir = `${storagePath}/comparisons`;
        if (!require('fs').existsSync(comparisonsDir)) {
            require('fs').mkdirSync(comparisonsDir, { recursive: true });
        }
        const filename = `comparison_${Date.now()}.json`;
        const filepath = `${comparisonsDir}/${filename}`;
        require('fs').writeFileSync(filepath, JSON.stringify(result, null, 2));
    }
    async showComparisonResults(result) {
        const summary = result.summary;
        const message = `Comparison Complete!\n\n` +
            `Total Elements: ${summary.totalElements}\n` +
            `Added: ${summary.addedElements}\n` +
            `Removed: ${summary.removedElements}\n` +
            `Modified: ${summary.modifiedElements}\n` +
            `Moved: ${summary.movedElements}\n` +
            `Locator Changes: ${summary.locatorChanges}`;
        const action = await vscode.window.showInformationMessage(message, 'View Detailed Diff', 'Generate Updated Locators', 'Export Report');
        switch (action) {
            case 'View Detailed Diff':
                await vscode.commands.executeCommand('qa-html-capture.viewDiff', result);
                break;
            case 'Generate Updated Locators':
                await vscode.commands.executeCommand('qa-html-capture.generateLocators');
                break;
            case 'Export Report':
                await this.exportComparisonReport(result);
                break;
        }
    }
    async exportComparisonReport(result) {
        const report = this.generateReport(result);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`html-comparison-report-${Date.now()}.md`),
            filters: {
                'Markdown': ['md'],
                'Text': ['txt'],
                'HTML': ['html']
            }
        });
        if (uri) {
            require('fs').writeFileSync(uri.fsPath, report);
            vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
        }
    }
    generateReport(result) {
        const { summary, differences } = result;
        let report = `# HTML Structure Comparison Report\n\n`;
        report += `**Baseline:** ${result.baselineName}\n`;
        report += `**Comparison Date:** ${result.timestamp.toLocaleString()}\n\n`;
        report += `## Summary\n\n`;
        report += `- Total Elements: ${summary.totalElements}\n`;
        report += `- Added Elements: ${summary.addedElements}\n`;
        report += `- Removed Elements: ${summary.removedElements}\n`;
        report += `- Modified Elements: ${summary.modifiedElements}\n`;
        report += `- Moved Elements: ${summary.movedElements}\n`;
        report += `- Locator Changes: ${summary.locatorChanges}\n\n`;
        if (differences.length > 0) {
            report += `## Detailed Changes\n\n`;
            const byType = differences.reduce((acc, diff) => {
                if (!acc[diff.type])
                    acc[diff.type] = [];
                acc[diff.type].push(diff);
                return acc;
            }, {});
            Object.entries(byType).forEach(([type, diffs]) => {
                report += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Elements\n\n`;
                diffs.forEach(diff => {
                    report += `- **${diff.elementId}**: ${diff.description}\n`;
                    if (diff.oldLocators && diff.newLocators) {
                        report += `  - Old Locators: ${diff.oldLocators.join(', ')}\n`;
                        report += `  - New Locators: ${diff.newLocators.join(', ')}\n`;
                    }
                    report += `\n`;
                });
            });
        }
        return report;
    }
}
exports.HTMLComparator = HTMLComparator;
//# sourceMappingURL=htmlComparator.js.map
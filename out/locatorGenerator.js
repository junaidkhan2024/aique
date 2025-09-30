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
exports.LocatorGenerator = void 0;
const vscode = __importStar(require("vscode"));
const cheerio = __importStar(require("cheerio"));
class LocatorGenerator {
    async generateLocators() {
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
        try {
            const html = document.getText();
            const locators = await this.generateAllLocators(html);
            // Create a clean, actionable locator report
            const report = this.generateCleanLocatorReport(locators);
            // Create a new document with the locators
            const locatorDocument = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(locatorDocument);
            vscode.window.showInformationMessage('Locators generated successfully!');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error generating locators: ${error}`);
        }
    }
    async generateUpdatedLocatorsFromComparison(comparison) {
        const actionableUpdates = [];
        for (const diff of comparison.differences) {
            const update = this.createActionableUpdate(diff);
            if (update) {
                actionableUpdates.push(update);
            }
        }
        if (actionableUpdates.length === 0) {
            vscode.window.showInformationMessage('No significant locator changes detected.');
            return;
        }
        // Create a clean, actionable report
        const report = this.generateActionableReport(actionableUpdates, comparison);
        // Create document with the report
        const locatorDocument = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(locatorDocument);
        vscode.window.showInformationMessage(`Generated ${actionableUpdates.length} actionable locator updates!`);
    }
    async generateAllLocators(html) {
        const $ = cheerio.load(html);
        const locators = [];
        $('*').each((index, element) => {
            const $el = $(element);
            const elementLocators = this.generateElementLocators(element, $el, index, $);
            if (elementLocators.locators.length > 0) {
                locators.push(elementLocators);
            }
        });
        return locators;
    }
    generateElementLocators(element, $el, index, $) {
        const locators = [];
        const priority = [];
        // 1. ID selector (highest priority)
        if (element.attribs?.id) {
            const idLocator = `#${element.attribs.id}`;
            locators.push(idLocator);
            priority.push({
                locator: idLocator,
                type: 'id',
                priority: 1,
                reliability: 'high',
                reason: 'Unique ID attribute'
            });
        }
        // 2. Data attributes (high priority)
        Object.keys(element.attribs || {}).forEach(attr => {
            if (attr.startsWith('data-')) {
                const dataLocator = `[${attr}="${element.attribs[attr]}"]`;
                locators.push(dataLocator);
                priority.push({
                    locator: dataLocator,
                    type: 'data-attribute',
                    priority: 2,
                    reliability: 'high',
                    reason: 'Test-friendly data attribute'
                });
            }
        });
        // 3. Name attribute
        if (element.attribs?.name) {
            const nameLocator = `[name="${element.attribs.name}"]`;
            locators.push(nameLocator);
            priority.push({
                locator: nameLocator,
                type: 'name',
                priority: 3,
                reliability: 'medium',
                reason: 'Form element name attribute'
            });
        }
        // 4. Class selectors (medium priority, but check uniqueness)
        if (element.attribs?.class) {
            const classes = element.attribs.class.split(' ').filter((c) => c.trim());
            classes.forEach((cls) => {
                const classLocator = `.${cls}`;
                const isUnique = $ ? this.isClassUnique($, cls) : false;
                locators.push(classLocator);
                priority.push({
                    locator: classLocator,
                    type: 'class',
                    priority: isUnique ? 4 : 6,
                    reliability: isUnique ? 'medium' : 'low',
                    reason: isUnique ? 'Unique class name' : 'Non-unique class name'
                });
            });
        }
        // 5. Text content (for interactive elements)
        const text = $el.text().trim();
        if (text && text.length < 50 && this.isInteractiveElement(element.tagName)) {
            const textLocator = `text=${text}`;
            locators.push(textLocator);
            priority.push({
                locator: textLocator,
                type: 'text',
                priority: 5,
                reliability: 'medium',
                reason: 'Interactive element with unique text'
            });
        }
        // 6. XPath (fallback)
        const xpath = this.generateXPath(element);
        if (xpath) {
            locators.push(xpath);
            priority.push({
                locator: xpath,
                type: 'xpath',
                priority: 7,
                reliability: 'low',
                reason: 'XPath fallback - fragile to DOM changes'
            });
        }
        // 7. CSS selector hierarchy
        const cssSelector = this.generateCSSSelector(element);
        if (cssSelector && !locators.includes(cssSelector)) {
            locators.push(cssSelector);
            priority.push({
                locator: cssSelector,
                type: 'css-hierarchy',
                priority: 8,
                reliability: 'medium',
                reason: 'CSS selector hierarchy'
            });
        }
        return {
            elementId: this.getElementId(element, index),
            tagName: element.tagName,
            text: text,
            locators: locators,
            priority: priority.sort((a, b) => a.priority - b.priority),
            attributes: this.getAttributes(element),
            xpath: xpath
        };
    }
    getElementId(element, index) {
        if (element.attribs?.id) {
            return element.attribs.id;
        }
        return `element_${index}_${element.tagName}`;
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
    isClassUnique($, className) {
        return $(`.${className}`).length === 1;
    }
    isInteractiveElement(tagName) {
        const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'option'];
        return interactiveTags.includes(tagName.toLowerCase());
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
    getLocatorRecommendations(diff) {
        const recommendations = [];
        if (diff.type === 'removed') {
            recommendations.push('Element was removed - update test scripts to handle element absence');
            recommendations.push('Consider adding wait conditions for dynamic content');
        }
        else if (diff.type === 'added') {
            recommendations.push('New element added - consider adding test coverage');
            recommendations.push('Update test scripts if this element affects existing functionality');
        }
        else if (diff.type === 'modified') {
            recommendations.push('Element modified - verify functionality still works as expected');
            recommendations.push('Update locators to use most stable attributes (ID, data-* attributes)');
        }
        else if (diff.type === 'moved') {
            recommendations.push('Element moved - XPath locators may need updating');
            recommendations.push('Consider using more stable locators (ID, data-* attributes)');
        }
        // Specific recommendations based on locator changes
        if (diff.oldLocators && diff.newLocators) {
            const oldStable = diff.oldLocators.filter(l => l.startsWith('#') || l.startsWith('[data-'));
            const newStable = diff.newLocators.filter(l => l.startsWith('#') || l.startsWith('[data-'));
            if (oldStable.length === 0 && newStable.length > 0) {
                recommendations.push('Consider adding stable attributes (ID, data-*) to elements for better test reliability');
            }
        }
        return recommendations;
    }
    formatLocators(locators) {
        const output = {
            generatedAt: new Date().toISOString(),
            totalElements: locators.length,
            elements: locators.map(el => ({
                id: el.elementId,
                tagName: el.tagName,
                text: el.text,
                attributes: el.attributes,
                recommendedLocator: el.priority[0]?.locator,
                allLocators: el.locators,
                priorityRanking: el.priority.map(p => ({
                    locator: p.locator,
                    type: p.type,
                    reliability: p.reliability,
                    reason: p.reason
                }))
            }))
        };
        return JSON.stringify(output, null, 2);
    }
    formatUpdatedLocators(updatedLocators) {
        const output = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalChanges: updatedLocators.length,
                changeTypes: updatedLocators.reduce((acc, loc) => {
                    acc[loc.changeType] = (acc[loc.changeType] || 0) + 1;
                    return acc;
                }, {})
            },
            updatedLocators: updatedLocators
        };
        return JSON.stringify(output, null, 2);
    }
    createActionableUpdate(diff) {
        const element = diff.newElement || diff.oldElement;
        if (!element)
            return null;
        const bestLocator = this.getBestLocator(element);
        const oldLocator = diff.oldElement ? this.getBestLocator(diff.oldElement) : undefined;
        // Skip if locator hasn't actually changed
        if (oldLocator && bestLocator.locator === oldLocator.locator && diff.type !== 'added' && diff.type !== 'removed') {
            return null;
        }
        return {
            elementId: diff.elementId,
            elementType: element.tagName,
            changeType: diff.type,
            bestLocator: bestLocator.locator,
            locatorType: bestLocator.type,
            reliability: bestLocator.reliability,
            oldLocator: oldLocator?.locator,
            description: this.getChangeDescription(diff),
            action: this.getAction(diff.type),
            codeExample: this.generateCodeExample(element, bestLocator, diff.type)
        };
    }
    getBestLocator(element) {
        // Priority order: ID > data-* > name > unique class > text > xpath
        if (element.attributes?.id) {
            return {
                locator: `#${element.attributes.id}`,
                type: 'id',
                reliability: 'high'
            };
        }
        // Check for data attributes
        for (const [key, value] of Object.entries(element.attributes || {})) {
            if (key.startsWith('data-') && value) {
                return {
                    locator: `[${key}="${value}"]`,
                    type: 'data-attribute',
                    reliability: 'high'
                };
            }
        }
        // Check for name attribute
        if (element.attributes?.name) {
            return {
                locator: `[name="${element.attributes.name}"]`,
                type: 'name',
                reliability: 'medium'
            };
        }
        // Check for unique class
        if (element.attributes?.class) {
            const classes = element.attributes.class.split(' ').filter((c) => c.trim());
            if (classes.length === 1) {
                return {
                    locator: `.${classes[0]}`,
                    type: 'class',
                    reliability: 'medium'
                };
            }
        }
        // Check for text content (for interactive elements)
        if (element.text && element.text.trim() && this.isInteractiveElement(element.tagName)) {
            return {
                locator: `text=${element.text.trim()}`,
                type: 'text',
                reliability: 'medium'
            };
        }
        // Fallback to XPath
        return {
            locator: element.xpath || `//${element.tagName}`,
            type: 'xpath',
            reliability: 'low'
        };
    }
    getChangeDescription(diff) {
        switch (diff.type) {
            case 'added':
                return `New ${diff.newElement?.tagName} element added`;
            case 'removed':
                return `${diff.oldElement?.tagName} element removed`;
            case 'modified':
                return `${diff.newElement?.tagName} element modified`;
            case 'moved':
                return `${diff.newElement?.tagName} element moved to new position`;
            default:
                return 'Element changed';
        }
    }
    getAction(changeType) {
        switch (changeType) {
            case 'added':
                return 'Add new test for this element';
            case 'removed':
                return 'Remove or update tests using this element';
            case 'modified':
                return 'Update existing locators in your tests';
            case 'moved':
                return 'Update XPath-based locators if used';
            default:
                return 'Review and update test locators';
        }
    }
    generateCodeExample(element, bestLocator, changeType) {
        const locator = bestLocator.locator;
        const elementType = element.tagName;
        switch (changeType) {
            case 'added':
                return `// New element - add to your test
await page.locator('${locator}').click();
// or
await page.getByRole('${this.getRole(elementType)}').filter({ hasText: '${element.text || ''}' }).click();`;
            case 'removed':
                return `// Remove this locator from your tests
// OLD: await page.locator('${locator}').click();`;
            case 'modified':
                return `// Update your existing locator
// OLD: await page.locator('${locator}').click();
// NEW: await page.locator('${locator}').click();`;
            case 'moved':
                return `// Element moved - XPath may be fragile
// Consider using: await page.locator('${locator}').click();
// Instead of: await page.locator('${element.xpath}').click();`;
            default:
                return `await page.locator('${locator}').click();`;
        }
    }
    getRole(tagName) {
        const roleMap = {
            'button': 'button',
            'input': 'textbox',
            'a': 'link',
            'select': 'combobox',
            'textarea': 'textbox',
            'form': 'form',
            'h1': 'heading',
            'h2': 'heading',
            'h3': 'heading',
            'h4': 'heading',
            'h5': 'heading',
            'h6': 'heading'
        };
        return roleMap[tagName.toLowerCase()] || 'generic';
    }
    generateActionableReport(updates, comparison) {
        const timestamp = new Date().toLocaleString();
        const summary = comparison.summary;
        let report = `# Locator Update Report\n\n`;
        report += `**Generated:** ${timestamp}\n`;
        report += `**Baseline:** ${comparison.baselineName}\n\n`;
        report += `## Summary\n\n`;
        report += `- **Total Changes:** ${updates.length}\n`;
        report += `- **Added Elements:** ${summary.addedElements}\n`;
        report += `- **Removed Elements:** ${summary.removedElements}\n`;
        report += `- **Modified Elements:** ${summary.modifiedElements}\n`;
        report += `- **Moved Elements:** ${summary.movedElements}\n\n`;
        if (updates.length === 0) {
            report += `## No Action Required\n\n`;
            report += `No significant locator changes detected. Your tests should continue to work as expected.\n`;
            return report;
        }
        report += `## Required Actions\n\n`;
        // Group by change type
        const added = updates.filter(u => u.changeType === 'added');
        const removed = updates.filter(u => u.changeType === 'removed');
        const modified = updates.filter(u => u.changeType === 'modified');
        const moved = updates.filter(u => u.changeType === 'moved');
        if (added.length > 0) {
            report += `### ➕ New Elements (${added.length})\n\n`;
            added.forEach(update => {
                report += this.formatUpdate(update);
            });
        }
        if (removed.length > 0) {
            report += `### ➖ Removed Elements (${removed.length})\n\n`;
            removed.forEach(update => {
                report += this.formatUpdate(update);
            });
        }
        if (modified.length > 0) {
            report += `### Modified Elements (${modified.length})\n\n`;
            modified.forEach(update => {
                report += this.formatUpdate(update);
            });
        }
        if (moved.length > 0) {
            report += `### 📍 Moved Elements (${moved.length})\n\n`;
            moved.forEach(update => {
                report += this.formatUpdate(update);
            });
        }
        report += `## 💡 Best Practices\n\n`;
        report += `1. **Use ID selectors** when available - they're the most reliable\n`;
        report += `2. **Use data-* attributes** for test-specific selectors\n`;
        report += `3. **Avoid XPath** when possible - it's fragile to DOM changes\n`;
        report += `4. **Test your locators** after making changes\n`;
        report += `5. **Use Playwright's built-in locators** like \`getByRole()\` and \`getByText()\`\n\n`;
        report += `---\n`;
        report += `*Generated by QA HTML Structure Capture Extension*\n`;
        return report;
    }
    formatUpdate(update) {
        const reliabilityIcon = update.reliability === 'high' ? '🟢' : update.reliability === 'medium' ? '🟡' : '🔴';
        const changeIcon = update.changeType === 'added' ? '➕' :
            update.changeType === 'removed' ? '➖' :
                update.changeType === 'modified' ? 'Modified' : 'Moved';
        let output = `#### ${changeIcon} ${update.elementType} (${update.elementId})\n\n`;
        output += `**${update.description}**\n\n`;
        output += `**Action:** ${update.action}\n\n`;
        output += `**Best Locator:** ${reliabilityIcon} \`${update.bestLocator}\` (${update.locatorType})\n\n`;
        if (update.oldLocator && update.oldLocator !== update.bestLocator) {
            output += `**Previous Locator:** \`${update.oldLocator}\`\n\n`;
        }
        output += `**Code Example:**\n\`\`\`javascript\n${update.codeExample}\n\`\`\`\n\n`;
        return output;
    }
    generateCleanLocatorReport(locators) {
        const timestamp = new Date().toLocaleString();
        let report = `# HTML Locator Report\n\n`;
        report += `**Generated:** ${timestamp}\n`;
        report += `**Total Elements:** ${locators.length}\n\n`;
        if (locators.length === 0) {
            report += `## No Elements Found\n\n`;
            report += `No interactive elements found in the HTML. Make sure your HTML contains elements like buttons, inputs, links, etc.\n`;
            return report;
        }
        report += `## Recommended Locators\n\n`;
        // Group by element type
        const groupedLocators = this.groupLocatorsByType(locators);
        for (const [elementType, elements] of Object.entries(groupedLocators)) {
            report += `### ${elementType} Elements (${elements.length})\n\n`;
            elements.forEach(locator => {
                const bestLocator = locator.priority[0];
                const reliabilityIcon = bestLocator?.reliability === 'high' ? '🟢' :
                    bestLocator?.reliability === 'medium' ? '🟡' : '🔴';
                report += `#### ${locator.tagName} (${locator.elementId})\n\n`;
                if (locator.text) {
                    report += `**Text:** "${locator.text}"\n\n`;
                }
                report += `**Best Locator:** ${reliabilityIcon} \`${bestLocator?.locator}\` (${bestLocator?.type})\n\n`;
                report += `**Reason:** ${bestLocator?.reason}\n\n`;
                if (locator.attributes && Object.keys(locator.attributes).length > 0) {
                    report += `**Attributes:**\n`;
                    Object.entries(locator.attributes).forEach(([key, value]) => {
                        report += `- \`${key}="${value}"\`\n`;
                    });
                    report += `\n`;
                }
                report += `**Code Example:**\n\`\`\`javascript\n`;
                report += `await page.locator('${bestLocator?.locator}').click();\n`;
                report += `// or\n`;
                report += `await page.getByRole('${this.getRole(locator.tagName)}').filter({ hasText: '${locator.text || ''}' }).click();\n`;
                report += `\`\`\`\n\n`;
            });
        }
        report += `## 💡 Best Practices\n\n`;
        report += `1. **🟢 High Reliability:** Use ID selectors and data-* attributes\n`;
        report += `2. **🟡 Medium Reliability:** Use name attributes and unique classes\n`;
        report += `3. **🔴 Low Reliability:** Avoid XPath and non-unique selectors\n`;
        report += `4. **Test Locators:** Always test your locators after changes\n`;
        report += `5. **Use Playwright's Built-ins:** Prefer \`getByRole()\`, \`getByText()\`, \`getByLabel()\`\n\n`;
        report += `---\n`;
        report += `*Generated by QA HTML Structure Capture Extension*\n`;
        return report;
    }
    groupLocatorsByType(locators) {
        const grouped = {};
        locators.forEach(locator => {
            const type = this.getElementType(locator.tagName);
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(locator);
        });
        return grouped;
    }
    getElementType(tagName) {
        const typeMap = {
            'button': 'Buttons',
            'input': 'Input Fields',
            'a': 'Links',
            'select': 'Dropdowns',
            'textarea': 'Text Areas',
            'form': 'Forms',
            'h1': 'Headings',
            'h2': 'Headings',
            'h3': 'Headings',
            'h4': 'Headings',
            'h5': 'Headings',
            'h6': 'Headings',
            'div': 'Containers',
            'span': 'Text Elements'
        };
        return typeMap[tagName.toLowerCase()] || 'Other Elements';
    }
}
exports.LocatorGenerator = LocatorGenerator;
//# sourceMappingURL=locatorGenerator.js.map
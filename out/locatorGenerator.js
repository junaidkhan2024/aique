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
            // Create a new document with the locators
            const locatorDocument = await vscode.workspace.openTextDocument({
                content: this.formatLocators(locators),
                language: 'json'
            });
            await vscode.window.showTextDocument(locatorDocument);
            vscode.window.showInformationMessage('Locators generated successfully!');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error generating locators: ${error}`);
        }
    }
    async generateUpdatedLocatorsFromComparison(comparison) {
        const updatedLocators = [];
        for (const diff of comparison.differences) {
            if (diff.newLocators && diff.oldLocators) {
                const updatedLocator = {
                    elementId: diff.elementId,
                    oldLocators: diff.oldLocators,
                    newLocators: diff.newLocators,
                    changeType: diff.type,
                    description: diff.description,
                    recommendations: this.getLocatorRecommendations(diff)
                };
                updatedLocators.push(updatedLocator);
            }
        }
        if (updatedLocators.length === 0) {
            vscode.window.showInformationMessage('No locator changes detected.');
            return;
        }
        // Create document with updated locators
        const locatorDocument = await vscode.workspace.openTextDocument({
            content: this.formatUpdatedLocators(updatedLocators),
            language: 'json'
        });
        await vscode.window.showTextDocument(locatorDocument);
        vscode.window.showInformationMessage(`${updatedLocators.length} updated locators generated!`);
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
}
exports.LocatorGenerator = LocatorGenerator;
//# sourceMappingURL=locatorGenerator.js.map
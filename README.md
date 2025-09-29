# QA HTML Structure Capture & Compare Extension

A powerful Cursor/VS Code extension designed specifically for QA teams to capture HTML structure baselines, compare changes, and automatically generate updated locators for test automation.

## Features

###  Core Functionality
- **HTML Structure Capture**: Save current DOM structure as a baseline for future comparisons
- **Intelligent Comparison**: Detect differences between baseline and current HTML structure
- **Locator Generation**: Automatically generate and prioritize element locators
- **Change Detection**: Identify added, removed, modified, and moved elements
- **Visual Diff Reports**: Beautiful HTML reports showing before/after comparisons

###  QA-Specific Features
- **Locator Stability Analysis**: Rank locators by reliability (ID > data-* > class > xpath)
- **Test-Friendly Recommendations**: Get actionable advice for updating test scripts
- **Multiple Locator Types**: Support for CSS selectors, XPath, and custom locators
- **Export Capabilities**: Generate detailed reports in Markdown, HTML, or JSON formats

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press `F5` in VS Code/Cursor to run the extension in a new window

## Usage

### 1. Capture Baseline
1. Open an HTML file in the editor
2. Right-click in the editor and select "Capture HTML Baseline"
3. Enter a descriptive name for your baseline (e.g., "Homepage v1.0")
4. The extension will analyze and save the HTML structure

### 2. Compare Structure
1. Make changes to your HTML file
2. Right-click and select "Compare HTML Structure"
3. Choose which baseline to compare against
4. Review the comparison results and recommendations

### 3. View Detailed Diff
1. After comparison, click "View Detailed Diff" to see a comprehensive report
2. The report includes:
   - Summary statistics
   - Element-by-element changes
   - Old vs. new locators
   - QA recommendations

### 4. Generate Updated Locators
1. Use "Generate Updated Locators" to get a JSON file with:
   - All element locators ranked by reliability
   - Recommended locators for each element
   - Locator change recommendations

## Extension Commands

| Command | Description |
|---------|-------------|
| `Capture HTML Baseline` | Save current HTML structure as baseline |
| `Compare HTML Structure` | Compare current HTML with saved baseline |
| `View Structure Diff` | Show detailed diff report |
| `Generate Updated Locators` | Generate locator recommendations |

## Locator Priority System

The extension uses a sophisticated priority system to rank locators:

1. **ID Selectors** (Priority 1) - Most reliable
   - `#elementId`
   
2. **Data Attributes** (Priority 2) - Test-friendly
   - `[data-testid="submit-button"]`
   
3. **Name Attributes** (Priority 3) - Good for forms
   - `[name="username"]`
   
4. **Unique Classes** (Priority 4) - Medium reliability
   - `.unique-class`
   
5. **Text Content** (Priority 5) - For interactive elements
   - `text=Submit`
   
6. **XPath** (Priority 6) - Fallback option
   - `//div[@class='container']//button[1]`

## File Structure

```
src/
├── extension.ts              # Main extension entry point
├── htmlCaptureProvider.ts    # HTML capture and storage logic
├── htmlComparator.ts         # Comparison and diff detection
├── locatorGenerator.ts       # Locator generation and ranking
└── diffViewProvider.ts       # UI for displaying diff reports
```

## Configuration

The extension stores data in the global storage directory:
- **Baselines**: Saved HTML structures for comparison
- **Comparisons**: Detailed comparison results
- **Reports**: Exported diff reports

## Troubleshooting

### Common Issues

1. **"No active editor found"**
   - Make sure you have an HTML file open and active

2. **"Current file is not an HTML file"**
   - The extension only works with HTML files
   - Change the file language mode if needed

3. **"No baselines found"**
   - Capture a baseline first before attempting comparison

### Performance Considerations

- Large HTML files (>10MB) may take longer to process
- The extension processes elements sequentially for accuracy
- Consider breaking very large pages into smaller sections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review the extension logs in the Output panel

---

**Made with ❤️ for QA teams who deserve better tools!**

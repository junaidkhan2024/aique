# QA HTML Structure Capture Extension - Testing Guide

## How to Test the Extension

### 1. Setup
1. Open the project in Cursor/VS Code
2. Press `F5` to launch a new Extension Development Host window
3. In the new window, open the `example.html` file from this project

### 2. Test HTML Capture
1. Right-click in the HTML editor
2. Select "Capture HTML Baseline"
3. Enter a name like "Initial Test"
4. Verify success message appears

### 3. Test HTML Comparison
1. Make a small change to the HTML (e.g., change a button text)
2. Right-click and select "Compare HTML Structure"
3. Choose the baseline you just created
4. Review the comparison results

### 4. Test Locator Generation
1. Right-click and select "Generate Updated Locators"
2. A new JSON file should open with all element locators
3. Verify locators are ranked by priority (ID > data-* > class > xpath)

### 5. Test Diff View
1. After running a comparison, click "View Detailed Diff"
2. A detailed HTML report should open in the browser
3. Verify the report shows changes clearly with color coding

## Expected Results

### Baseline Capture
- ✅ Success message: "Baseline '[name]' captured successfully!"
- ✅ Baseline appears in the QA HTML Capture sidebar
- ✅ Baseline contains element count and timestamp

### Structure Comparison
- ✅ Comparison summary shows statistics
- ✅ Changes are categorized (added/removed/modified/moved)
- ✅ Locator changes are identified
- ✅ Recommendations are provided

### Locator Generation
- ✅ JSON output with all elements
- ✅ Locators ranked by reliability (1-8 scale)
- ✅ Priority explanations provided
- ✅ Recommended locator for each element

### Diff Report
- ✅ Professional HTML report with styling
- ✅ Color-coded change types
- ✅ Copy-to-clipboard functionality
- ✅ QA recommendations section

## Test Scenarios

### Scenario 1: Simple Text Change
- Change button text from "Register" to "Sign Up"
- Expected: Modified element detected, locator unchanged

### Scenario 2: Add New Element
- Add a new `<div>` with ID
- Expected: Added element detected, new locators generated

### Scenario 3: Remove Element
- Delete an existing element
- Expected: Removed element detected, recommendation to update tests

### Scenario 4: Attribute Change
- Change an element's class name
- Expected: Modified element detected, locator change identified

## Troubleshooting

### Common Issues
1. **"No active editor found"**
   - Ensure HTML file is open and active
   - Check file language mode is set to HTML

2. **"Current file is not an HTML file"**
   - Change language mode to HTML in bottom-right corner

3. **Extension not loading**
   - Check Output panel for errors
   - Restart Extension Development Host

4. **Comparison fails**
   - Ensure baseline was captured successfully
   - Check that HTML is valid

## Performance Notes
- Large HTML files (>1000 elements) may take 2-3 seconds to process
- Extension stores data in global storage (accessible across sessions)
- Reports are generated as temporary files and can be saved manually

## Success Criteria
✅ All core features work without errors
✅ Generated locators are accurate and prioritized correctly
✅ Diff reports are comprehensive and actionable
✅ Extension integrates smoothly with Cursor/VS Code
✅ QA team can use it to solve real locator maintenance issues

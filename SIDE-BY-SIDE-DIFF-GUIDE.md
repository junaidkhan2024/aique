# 🔄 Side-by-Side HTML Diff - Testing Guide

## ✨ New Feature: Git-Style Side-by-Side Diff!

I've enhanced the extension with a **professional side-by-side diff view** that works exactly like Git diff tools!

## 🚀 How to Test the Side-by-Side Diff

### **Step 1: Restart Extension Development Host**
1. **Stop current Extension Development Host** (close the window)
2. **Go to Run and Debug** (`Ctrl+Shift+D`)
3. **Click "Run Extension"** again
4. **New Extension Development Host window opens**

### **Step 2: Capture Baseline**
1. **Open `example.html`**
2. **Right-click → "Capture HTML Baseline"**
3. **Enter name:** "Original Version"

### **Step 3: Make Changes**
1. **Modify some HTML** in `example.html`:
   - Change button text: `Register` → `Sign Up`
   - Add a new element: `<div id="new-element">New Content</div>`
   - Remove an element (delete a button)

### **Step 4: Compare and View Side-by-Side Diff**
1. **Right-click → "Compare HTML Structure"**
2. **Select your baseline**
3. **Click "View Detailed Diff"** in the results dialog
4. **🎉 Side-by-Side Diff Opens!**

## 🎯 What You'll See in the Side-by-Side Diff

### **Left Panel: Baseline HTML**
- 📷 **Baseline (Original Version)**
- Shows the original HTML structure
- Color-coded for easy comparison

### **Right Panel: Current HTML**
- 🔄 **Current HTML**
- Shows your modified HTML
- Side-by-side comparison with baseline

### **Features:**
- **🔗 Synchronized Scrolling** - Both panels scroll together
- **📄 Export** - Export the diff report
- **⚙️ Generate Locators** - Get updated locators
- **Color-coded Changes:**
  - 🟢 **Green** - Added elements
  - 🔴 **Red** - Removed elements  
  - 🟠 **Orange** - Modified elements
  - 🟣 **Purple** - Moved elements

## 🎨 Visual Features

### **Professional Git-Style Interface:**
- **Split-screen layout** with baseline vs current
- **Line numbers** for easy reference
- **Syntax highlighting** for HTML
- **VS Code theme integration**
- **Responsive design**

### **Interactive Controls:**
- **Toggle synchronized scrolling**
- **Export functionality**
- **Direct locator generation**
- **Element details on hover**

## 🔧 Testing Different Scenarios

### **Scenario 1: Simple Text Change**
- Change: `Register` → `Sign Up`
- **Expected:** Modified element highlighted in orange

### **Scenario 2: Add New Element**
- Add: `<div id="test">New Element</div>`
- **Expected:** New element highlighted in green

### **Scenario 3: Remove Element**
- Delete: `<button>Delete Me</button>`
- **Expected:** Removed element highlighted in red

### **Scenario 4: Attribute Changes**
- Change: `class="old-class"` → `class="new-class"`
- **Expected:** Modified attributes highlighted

## 🎉 Expected Results

When you click **"View Detailed Diff"**, you should see:

✅ **New webview panel opens** in a separate tab  
✅ **Side-by-side layout** with baseline on left, current on right  
✅ **Professional styling** matching VS Code theme  
✅ **Synchronized scrolling** between panels  
✅ **Color-coded changes** (green/red/orange/purple)  
✅ **Interactive controls** (sync, export, generate locators)  
✅ **Summary header** showing change statistics  
✅ **Line-by-line comparison** with line numbers  

## 🚨 Troubleshooting

### **If Side-by-Side Diff Doesn't Open:**
1. **Check Output panel** for errors
2. **Try Command Palette:** `Ctrl+Shift+P` → "View Structure Diff"
3. **Restart Extension Development Host**

### **If Panels Don't Show HTML:**
1. **Make sure baseline was captured successfully**
2. **Check that comparison was completed**
3. **Verify HTML files are valid**

## 🎯 Perfect for QA Teams!

This side-by-side diff provides:
- **Visual comparison** like Git tools
- **Easy identification** of changes
- **Professional presentation** for stakeholders
- **Actionable insights** for test updates
- **Export capabilities** for documentation

The extension now provides a **complete QA workflow**:
1. **Capture baseline** from local files or web pages
2. **Make changes** to HTML
3. **Compare structures** with detailed analysis
4. **View side-by-side diff** for visual comparison
5. **Generate updated locators** for test scripts
6. **Export reports** for documentation

Try it now and see the professional side-by-side diff in action! 🚀

# 🎯 QA Onboarding Wizard - Complete Setup Guide

## ✨ New Feature: Intelligent Project Setup Wizard

I've created a comprehensive onboarding wizard that guides QAs through setting up the extension for their specific project needs!

## 🚀 What the Onboarding Wizard Does

### **Automatic First-Time Setup:**
- **Triggers automatically** when extension is first installed
- **Guides QAs** through project configuration
- **Collects essential details** for optimal extension usage
- **Saves configuration** for future use

### **Smart Configuration Collection:**
1. **Project Details** - Name and basic info
2. **Existing Tests** - Whether they have automation
3. **App Type** - Web, Mobile, Desktop, or API
4. **Environment URLs** - Multiple environments support
5. **Login Credentials** - For apps with authentication
6. **Test Framework** - Selenium, Cypress, Playwright, etc.
7. **Capture Frequency** - Manual, daily, weekly, or on-deploy
8. **Team Size** - For collaboration features

## 🎯 Onboarding Flow

### **Step 1: Welcome & Project Name**
```
🎉 Welcome to QA HTML Structure Capture!

This wizard will help you configure the extension for your project.

What is the name of your project?
[e.g., E-commerce Platform, Banking App]
```

### **Step 2: Existing Test Automation**
```
Do you have existing test automation?
○ $(check) Yes, we have existing test automation
○ $(plus) No, we are starting fresh
```

### **Step 3: Application Type**
```
What type of application are you testing?
○ $(globe) Web Application - Browser-based applications
○ $(device-mobile) Mobile Application - iOS/Android apps with web views
○ $(desktop) Desktop Application - Electron or web-based desktop apps
○ $(api) API Testing - REST/GraphQL APIs with HTML responses
```

### **Step 4: Web App Details (if Web Application)**
```
What is the main URL of your web application?
[Enter main URL]

Enter the URL for your default environment:
[Enter environment URL]

Do you want to add more environments?
○ $(plus) Add another environment
○ $(check) That's all
```

### **Step 5: Login Configuration (if applicable)**
```
Does your application require login?
○ $(check) Yes, the app has login functionality
○ $(x) No, the app is public

What is the login page URL?
[Enter login URL]

Enter test username: [Enter username]
Enter test password: [Enter password]

CSS selector for username field: [#username]
CSS selector for password field: [#password]
CSS selector for submit button: [button[type="submit"]]
```

### **Step 6: Test Framework (if existing tests)**
```
What test automation framework do you use?
○ $(code) Selenium WebDriver - Java, Python, C#, JavaScript
○ $(code) Cypress - JavaScript/TypeScript
○ $(code) Playwright - JavaScript, Python, C#
○ $(code) TestCafe - JavaScript/TypeScript
○ $(code) WebdriverIO - JavaScript/TypeScript
○ $(code) Protractor - Angular testing
○ $(code) Other - Custom framework
```

### **Step 7: Capture Frequency**
```
How often should baselines be captured?
○ $(hand) Manual only - I will capture baselines manually
○ $(calendar) Daily - Capture baselines daily
○ $(calendar) Weekly - Capture baselines weekly
○ $(rocket) On deployment - Capture when app is deployed
```

### **Step 8: Team Size**
```
How many people are in your QA team?
○ $(person) Just me
○ $(organization) 2-5 people
○ $(organization) 6-10 people
○ $(organization) 11-20 people
○ $(organization) 20+ people
```

## 🎉 Completion & Configuration

### **Setup Complete Message:**
```
🎉 Setup Complete!

Your project "E-commerce Platform" is now configured for QA HTML Structure Capture.

Configuration Summary:
• App Type: web
• Existing Tests: Yes
• Environments: 3
• Capture Frequency: manual

Next Steps:
1. Open your application in a browser
2. Use "Capture HTML Baseline" to create your first baseline
3. Make changes to your app
4. Use "Compare HTML Structure" to see differences
5. Generate updated locators for your tests

Happy testing! 🚀
```

## 🔧 New Commands Added

### **Command Palette Commands:**
- **`QA HTML Capture: Reconfigure Project`** - Run setup wizard again
- **`QA HTML Capture: View Project Settings`** - View current configuration

### **Project Settings View:**
```
📋 Project Configuration

Project Name: E-commerce Platform
App Type: web
Existing Tests: Yes
Test Framework: cypress
Capture Frequency: manual
Team Size: 5

Main URL: https://my-ecommerce.com

Environments:
• Default: https://prod.my-ecommerce.com (Default)
• Development: https://dev.my-ecommerce.com
• Staging: https://staging.my-ecommerce.com

Login Configuration:
• URL: https://my-ecommerce.com/login
• Username: test@example.com
• Selectors: usernameSelector: #email, passwordSelector: #password, submitSelector: #login-btn

Would you like to reconfigure these settings?
[Reconfigure] [Reset All] [Close]
```

## 🚀 How to Test the Onboarding Wizard

### **Step 1: Fresh Installation Test**
1. **Reset extension state** (or install fresh)
2. **Activate extension** in Extension Development Host
3. **Wait 2 seconds** - wizard should appear automatically
4. **Follow the setup flow** step by step

### **Step 2: Test Different Scenarios**
1. **Web app with login** - Test full web configuration
2. **Mobile app** - Test mobile app configuration
3. **No existing tests** - Test fresh start scenario
4. **Multiple environments** - Test environment configuration

### **Step 3: Test Commands**
1. **`Ctrl+Shift+P`** → "QA HTML Capture: View Project Settings"
2. **`Ctrl+Shift+P`** → "QA HTML Capture: Reconfigure Project"
3. **Test reset functionality**

## 🎯 Benefits for QA Teams

### **Streamlined Setup:**
- **No manual configuration** required
- **Guided process** for all project types
- **Comprehensive coverage** of common scenarios
- **Saves time** on initial setup

### **Project-Specific Configuration:**
- **Tailored experience** based on app type
- **Environment management** for multiple deployments
- **Login automation** for authenticated apps
- **Framework integration** for existing test suites

### **Professional Experience:**
- **Clean, intuitive interface**
- **Progress indication** throughout setup
- **Validation** of user inputs
- **Helpful descriptions** for each option

## 🚨 Troubleshooting

### **If Wizard Doesn't Appear:**
1. **Check extension activation** in Output panel
2. **Wait 2 seconds** after extension loads
3. **Try manual trigger:** `Ctrl+Shift+P` → "Reconfigure Project"

### **If Configuration is Lost:**
1. **Use "Reconfigure Project"** command
2. **Check VS Code settings** for stored configuration
3. **Reset all settings** if needed

### **If Validation Fails:**
1. **Check URL format** (must include http:// or https://)
2. **Verify required fields** are filled
3. **Try different values** if selectors don't work

## 🎉 Success Indicators

You'll know it's working when:
- ✅ **Wizard appears automatically** on first activation
- ✅ **All steps complete** successfully
- ✅ **Configuration is saved** and accessible
- ✅ **Commands work** from Command Palette
- ✅ **Settings view** shows complete configuration
- ✅ **Professional experience** throughout setup

The extension now provides a **complete onboarding experience** that makes it easy for QA teams to get started with HTML structure capture and comparison! 🚀

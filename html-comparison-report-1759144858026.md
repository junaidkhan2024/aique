# HTML Structure Comparison Report

**Baseline:** Base1
**Comparison Date:** 9/29/2025, 4:50:56 PM

## Summary

- Total Elements: 71
- Added Elements: 7
- Removed Elements: 7
- Modified Elements: 14
- Moved Elements: 0
- Locator Changes: 8

## Detailed Changes

### Modified Elements

- **html**: Text changed: "Sample HTML for QA Testing
    
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .success { background: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px; }
    


    
        
            QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service
            
        
    

    
        // Sample JavaScript for testing
        document.getElementById('registration-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            
            if (username && email) {
                document.getElementById('users-container').innerHTML += 
                    `<div class="user-item" data-user-id="${Date.now()}">
                        <h3>${username}</h3>
                        <p>${email}</p>
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>`;
                
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'success';
                successDiv.textContent = 'User registered successfully!';
                document.getElementById('registration-form').appendChild(successDiv);
                
                // Clear form
                this.reset();
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successDiv.remove();
                }, 3000);
            }
        });

        // Add event listeners for edit/delete buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) {
                e.target.closest('.user-item').remove();
            }
        });" → "Sample HTML for QA Testing
    
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .success { background: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px; }
    


    
        
            QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service
            
        
    

    
        // Sample JavaScript for testing
        document.getElementById('registration-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            
            if (username && email) {
                document.getElementById('users-container').innerHTML += 
                    `<div class="user-item" data-user-id="${Date.now()}">
                        <h3>${username}</h3>
                        <p>${email}</p>
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>`;
                
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'success';
                successDiv.textContent = 'User registered successfully!';
                document.getElementById('registration-form').appendChild(successDiv);
                
                // Clear form
                this.reset();
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successDiv.remove();
                }, 3000);
            }
        });

        // Add event listeners for edit/delete buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) {
                e.target.closest('.user-item').remove();
            }
        });"
  - Old Locators: 
  - New Locators: 

- **body**: Text changed: "QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service
            
        
    

    
        // Sample JavaScript for testing
        document.getElementById('registration-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            
            if (username && email) {
                document.getElementById('users-container').innerHTML += 
                    `<div class="user-item" data-user-id="${Date.now()}">
                        <h3>${username}</h3>
                        <p>${email}</p>
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>`;
                
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'success';
                successDiv.textContent = 'User registered successfully!';
                document.getElementById('registration-form').appendChild(successDiv);
                
                // Clear form
                this.reset();
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successDiv.remove();
                }, 3000);
            }
        });

        // Add event listeners for edit/delete buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) {
                e.target.closest('.user-item').remove();
            }
        });" → "QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service
            
        
    

    
        // Sample JavaScript for testing
        document.getElementById('registration-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            
            if (username && email) {
                document.getElementById('users-container').innerHTML += 
                    `<div class="user-item" data-user-id="${Date.now()}">
                        <h3>${username}</h3>
                        <p>${email}</p>
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>`;
                
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'success';
                successDiv.textContent = 'User registered successfully!';
                document.getElementById('registration-form').appendChild(successDiv);
                
                // Clear form
                this.reset();
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successDiv.remove();
                }, 3000);
            }
        });

        // Add event listeners for edit/delete buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) {
                e.target.closest('.user-item').remove();
            }
        });"
  - Old Locators: 
  - New Locators: 

- **div**: Text changed: "QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service" → "QA Testing Sample Page
            This is a sample HTML page for testing the QA HTML Structure Capture extension.
        

        
            
                User Registration Form
                
                    
                        Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact
                    
                
            
        

        
            © 2024 QA Testing Sample. All rights reserved.
            
                Privacy Policy
                Terms of Service"
  - Old Locators: .container
  - New Locators: .container

- **main**: Text changed: "User Registration Form
                
                    
                        Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact" → "User Registration Form
                
                    
                        Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset
                
            

            
                Registered Users
                
                    
                        John Doe
                        john.doe@example.com
                        Edit
                        Delete
                    
                    
                        Jane Smith
                        jane.smith@example.com
                        Edit
                        Delete
                    
                
            

            
                Navigation
                
                    
                        Home
                        About
                        Services
                        Contact"
  - Old Locators: 
  - New Locators: 

- **section**: Text changed: "User Registration Form
                
                    
                        Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset" → "User Registration Form
                
                    
                        Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset"
  - Old Locators: #user-form
  - New Locators: #user-form

- **form**: Text changed: "Username:
                        
                    

                    
                        Email:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset" → "Email ID:
                        
                    

                    
                        Password:
                        
                    

                    
                        Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia
                        
                    

                    
                        Confirm Email ID:
                        
                    

                    
                        Bio:
                        
                    

                    
                        
                            
                            I agree to the terms and conditions
                        
                    

                    Register
                    Reset"
  - Old Locators: #registration-form, [data-testid="user-registration"]
  - New Locators: #registration-form, [data-testid="user-registration"]

- **div**: Text changed: "Username:" → "Email ID:"
  - Old Locators: .form-group, text=Username:
  - New Locators: .form-group, text=Email ID:

- **label**: Modified attributes: for; Text changed: "Username:" → "Email ID:"
  - Old Locators: text=Username:
  - New Locators: text=Email ID:

- **div**: Text changed: "Email:" → "Password:"
  - Old Locators: .form-group, text=Email:
  - New Locators: .form-group, text=Password:

- **label**: Modified attributes: for; Text changed: "Email:" → "Password:"
  - Old Locators: text=Email:
  - New Locators: text=Password:

- **div**: Text changed: "Password:" → "Country:
                        
                            Select Country
                            United States
                            United Kingdom
                            Canada
                            Australia"
  - Old Locators: .form-group, text=Password:
  - New Locators: .form-group

- **label**: Modified attributes: for; Text changed: "Password:" → "Country:"
  - Old Locators: text=Password:
  - New Locators: text=Country:

- **option**: Modified attributes: value; Text changed: "Select Country" → "Canada"; XPath changed: //*[@id='country']/option[1] → //*[@id='country']/option[4]
  - Old Locators: text=Select Country
  - New Locators: text=Canada

- **option**: Modified attributes: value; Text changed: "United States" → "Australia"; XPath changed: //*[@id='country']/option[2] → //*[@id='country']/option[5]
  - Old Locators: text=United States
  - New Locators: text=Australia

### Added Elements

- **emailid**: New element: input

- **element_24_option**: New element: option

- **element_25_option**: New element: option

- **element_26_option**: New element: option

- **element_29_div**: New element: div

- **element_30_label**: New element: label

- **confirmemailid**: New element: input

### Removed Elements

- **username**: Removed element: input

- **email**: Removed element: input

- **element_24_div**: Removed element: div

- **element_25_label**: Removed element: label

- **element_29_option**: Removed element: option

- **element_30_option**: Removed element: option

- **element_31_option**: Removed element: option


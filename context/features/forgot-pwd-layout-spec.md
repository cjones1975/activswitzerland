# Forgot password page 

## Overview

Forgot password UI layout. Use the screenshot referenced below for how it should look.

## Requirements

- Route user to component @core/features/auth/forgot-password when the user clicks on the 'forgot password' link on the login page.
- The component should not be part of auth-layout.
- It must have the same hero design as auth-layout but the icon in the circle should be <i class="fa-light fa-key"></i> and the text below it should be 'Enter you email and we will send you a link to reset your password.'
- Add reactive form with email formControl. Include email validation + required for the email control
- Add 'Email address' label and textbox wire up to formControl.
- Email textbox should be filled #f2f5f7 and contain an email icon <i class="fa-sharp fa-light fa-envelope"></i> as well as placeholder: 'your@email.com'
- Add a 'Reset Passwprd' button with background #0c2340
- below the button add a 'Back to log in' link that routes back to the login page.


## References

- @context/screenshots/Request_password_reset.png
- @context/project-overview.md
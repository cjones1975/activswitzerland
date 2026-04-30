# Register page 

## Overview

Register (create account) page UI layout. Use the screenshot referenced below for how it should look.

## Requirements

- Add reactive form with the following formControls:
firstName (required validation)
lastName (required validation)
country (required validation)
email (required & email format validation)
password (required validation, min 8 characters)
passwordCheck (validation: must match password)
emailUpdates
- Use primeng components:
firstName: InputTextModule (label: Firstname)
lastName: InputTextModule  (label: Lastname)
country: SelectModule with filter & checkmark (label: Country)
email: InputTextModule (label: Email)
password: InputTextModule (label: Password)
passwordCheck: InputTextModule (label: Verify password)
emailUpdate: ToggleSwitchModule (label: Receive newsletter)
- Add a background fill to each component of #f2f5f7
- Email textbox should contain an email icon <i class="fa-sharp fa-light fa-envelope"></i> as well as placeholder: 'your@email.com'
- Password should contain a padlock icon <i class="fa-light fa-lock"></i> as well as placeholder: 'Your password'
- Add a Create account button with background #0c2340


## References

- @context/screenshots/Register_page
- @context/project-overview.md
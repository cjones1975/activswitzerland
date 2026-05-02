# Forgot password page 

## Overview

Connect with backend to to verifiy user email and send email link if verfified.

## Requirements

- Write an async method in @core/services/auth.ts service that will call an http post request to http://localhost:3000/api/v1/auth/forgotPassword passing the email in the body.
- Add any error handling that may be required
- Trigger a success or error toast using the toast service in @core/services/toast.ts
- The success toast message should be: 'We have sent you a link to your email address to reset your password.'
- If the api status code is 500, the error toast message should be: 'No user with email provided was found.'
- Any other toast error message should be: 'Opps somthing went wrong. Please try again.'



## References

- @context/project-overview.md
# Login page 

## Overview

Connect with backend to log in user and retrieve jwt token

## Requirements

- Write an async method in @core/services/auth.ts service that will call an http post request to http://localhost:3000/api/v1/auth/login passing the login credentials in the body.
- Add any error handling that may be required
- Keep isLogged and the returned jwt token somewhere in state
- Trigger a success of error toast using the toast service in @core/services/toast.ts
- Create an http interceptor called token that will add the token as a bearer token to any other http calls that will require it.


## References

- @context/project-overview.md
# Register page 

## Overview

Connect with backend to create a user account

## Requirements

- Create an interface called 'Country' in @models with the attributes:
 alpha2Code (string)
 shortName (string)
- Import the country interface into the @core/services/referenceData service
- Write an async method in the service that will call and http get request to http://localhost:3000/api/v1/country/countries and map the result to the model before returning it.
- Write an async method in @core/services/auth.ts service that will call an http post request to http://localhost:3000/api/v1/auth/register passing the create account parameters in the body:
firstName (string)
lastName (string)
country (string), shortName expected
email (string)
password (string)
emailUpdates (boolean)
- Add any error handling that may be required
- Trigger a success of error toast using the toast service in @core/services/toast.ts
- On succesfully registration a token will be returned. Keep isLogged and the returned jwt token somewhere in state. Redirect user to homepage.


## References

- @context/project-overview.md
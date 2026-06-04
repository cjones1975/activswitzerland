# Weather component

## Overview

Display weather page and weather card on destination page. Reference screenshot for eample of weather page

## Requirements
- Create a service called weather.ts in @frontend/src/app/shared/services
- Create a getWeather method that accepts lat and lon as parameters. This method must be an http get to http://localhost:3000/api/v1/weather. An example of this is http://localhost:3000/api/v1/weather?lat=46.94767255269635&lon=7.447635079345375, which would return the @context/data/weather.json response below. Use the @frontend/src/app/models/weather.ts model for the data.
- Setup @frontend/src/app/shared/weather component as a primeng drawer with drawer-host. This weather component must take in as input the destination latitude and longitude coordinates. These will be used to call the weather service on ngInit.
- create the weather component interface using the screenshot and weather.json as references. Ensure the design fits in with the app. 
- From the destination-detail page a call to the weather service will be required to build out the weather card under the weather-box class. This card must show as title: 'Today's weather' including weather description, icon and temperature. Add a link '7 day forecast' to the card which when clicked will open the close the destination drawer and open the weather drawer. 
- The weather drawer must have a 'Back to destination' link as displayed in the screenshot to open the destination drawer and close the weather drawer.


## Notes
- Not everthing in the screenshot may be achievable but use your discretion to provide a good looking 7 day weather report

## References

- @context/screenshots/weather.png
- @context/data/weather.json
- @context/project-overview.md
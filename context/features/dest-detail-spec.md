# Destinations detail Page and map page

## Overview

Display a side drawer with destination data and a map page with attraction pins. Refer to screenshot destination_detail.png

## Requirements

- setup destination-layout to display the map component as a full cover of the page. I want the coordinates of the destination to be passed to the map component so the map can zoom on them.
- setup destination-detail as a right side expanding drawer. Make use of the drawer-host component and the drawer.ts service for this. On desktop, the drawer must expand by 600px. On Mobile, it must expand by 100% - 20px. 
- the destination-detail page must contain the following items coming from the myswitzerland api call:
 - destination name as title
 - destination images displayed in a basic primeng carousel control. It must show 1 image at a time. Give the carousel images a border radius of 10px
 - Below the carousel there must be a link with the text 'Switzerland Tourism' to the api field links - self. This link section should be attached to the bottom of the carousel without any padding.
 - Below the link add the destination abtsract description
 - Below the description add a grid section with on the right side a weather box and on the left side a 'Plan a Trip' button. 

## Notes
The weather box will take weather from an api. This will be done later.
The 'Plan a trip' event will be done later
The screenshot destination_detail.png also has an attractions section. This will be done later.

## References

- @context/screenshots/destination_detail.png
- @context/project-overview.md
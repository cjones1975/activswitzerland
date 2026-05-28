# Destinations vertical view Page and map page

## Overview

Display destinations as a vertical scollable list, depending on screen size.
Setup maplibre-gl page. Refer to screenshot vertical_destinations.png

## Requirements

- install "maplibre-gl": "^4.7.1"
- Create map container on @shared/map. This map will be used for different map use cases. For this feature, we will be getting all city destinations with their respective coordinates. The city locations must be displayed on the map by a flag icon: <i class="fa-regular fa-flag"></i>
- The map container must take in an array of coordinates and zoom position as inputs, including any other inputs required for the use case.
- Add the map component to destination-vertical-list and place it within a hero section at the top of the page. It must have a maximum height of 300px in mobile view
- destination-vertical-list must be able to take input parameters of Title, Sub Title and Facet. For example:
cardTitle: 'City'
title: 'All Cities'
subTitle: '# destinations', # refers to number of records
facet: placetypes:cities
- The destination-vertical-list page must call the destination service, getDestinations method passing:
language: select app language
page: 0
hitsPerPage: 50
facets: facet input
expand: false
- Display the input title and subTitle above the cards as shown in the screenshot.
- Display the get request results as cards. these must be in a vertical scrollable strip. Each card must have the api result data.photo attribute as the background to the card, full cover. In the top left hand corner of the card place the input cartTitle in white on a transparent backgound. Place the data.name attribute as the card text. below the data.name attribute, display data.abstract. Truncate the data.abstract text with a ... if it does not fit on the page.
- Add translation where required

## Notes


## References

- @context/screenshots/horizontal_destinations.png
- @context/project-overview.md
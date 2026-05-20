# Destinations Page

## Overview

Display destinations as a horizontal scollable list, depending on screen size. Refer to screenshot horizontal_destinations.png

## Requirements

- Use @fontend/src/app/shell/destination-layout has the container for the destination-horizontal-list on the homepage
- destination-horizontal-list must be able to take input parameters of Title, Sub Title and Facet. For example:
cardTitle: 'City'
title: 'City Breaks'
subTitle: 'Discover Switzerland one city at a time'
facet: placetypes:cities
- Give the destination-layout a background color of #f8fafc and any content within it must be in a container class
- Create a destinations.ts service in @fontend/src/app/shared/services
- Write an http get request to http://localhost:3000/api/v1/myswitzerland/destinations?language=en&page=0&hitsPerPage=50&facets=placetypes:cities&expand=false&translate=true&stripHtml=false&top=false. language, page, hitsPerPage, facts and expand must be parameters that can passed to the method.
- The destination-horizontal-list page must call the service, passing:
language: select app language
page: 0
hitsPerPage: 10
facets: facet input 
expand: false
- Display the input title and subTitle above the cards as shown in the screenshot.
- Display the get request results as cards. In mobile view, these must be as a horizontal scrollable strip. Each card must have the api result data.photo attribute as the background to the card, full cover. In the top left hand corner of the card place the input cartTitle in white on a transparent backgound. Place the data.name attribute as the card text.

## Notes


## References

- @context/screenshots/horizontal_destinations.png
- @context/project-overview.md
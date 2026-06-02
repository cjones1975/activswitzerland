# Attractions list Page and map page

## Overview

Display card list of attractions per placeId. Refer to screenshot destination_detail.png

## Requirements

- Create attractions service in @shared/services. In the service build a getTopAttractions request to http://localhost:3000/api/v1/myswitzerland/attractions taking in the following parameters:
    - language
    - page
    - hitsPerPage
    - placeId
    - expand
    - translate
    - stripHtml
    - top
This parameters must be added to the url as query parameters
- In @features/attractions/attraction-vertical-list.ts, call getTopAttraction on ngInit. It must pass:
    - language: (app language)
    - page: 0
    - hitsPerPage: 50
    - placeId: destinationId as component input parameter
    - expand: false
    - translate: true
    - stripHtml: false
    - top: true
- In @features/attractions/attraction-vertical-list.html, list the returned attractions as cards with a container class. Above the cards add the title: "Top attractions". To the right of the title add a link called "See all attractions".
- Implement primeng skeleton for card loading
- Implement translation where required.
- The cards must be structured so that the entire left side of the card is covered by the photo image. The right side of the card must have the name as title and abstact as description. This can be turncated and ended with ... if necessary.
- The placement of the attractions must display on the map with the icon <i class="fa-solid fa-circle-location-arrow"></i> in #1a2f4a. Use the record coordinates.
- Add the attractions-vertical-list component to the drawer on destination-detail component, below the content class. Pass the destinationId as input to the attractions component.

## Notes


## References

- @context/screenshots/destination_detail.png
- @context/project-overview.md
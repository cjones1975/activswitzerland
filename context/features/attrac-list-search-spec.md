# Attractions list search Page and map page

## Overview

Allow user to search for attractions on the attractions-vertical-list component

## Requirements

- Add a search section to the top of the @frontend/src/app/attractions/attraction-vertical-list with a primeng inputText component and <i class="fa-regular fa-magnifying-glass"></i> icon
- create a search attractions http get method in the attractions.ts service. This method need to call: http://localhost:3000/api/v1/myswitzerland/searchattractions, passing the following parameters
    - language: (app language)
    - page: 0
    - search: input value of the search bar
    - hitsPerPage: 50
    - placeId: destinationId as component input parameter
    - expand: false
    - translate: true
    - stripHtml: false
    - top: true
- Step 1: first search within the existing list of all-attraction records.
- Step 2: If no records are found, then run the above api query
- Step 3: If still no records are found, display the text: 'I'm sorry, we couldn't find any attractions matching your search query. Please try another keyword'.
- Step 4: If search records are found, update the list of attractions with the records returned.
- Under the search results, add a 'Back to all attractions', which will retieve all attractions for the destination
- Found search records must route to the attraction-detail page.

## Notes


## References

- @context/project-overview.md
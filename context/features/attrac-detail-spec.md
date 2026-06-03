# Attractions detail and map page

## Overview

Display attraction detail page. Refer to screenshot attraction_detail.png

## Requirements

- Build on the existing code implemented in @frontend/src/app/features/attractions/attraction-detail.ts extract the attraction data api response fields for the following interface elements:
- Title: field 'name'
- Abstract text: field 'abstract'. 
- Primeng galleria module: field 'image' array and the 'url' field.
- Below the galleria, add the back link 'Switzerland Tourism' as was done for the @destination-detail page. Field 'url'
- The following elements all need to be checked for existing field name before they are added to the interface. If no field name is found, then it is ignored.
- Description: field 'description'
- If part of the classification array: field 'name' value 'neededtime'
    - Display:
    Title: Required time for this activity (requires translation)
    value: values.title,
- If part of the classification array: field 'name' value 'wheelchairaccessibleclassifications'
    - Display:
    Title: Wheelchair accessible (requires translation)
    value: values.title, 
- If field 'name' value 'availableLanguage'
    - Display:
    Title: Spoken languages (requires translation)
    value: alternateName - These are given as 2 letter codes and need to be translated into full text, i.e. en = English, de = German, fr = French, it = Italien
- If field 'event.audience.audienceType' = 'Groups' then if field 'minimumAttendeeCapacity' and 'maximumAttendeeCapacity' then
    - Display:
    Title: Group size (requires translation)
    Value: minimum: minimumAttendeeCapacity, maximum: maximumAttendeeCapacity
- If field 'price' then (requires translation)
    - Display: 
    Title: Price information
    value: minPrice priceCurrency
- If field 'address' not [] then display:
    address.name
    address.streetAddress, address.postalCode, address.addressLocality
    address.telephone if exists
    address.email if exits
    address.url if exists, whith _blank link to the url
- On the map all exisiting attraction markers must remain. Highlight the selected attraction marker in red with a slightly larger font.

## Notes
- @content/data/attraction.json provides an example of an attraction. No all attractions contain the same classification fields, group, language and price elements

## References

- @context/screenshots/attraction_detail.png
- @context/project-overview.md
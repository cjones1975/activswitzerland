# Profile page 

## Overview

Profile page UI layout. Use the screenshot referenced below for how it should look.

## Requirements

- It must have the same hero design as auth-layout but the icon in the circle should display the Firtname Lastname initials of the user and the text below it 
should be the users name in bold and below that the user email.
- Below the hero, there should be 3 cards side by side. Cards should be white with a shadow.
 Card 1: icon <i class="fa-light fa-bookmark"></i> (--navy-900), number of trips, text: 'Saved trips'
 Card 2: icon <i class="fa-light fa-comment"></i> ( --color-green), number of reviews, text: 'Reviews written'
 Card 3: icon <i class="fa-light fa-thumbs-up"></i> (--amber-700), number of review likes, text: 'Reviews liked'
- Below the cards display the user details in a table with on the left the title: 'Profile details' and on the right <i class="fa-light fa-gear"></i> with the text edit. The table should display in text:
Firstname <i class="fa-sharp fa-light fa-circle-user"></i>
Lastname <i class="fa-sharp fa-light fa-circle-user"></i>
Country <i class="fa-light fa-flag"></i>
Email address <i class="fa-light fa-envelope"></i>
News Letter <i class="fa-light fa-bell"></i>
- When the edit link is clicked, the user details should display as input texts, select list (for country) and switch button (news letter). The edit link text should show 'Save' and the icon <i class="fa-light fa-floppy-disk"></i>
- Below the profile details section should be displayed a 'Sign out' button
- Apply translation where applicable

## Notes
- There will be a getMe api method that will retrieve user details as well as user linked information. As part of this layout, this data can be hardcoded.

## References

- @context/screenshots/Profile_page.png
- @context/project-overview.md
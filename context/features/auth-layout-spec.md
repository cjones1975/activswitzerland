# Auth Layout page

## Overview

Auth layout and text. Use the screenshot referenced below for how it should look.

## Requirements

- auth-layout should be a different layout to main-layout and will have it's own children.
- The layout page should have a background color of #d4d6d9
- Hero section with gradient blue background as depicted in the screenshot.
- Centered in the hero section, place the icon <i class="fa-light fa-lock"></i> featured in a circle with the background color #b45309
- Below the icon in bold letters place the centered text: "Welcome Back". Below the welcome text in smaller letters and not in bold, place the centered text:
"Log in to access your saved trips and reviews".
- Below the hero but overlapping 15px over the bottom of it, place a container section with rounded borders, shadow and white background as shown in the image.
At the top of this section should be placed two primeng buttons side by side on a light gray area (#d4d6d9) with rounded borders.
1. Login (active by default. White in color and slightly raised)
2. Create account (same color as light gray background and flat)
- Below the button will be loaded the login or register component depending on which button is clicked. These will be designed later.
- Below the container section, place a title text in bold and black:
"Why create an account?".
- Below the title place 3 card components one above the other (height 100px, Spacing 5 px, background color white). 
card 1: <i class="fa-light fa-bookmark"></i> icon, text: Save trip ideas
card 2: <i class="fa-light fa-star"></i> icon, text: Leave and read community reveiws
card 3: <i class="fa-light fa-sparkles"></i> icon, text: Let AI build an itineraray.


## References

- @context/screenshots/login_page.png
- @context/project-overview.md
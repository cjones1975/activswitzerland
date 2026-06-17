# Trip Planner Fixes Spec

## Overview

Polish and UX improvements for the trip planner wizard, covering layout fixes, navigation logic, connections form, and connection card display.

---

## 1. Trip Planner Title Layout

The 'Plan a Trip' title text must appear on the **same row** as the icon, not below it. Use flexbox (`align-items: center`) on the header container to achieve this.

---

## 2. Trip Type Selected Button Color

~~Removed — PrimeNG 21 design-token theming prevents reliable override; reverted to default.~~

---

## 3. 'Add Things to Do' Link Prominence

The 'Add things to do' link must be styled to draw the user's attention. Suggested treatment:
- Use a solid or outlined button style rather than a plain text link.
- Apply a distinct color (e.g., primary accent) with sufficient contrast.
- Add an icon (e.g., `pi pi-plus`) to the left of the label.
- Ensure adequate padding so it feels tappable on mobile.

---

## 4. Hide Back Button on First Step

On **step 1** of the wizard, the Back button must not be rendered. Only show the Back button when `currentStep > 1` (or equivalent first-step check in the component).

---

## 5. Linear Step Progression

Steps must be **strictly linear**. The Next button must be disabled (and not navigable) until all required fields for the current step are valid. Implement a per-step validation guard before advancing. The user cannot skip ahead or access a later step directly.

---

## 6. 'Save Your Trip' Step — Side-by-Side Buttons

On the final 'Save your trip' step, the **'View Trip'** and **'Save Trip'** buttons must be placed **side by side**.

- On mobile (< 768 px): each button takes `width: 100%`; the container uses `flex-direction: row` with a `gap` of `10px`.
- On wider screens: buttons share the row at their natural or equal widths.

---

## 7. Remove Float Label from Connections Form

Remove the `floatLabel` wrapper/attribute from all fields in the connections form. Use standard static labels instead.

---

## 8. Connections Time — p-datepicker (Time Only)

Replace the current time input on the connections form with `p-datepicker` configured for time-only input:

```html
<p-datepicker [(ngModel)]="departureTime" [timeOnly]="true" />
```

The user must be able to **type the time directly** into the field as well as use the picker UI.

---

## 9. Remove 'Find Connections' Button

Remove the dedicated 'Find Connections' button from the connections step. Instead, the **Next** button on that step must:
1. Trigger the connection search (call the find-connections logic).
2. Navigate to the next step (Choose a Connection) once results are returned.

If the search fails or returns no results, display an inline error and remain on the current step.

---

## 10. 'Choose a Connection' Page — Full-Height Results

On the 'Choose a Connection' step, the list of found connections must fill the **entire available screen height**, with the **Back and Next buttons always visible** at the bottom (fixed or sticky footer within the wizard layout). The connections list must scroll internally if the content overflows.

---

## 11. Connection Card — Start/End Time on Same Row

On the connection card, display the departure and arrival times on a **single row** in the format:

```
03:36  →  04:59
```

Use an arrow glyph (`→` or `pi pi-arrow-right`) between the two times. Full route detail will be added in a future feature.

---

## Out of Scope

- Full route expansion on the connection card (future feature).
- Changes to the MySwitzerland API or caching layer.

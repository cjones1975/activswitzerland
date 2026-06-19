# Misc Fixes 1 Spec

## Overview

A collection of UI/UX fixes spanning the trip planner drawer, map tooltips, footer navigation, and input layout.

---


## 1. Trip Planner — Hide 'Round Trip' Button for Rail Trips

When the user selects **Rail** as the trip type, the **Round Trip** toggle/button must be hidden. It should only be visible for non-rail trip types (e.g., car, cycling, walking).

---

## 2. Trip Planner — Defer Route Display Until Saved or Viewed

The route must **not** be calculated or rendered on the map until the user explicitly clicks either **'Save Trip'** or **'View Trip'**. No route polyline, markers, or intermediate map updates should appear during wizard step navigation or form editing. This includes:

- No route drawn while the user is entering stops.
- No route drawn when the trip type or dates change.
- Route display is triggered only on 'Save Trip' or 'View Trip' action.

---

## 3. Trip Planner — Map Attraction Tooltips Linkable to Attraction Drawer

Attraction tooltips rendered on the trip planner map must be clickable and must open the **attraction drawer** for the tapped attraction. Follow the same interaction pattern used in the `destination-detail` component for map-placed attractions.

Additionally, fix tooltip sizing: some tooltips do not expand to the full width of their text content. Either:
- Ensure the tooltip container grows to fit its text on a single line, **or**
- Allow the text to wrap and give the tooltip sufficient height to display all content.

---

## 4. Trip Planner — Inline Remove & Drag Icons Inside Stop Input

Use the PrimeNG `InputText` template feature to place the **remove** icon and the **drag-drop** handle icon inside the input text box itself. Once the icons are inline, the `InputText` must take **full width** of its container.

---

## 5. Footer Nav — Visible on Desktop, Buttons Hidden

On desktop viewports the `footer-nav` component must be **visible** (not hidden), but its navigation buttons must be **hidden**. The component frame/background remains present on desktop; only the button elements are suppressed via CSS at the desktop breakpoint.

---

## Out of Scope

- Changes to the MySwitzerland API or route-calculation service.
- Redesign of the attraction drawer itself.
- New footer content for desktop.

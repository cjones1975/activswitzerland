# TheOakCellar Project Overview

Mobile-first travel discovery and planning app focused on helping users find the best experiences in Switzerland based on where they are starting from.

---

## Problem

Planning trips in Switzerland is fragmented:

- Users know where they are starting from, but not what is worth doing nearby
- Attractions, transport, weather, and hotels are spread across multiple platforms
- Generic map/search tools require too much manual effort
- Tourists want quick, high-quality day trip ideas
- Locals want spontaneous nearby experiences

This leads to:

- decision fatigue
- poor trip choices
- missed opportunities
- too much switching between apps

The app helps users discover, compare, and plan Swiss trips from one place.

---

## Differentiation

Compared to generic travel tools:

- Location + radius based discovery
- Smart suggestions before raw search results
- Attraction pages connected to transport, weather, and hotels
- Built specifically for Switzerland
- Mobile-first planning for day trips and short stays

---

## 🧑‍💻 Users

| Persona | Needs 															|
|------------------ |-----------------------------------------------------	|
| Tourists			| Easy trip planning, attractions, hotels, transport	|
| Locals  			| Nearby ideas, day trips, spontaneous outings 			|
| Couples/Families  | Clear planning, practical logistics					|
| Weekend Explorers | Scenic escapes within a chosen radius					|

---

## Core Features

### Navigation Menu
- Top primeng 

### Homepage

- Hero image and welcoming CTA
- Popular destinations carousel
- Fast route into planning flow

### Smart Explore

- Select start point on Switzerland map
- Set travel radius
- Get best experiences within range
- Toggle list view / map view

### Attraction Discovery

- Pins on map for attractions
- Preview tooltips
- Attraction categories and summaries

### Attraction Detail Page

- Images and description
- Best season / duration / region
- Why visit section
- Nearby highlights
- Plan this trip CTA

### Planning Layer

- Transport lookup n- 7-day weather
- Nearby hotels
- Mini itinerary timeline
- Optional overnight stay suggestions

### Account Features

- Save trips
- User reviews
- Personal preferences

---

## Smart Suggestions Logic (phase based)

### Account Features

- Start location
- Radius
- Weather
- Transport preference
- Trip style (scenic / active / culture / family)

### Output

- Ranked nearby destinations / attractions
- Estimated travel time
- Relevance reason
- Suggested trip plan

### Contraints

- Must use real source data only
- No hallucinated attractions
- Fast response time

---

## Learning & Personalization

The system improves over time using:

- Saved trips
- Reviews
- Popular searches
- Click behavior
- Preferred regions/styles

This data feeds:

- Better homepage recommendations
- Better ranking of attractions
- Personalized trip ideas

---

## Core User Flows

### Explore Flow

- User opens app
- Clicks Plan a Trip
- Selects start location
- Sets radius
- Reviews smart suggestions
- Opens attraction detail
- Clicks Plan this Trip
- Uses transport/weather/hotel info

### Save Trip Flow

- User selects attraction or plan
- Clicks Save Trip
- Logs in or creates account
- Trip stored in account

### Review Flow
- Logged-in user visits completed attraction
- Leaves rating and review

---

## MVP Scope

### Included
- Homepage
- Map + radius search
- Attraction discovery
- Attraction detail page
- Weather links/integration
- Transport links/integration
- Hotel partner links
- Authentication
- Save trips

### Excluded
- Full AI itinerary engine
- Social features
- Paid subscriptions
- Deep personalization

---

## Roadmap

### MVP

- Core discovery flow
- Map radius experience
- Save trips
- Basic monetization via hotel partner links

### Phase 2

- Smart ranking engine
- Reviews
- Personalized recommendations
- Better trip itineraries

### Phase 3

- AI travel assistant
- Real-time weather rerouting
- Premium features

---

## Monetization

| Plan | Price | Features |
|-------------------|-----------|---------------------------------------|
| Free 				| $0 		| Discovery, planning basics 			|
| Partner Revenue 	| Variable 	| Hotel booking commissions 			|
| Premium (future) 	| TBD 		| Advanced planning, AI, offline trips 	|

Notes:
- Booking commissions are initial revenue source
- Premium layer can be added later

---

## Architecture

### Authentication

- Custom app authentication with JWT tokens
- Passwords encrypted

Features:

- Register
- Login
- Get User
- Update User
- Forgot / Reset Password


### Backend Responsibilities

- Aggregate external APIs
- Radius filtering
- Recommendation ranking
- Store users/trips/reviews
- Protect API keys

---

## UI / UX

- Mobile-first
- Map-centric but not map-only
- Premium scenic visual style
- Fast decision-making UX
- Minimal friction onboarding
- PrimeNG components

Principles:
- Help users decide quickly
- Make Switzerland feel exciting
- Blend inspiration with utility

---

## Tech Stack

| Category | Choice |
|---------------|-----------------------------------|
| Frontend 		| Angular (Capacitor for mobile) 	|
| Backend 		| Nodejs / Express 					|
| Language 		| TypeScript 						|
| Database 		| MongoDB 							|
| Caching 		| Redis (optional) 					|
| Auth 			| Custom JWT						|
| Maps 			| MapTiler SDK JS					|
| Deployment 	| Docker / Synology NAS 			|

---

## Data Model

> This schema is a starting point and will evolve.

```ts
const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    country: String,
    emailUpdates: { type: Boolean, default: false },
    isPro: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const SavedTripSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  startLocation: Object,
  radiusKm: Number,
  attractionId: String,
  itinerary: Array,
  createdAt: { type: Date, default: Date.now }
});

const SavedTripSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  startLocation: Object,
  radiusKm: Number,
  attractionId: String,
  itinerary: Array,
  createdAt: { type: Date, default: Date.now }
});
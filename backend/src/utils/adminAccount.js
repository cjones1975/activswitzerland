// Single hardcoded admin account - not a role system, since there is exactly one admin. Same
// account already used to gate curated-trip translation/language behavior.
export const isAdminAccount = userId => !!userId && userId === process.env.CURATED_TRIPS_USER_ID;

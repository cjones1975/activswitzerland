import mongoose from 'mongoose';

const TripDateRangeSchema = new mongoose.Schema({
    mode:      { type: String, enum: ['dates', 'days'], required: true },
    startDate: String,
    endDate:   String,
    startDay:  Number,
    endDay:    Number,
}, { _id: false });

const TripStopSchema = new mongoose.Schema({
    id:         { type: String, required: true },
    role:       { type: String, enum: ['departure', 'destination', 'stop'], required: true },
    name:       { type: String, required: true },
    lat:        { type: Number, required: true },
    lon:        { type: Number, required: true },
    externalId: String,
    days:       { type: Number, required: true },
}, { _id: false });

const TripSectionStopSchema = new mongoose.Schema({
    time:     String,
    station:  String,
    platform: String,
}, { _id: false });

const TripSectionJourneySchema = new mongoose.Schema({
    name:      String,
    category:  String,
    number:    String,
    direction: String,
}, { _id: false });

const TripSectionSchema = new mongoose.Schema({
    type:         { type: String, enum: ['journey', 'walk'] },
    departure:    TripSectionStopSchema,
    arrival:      TripSectionStopSchema,
    journey:      TripSectionJourneySchema,
    walkDuration: Number,
}, { _id: false });

const TripConnectionSchema = new mongoose.Schema({
    from:             String,
    to:               String,
    departure:        String,
    arrival:          String,
    duration:         String,
    transfers:        Number,
    products:         [String],
    routeCoordinates: [[Number]],
    sections:         [TripSectionSchema],
}, { _id: false });

const TripConnectionLegSchema = new mongoose.Schema({
    fromStopId: { type: String, required: true },
    toStopId:   { type: String, required: true },
    connection: TripConnectionSchema,
    skipped:    Boolean,
}, { _id: false });

const TripActivitySchema = new mongoose.Schema({
    id:         { type: String, required: true },
    stopId:     { type: String, required: true },
    kind:       { type: String, enum: ['attraction', 'hike', 'bike'], required: true },
    refId:      { type: String, required: true },
    day:        { type: mongoose.Schema.Types.Mixed, required: true },
    name:       { type: String, required: true },
    lat:        Number,
    lon:        Number,
    distanceKm: Number,
    category:   { type: String, enum: ['national', 'regional', 'local'] },
    bikeType:   { type: String, enum: ['road', 'mountain'] },
}, { _id: false });

const TripSchema = new mongoose.Schema({
    user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:             { type: String, required: true, trim: true },
    type:             { type: String, enum: ['road', 'rail'], required: true },
    dateMode:         { type: String, enum: ['dates', 'days'], required: true },
    range:            { type: TripDateRangeSchema, required: true },
    stops:            { type: [TripStopSchema], required: true },
    connections:      { type: [TripConnectionLegSchema], default: [] },
    activities:       { type: [TripActivitySchema], default: [] },
    routeCoordinates: { type: [[Number]], default: [] },
    isPublic:         { type: Boolean, default: false },
    anonymous:        { type: Boolean, default: true },
    review:           { type: String, default: '', trim: true, maxlength: 650 },
    // Auto-translated via the Claude API, curated account only — see
    // trip-content-translation-spec.md. No `en` key: English is `name`/`review` itself.
    nameTranslations: {
        de: String, fr: String, it: String,
    },
    reviewTranslations: {
        de: { type: String, maxlength: 650 },
        fr: { type: String, maxlength: 650 },
        it: { type: String, maxlength: 650 },
    },
    // Detected (curator: hardcoded 'en') source language of `review`/`name`, set on every
    // public trip regardless of account, powering the Explore Trips language filter.
    reviewLang:       { type: String, enum: ['en', 'de', 'fr', 'it', 'other'] },
    likes:            { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    distanceKm:       { type: Number, default: 0 },
    // Assigned once, on the isPublic false->true transition (see utils/slug.js); never
    // regenerated afterward, even if `name` later changes — see trip-detail-pages-spec.md.
    slug:             { type: String, unique: true, sparse: true, index: true },
    createdAt:        { type: Date, default: Date.now },
});

export default mongoose.model('Trip', TripSchema);

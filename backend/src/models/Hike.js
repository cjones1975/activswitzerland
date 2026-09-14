import mongoose from 'mongoose';

const HikePointSchema = new mongoose.Schema({
    name: String,
    lat: Number,
    lon: Number,
    elevation: Number,
}, { _id: false });

// One line per <trkseg> in the source GPX - kept as separate lines (not flattened) so a track
// with a real gap/discontinuity still renders correctly, matching the ASTRA MultiLineString
// convention (see schweizMobilRoutes.js's getLines/reprojectGeometry). Custom hikes are always
// single-stage for now, so `stages` always has exactly one entry.
const HikeStageSchema = new mongoose.Schema({
    stageId:       { type: String, required: true },
    stageNumber:   { type: Number, required: true, default: 1 },
    title:         { type: String, default: '' },
    geometry:      { type: mongoose.Schema.Types.Mixed, required: true }, // MultiLineString, LV95 meters
    geometryWgs84: { type: mongoose.Schema.Types.Mixed, required: true }, // MultiLineString, lon/lat
}, { _id: false });

const HikeSchema = new mongoose.Schema({
    // "custom-" prefix guarantees no collision with real ASTRA route numbers, which are bare
    // digits (see getRouteCategory in schweizMobilRoutes.js). Generated at ingestion, never
    // user-supplied - see generateRouteNumber in utils/customHikes.js.
    routeNumber:   { type: String, required: true, unique: true },
    name:          { type: String, required: true, trim: true },
    category:      { type: String, enum: ['national', 'regional', 'local'], default: 'local' },
    isMultiDay:    { type: Boolean, default: false },
    distanceKm:    { type: Number, required: true },
    distanceMiles: { type: Number, required: true },
    stages:        { type: [HikeStageSchema], required: true },
    // Computed at ingestion from the GPX's own <ele> values (utils/customHikes.js#parseGpx) and
    // stored so the admin list can show them without recomputing - the public hike-detail
    // elevation chart keeps using the existing geo.admin.ch DEM endpoint unchanged, so these
    // fields are for the admin UI only right now.
    ascentM:       Number,
    descentM:      Number,
    minElevation:  Number,
    maxElevation:  Number,
    startPoint:    HikePointSchema,
    endPoint:      HikePointSchema,
    source:        { type: String, default: 'loisirs.ch' },
    createdAt:     { type: Date, default: Date.now },
});

export default mongoose.model('Hike', HikeSchema);

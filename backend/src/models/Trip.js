import mongoose from 'mongoose';

const TripStopSchema = new mongoose.Schema({
    stationId: { type: String, required: true },
    name:      { type: String, required: true },
    lat:       { type: Number, required: true },
    lon:       { type: Number, required: true },
}, { _id: false });

const TripSchema = new mongoose.Schema({
    user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:             { type: String, required: true, trim: true },
    type:             { type: String, enum: ['road', 'rail'], required: true },
    stops:            { type: [TripStopSchema], required: true },
    attractionIds:    { type: [String], default: [] },
    routeCoordinates: { type: [[Number]], default: [] },
    createdAt:        { type: Date, default: Date.now },
});

export default mongoose.model('Trip', TripSchema);

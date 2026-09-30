import mongoose from 'mongoose';

const HotelDestinationSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['city', 'village'],
        required: true
    },
    destId: {
        type: String,
        required: true,
        trim: true
    },
    destType: {
        type: String,
        required: true,
        trim: true,
        default: 'city'
    },
    // GetYourGuide location ID for the Experiences / Day trips widget. Optional and independent of
    // the Booking.com fields above: rows without one simply don't show the Experiences section.
    gygLocationId: {
        type: Number,
        required: false
    }
});

export default mongoose.model('HotelDestination', HotelDestinationSchema);

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
    }
});

export default mongoose.model('HotelDestination', HotelDestinationSchema);

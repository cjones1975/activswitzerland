import mongoose from 'mongoose';

const CountrySchema = new mongoose.Schema({
    alpha2Code: {
        type: String,
        required: true,
        trim: true
    },
    shortName: {
        type: String,
        required: true,
        trim: true
    }
});

export default mongoose.model('Country', CountrySchema);
import mongoose from 'mongoose';

// One document per conversation; its _id is the session id the frontend holds onto for
// follow-up turns. `messages` stores the raw Anthropic message shape (role + content, where
// content is either a string or an array of content blocks) so it can be fed straight back into
// aiAgent.js's runConversation() on the next turn without reshaping.
const AiConversationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    messages: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('AiConversation', AiConversationSchema);

import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, //Since Channel is also a User, where subscribers subscribe to
        ref: "User"
    }
}, { timestamps: true })

export const SubscriptionSchema = mongoose.model("SubscriptionSchema", subscriptionSchema)
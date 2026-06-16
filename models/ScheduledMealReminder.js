const mongoose = require('mongoose');

// === FITUR MEAL REMINDER - START ===
// Model ini menyimpan jadwal alarm makan per user.
// Nama model dibuat "ScheduledMealReminder" agar tidak bentrok dengan nama MealReminder lama.
const scheduledMealReminderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        title: {
            type: String,
            required: [true, 'Meal reminder title is required'],
            trim: true,
            maxlength: 50,
        },

        time: {
            type: String,
            required: [true, 'Reminder time is required'],
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must use HH:mm format'],
        },

        days: {
            type: [String],
            required: true,
            enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            validate: {
                validator(value) {
                    return Array.isArray(value) && value.length > 0;
                },
                message: 'At least one repeat day is required',
            },
        },

        message: {
            type: String,
            trim: true,
            maxlength: 150,
            default: 'Time to stay consistent with your nutrition.',
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);
// === FITUR MEAL REMINDER - END ===

module.exports = mongoose.model(
    'ScheduledMealReminder',
    scheduledMealReminderSchema
);
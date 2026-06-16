const ScheduledMealReminder = require('../models/ScheduledMealReminder');

// === FITUR MEAL REMINDER - START ===
// Controller khusus fitur alarm makan.
// Nama fungsi dibuat spesifik agar tidak bentrok dengan controller lain.
const REMINDER_DAY_VALUES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_REMINDER_MESSAGE =
    'Time to stay consistent with your nutrition.';

const isValidReminderTime = (time) => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const validateScheduledReminderPayload = ({ title, time, days }) => {
    if (!title || !title.trim()) {
        return 'Meal type is required';
    }

    if (!time || !isValidReminderTime(time)) {
        return 'Reminder time must use HH:mm format';
    }

    if (!Array.isArray(days) || days.length === 0) {
        return 'At least one repeat day is required';
    }

    const hasInvalidDay = days.some(
        (day) => !REMINDER_DAY_VALUES.includes(day)
    );

    if (hasInvalidDay) {
        return 'Repeat day contains invalid value';
    }

    return null;
};

const getScheduledMealReminders = async (req, res) => {
    try {
        const reminders = await ScheduledMealReminder.find({
            user: req.user.id,
        }).sort({
            createdAt: -1,
        });

        res.status(200).json(reminders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createScheduledMealReminder = async (req, res) => {
    try {
        const { title, time, days, message, isActive } = req.body;

        const validationError = validateScheduledReminderPayload({
            title,
            time,
            days,
        });

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const reminder = await ScheduledMealReminder.create({
            user: req.user.id,
            title: title.trim(),
            time,
            days,
            message:
                message && message.trim()
                    ? message.trim()
                    : DEFAULT_REMINDER_MESSAGE,
            isActive: typeof isActive === 'boolean' ? isActive : true,
        });

        res.status(201).json(reminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateScheduledMealReminder = async (req, res) => {
    try {
        const reminder = await ScheduledMealReminder.findById(req.params.id);

        if (!reminder) {
            return res.status(404).json({
                message: 'Meal reminder not found',
            });
        }

        if (reminder.user.toString() !== req.user.id) {
            return res.status(401).json({
                message: 'User not authorized',
            });
        }

        const { title, time, days, message, isActive } = req.body;

        const nextTitle = title !== undefined ? title : reminder.title;
        const nextTime = time !== undefined ? time : reminder.time;
        const nextDays = days !== undefined ? days : reminder.days;

        const validationError = validateScheduledReminderPayload({
            title: nextTitle,
            time: nextTime,
            days: nextDays,
        });

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        reminder.title = nextTitle.trim();
        reminder.time = nextTime;
        reminder.days = nextDays;

        if (message !== undefined) {
            reminder.message = message.trim()
                ? message.trim()
                : DEFAULT_REMINDER_MESSAGE;
        }

        if (typeof isActive === 'boolean') {
            reminder.isActive = isActive;
        }

        const updatedReminder = await reminder.save();

        res.status(200).json(updatedReminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteScheduledMealReminder = async (req, res) => {
    try {
        const reminder = await ScheduledMealReminder.findById(req.params.id);

        if (!reminder) {
            return res.status(404).json({
                message: 'Meal reminder not found',
            });
        }

        if (reminder.user.toString() !== req.user.id) {
            return res.status(401).json({
                message: 'User not authorized',
            });
        }

        await reminder.deleteOne();

        res.status(200).json({
            id: req.params.id,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// === FITUR MEAL REMINDER - END ===

module.exports = {
    getScheduledMealReminders,
    createScheduledMealReminder,
    updateScheduledMealReminder,
    deleteScheduledMealReminder,
};
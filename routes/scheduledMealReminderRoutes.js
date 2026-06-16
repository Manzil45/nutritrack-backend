const express = require('express');
const router = express.Router();

const {
    getScheduledMealReminders,
    createScheduledMealReminder,
    updateScheduledMealReminder,
    deleteScheduledMealReminder,
} = require('../controllers/scheduledMealReminderController');

const { protect } = require('../middleware/authMiddleware');

// === FITUR MEAL REMINDER - START ===
// Route private untuk CRUD alarm makan.
// Semua endpoint memakai protect karena data reminder milik masing-masing user.
router
    .route('/')
    .get(protect, getScheduledMealReminders)
    .post(protect, createScheduledMealReminder);

router
    .route('/:id')
    .put(protect, updateScheduledMealReminder)
    .delete(protect, deleteScheduledMealReminder);
// === FITUR MEAL REMINDER - END ===

module.exports = router;
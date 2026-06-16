// tests/unit/mealReminderController.test.js

const mongoose = require('mongoose');

jest.mock('../../models/ScheduledMealReminder', () => ({
    find: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
}));

const ScheduledMealReminder = require('../../models/ScheduledMealReminder');
const scheduledMealReminderController = require('../../controllers/scheduledMealReminderController');

const createMockReqRes = (
    body = {},
    params = {},
    userId = new mongoose.Types.ObjectId().toString()
) => {
    const req = {
        user: {
            id: userId,
        },
        body,
        params,
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };

    return {
        req,
        res,
    };
};

describe('Meal Reminder Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('1. get reminder berhasil menampilkan reminder milik user login', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const { req, res } = createMockReqRes({}, {}, userId);

        const mockReminders = [
            {
                _id: 'reminder_1',
                user: userId,
                title: 'Breakfast',
                time: '08:00',
                days: ['Mon', 'Wed', 'Fri'],
                message: 'Do not skip breakfast',
                isActive: true,
            },
        ];

        ScheduledMealReminder.find.mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockReminders),
        });

        await scheduledMealReminderController.getScheduledMealReminders(req, res);

        expect(ScheduledMealReminder.find).toHaveBeenCalledWith({
            user: userId,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockReminders);
    });

    test('2. create reminder berhasil jika input valid', async () => {
        const userId = new mongoose.Types.ObjectId().toString();

        const reminderInput = {
            title: 'Breakfast',
            time: '08:00',
            days: ['Mon', 'Wed', 'Fri'],
            message: 'Start your day strong',
        };

        const { req, res } = createMockReqRes(reminderInput, {}, userId);

        const createdReminder = {
            _id: 'reminder_1',
            user: userId,
            ...reminderInput,
            isActive: true,
        };

        ScheduledMealReminder.create.mockResolvedValue(createdReminder);

        await scheduledMealReminderController.createScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.create).toHaveBeenCalledWith({
            user: userId,
            title: 'Breakfast',
            time: '08:00',
            days: ['Mon', 'Wed', 'Fri'],
            message: 'Start your day strong',
            isActive: true,
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(createdReminder);
    });

    test('3. create reminder gagal jika title kosong', async () => {
        const { req, res } = createMockReqRes({
            title: '',
            time: '08:00',
            days: ['Mon'],
        });

        await scheduledMealReminderController.createScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Meal type is required',
        });
    });

    test('4. create reminder gagal jika format waktu salah', async () => {
        const { req, res } = createMockReqRes({
            title: 'Breakfast',
            time: '8 pagi',
            days: ['Mon'],
        });

        await scheduledMealReminderController.createScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Reminder time must use HH:mm format',
        });
    });

    test('5. create reminder gagal jika repeat day kosong', async () => {
        const { req, res } = createMockReqRes({
            title: 'Breakfast',
            time: '08:00',
            days: [],
        });

        await scheduledMealReminderController.createScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'At least one repeat day is required',
        });
    });

    test('6. create reminder gagal jika repeat day tidak valid', async () => {
        const { req, res } = createMockReqRes({
            title: 'Breakfast',
            time: '08:00',
            days: ['Monday'],
        });

        await scheduledMealReminderController.createScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Repeat day contains invalid value',
        });
    });

    test('7. update reminder berhasil jika dilakukan pemiliknya', async () => {
        const userId = new mongoose.Types.ObjectId().toString();

        const { req, res } = createMockReqRes(
            {
                title: 'Lunch',
                time: '12:00',
                days: ['Tue', 'Thu'],
                message: 'Lunch time',
            },
            {
                id: 'reminder_1',
            },
            userId
        );

        const existingReminder = {
            _id: 'reminder_1',
            user: {
                toString: () => userId,
            },
            title: 'Breakfast',
            time: '08:00',
            days: ['Mon'],
            message: 'Old message',
            isActive: true,
            save: jest.fn().mockResolvedValue({
                _id: 'reminder_1',
                user: userId,
                title: 'Lunch',
                time: '12:00',
                days: ['Tue', 'Thu'],
                message: 'Lunch time',
                isActive: true,
            }),
        };

        ScheduledMealReminder.findById.mockResolvedValue(existingReminder);

        await scheduledMealReminderController.updateScheduledMealReminder(req, res);

        expect(ScheduledMealReminder.findById).toHaveBeenCalledWith('reminder_1');
        expect(existingReminder.title).toBe('Lunch');
        expect(existingReminder.time).toBe('12:00');
        expect(existingReminder.days).toEqual(['Tue', 'Thu']);
        expect(existingReminder.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('8. update reminder berhasil untuk toggle aktif/nonaktif', async () => {
        const userId = new mongoose.Types.ObjectId().toString();

        const { req, res } = createMockReqRes(
            {
                isActive: false,
            },
            {
                id: 'reminder_1',
            },
            userId
        );

        const existingReminder = {
            _id: 'reminder_1',
            user: {
                toString: () => userId,
            },
            title: 'Breakfast',
            time: '08:00',
            days: ['Mon'],
            message: 'Breakfast time',
            isActive: true,
            save: jest.fn().mockResolvedValue({
                _id: 'reminder_1',
                isActive: false,
            }),
        };

        ScheduledMealReminder.findById.mockResolvedValue(existingReminder);

        await scheduledMealReminderController.updateScheduledMealReminder(req, res);

        expect(existingReminder.isActive).toBe(false);
        expect(existingReminder.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('9. update reminder gagal jika reminder tidak ditemukan', async () => {
        const { req, res } = createMockReqRes(
            {
                title: 'Lunch',
            },
            {
                id: 'reminder_tidak_ada',
            }
        );

        ScheduledMealReminder.findById.mockResolvedValue(null);

        await scheduledMealReminderController.updateScheduledMealReminder(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Meal reminder not found',
        });
    });

    test('10. update reminder gagal jika user mengubah reminder milik orang lain', async () => {
        const userLoginId = new mongoose.Types.ObjectId().toString();
        const ownerReminderId = new mongoose.Types.ObjectId().toString();

        const { req, res } = createMockReqRes(
            {
                title: 'Hack Reminder',
            },
            {
                id: 'reminder_1',
            },
            userLoginId
        );

        const existingReminder = {
            _id: 'reminder_1',
            user: {
                toString: () => ownerReminderId,
            },
            title: 'Breakfast',
            time: '08:00',
            days: ['Mon'],
            save: jest.fn(),
        };

        ScheduledMealReminder.findById.mockResolvedValue(existingReminder);

        await scheduledMealReminderController.updateScheduledMealReminder(req, res);

        expect(existingReminder.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: 'User not authorized',
        });
    });

    test('11. delete reminder berhasil jika dilakukan pemiliknya', async () => {
        const userId = new mongoose.Types.ObjectId().toString();

        const { req, res } = createMockReqRes(
            {},
            {
                id: 'reminder_1',
            },
            userId
        );

        const existingReminder = {
            _id: 'reminder_1',
            user: {
                toString: () => userId,
            },
            deleteOne: jest.fn().mockResolvedValue({}),
        };

        ScheduledMealReminder.findById.mockResolvedValue(existingReminder);

        await scheduledMealReminderController.deleteScheduledMealReminder(req, res);

        expect(existingReminder.deleteOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            id: 'reminder_1',
        });
    });

    test('12. delete reminder gagal jika user menghapus reminder milik orang lain', async () => {
        const userLoginId = new mongoose.Types.ObjectId().toString();
        const ownerReminderId = new mongoose.Types.ObjectId().toString();

        const { req, res } = createMockReqRes(
            {},
            {
                id: 'reminder_1',
            },
            userLoginId
        );

        const existingReminder = {
            _id: 'reminder_1',
            user: {
                toString: () => ownerReminderId,
            },
            deleteOne: jest.fn(),
        };

        ScheduledMealReminder.findById.mockResolvedValue(existingReminder);

        await scheduledMealReminderController.deleteScheduledMealReminder(req, res);

        expect(existingReminder.deleteOne).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: 'User not authorized',
        });
    });
});
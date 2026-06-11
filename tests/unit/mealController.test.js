const mongoose = require('mongoose');
const mealController = require('../controllers/mealController');
const MealLog = require('../models/MealLog');

// ======================================
// MOCK
// ======================================
// Melakukan mock penuh pada model MealLog agar tidak menembak DB asli
jest.mock('../models/MealLog');

// ======================================
// HELPER
// ======================================
// Helper untuk membuat objek req, res, dan next palsu
const mockReqRes = (body = {}, query = {}, params = {}) => {
  const req = {
    user: { id: new mongoose.Types.ObjectId().toString() }, // Simulasi user yang sudah login
    body,
    query,
    params,
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return { req, res };
};

// ======================================
// TESTING
// ======================================
describe('Meal Controller Unit Testing', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------
  // GET MEALS
  // --------------------------------------
  describe('Get Meals', () => {
    test('Get meals berhasil tanpa filter tanggal', async () => {
      const { req, res } = mockReqRes();
      const mockMeals = [
        { _id: 'meal1', user: req.user.id, mealType: 'Breakfast', name: 'Bubur' },
      ];

      // Mocking chained method: MealLog.find().populate()
      MealLog.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMeals),
      });

      await mealController.getMeals(req, res);

      expect(MealLog.find).toHaveBeenCalledWith({ user: req.user.id });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMeals);
    });

    test('Get meals berhasil dengan filter tanggal khusus', async () => {
      const { req, res } = mockReqRes({}, { date: '2026-06-06' });

      MealLog.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      await mealController.getMeals(req, res);

      const expectedStart = new Date('2026-06-06');
      expectedStart.setUTCHours(0, 0, 0, 0);
      const expectedEnd = new Date('2026-06-06');
      expectedEnd.setUTCHours(23, 59, 59, 999);

      expect(MealLog.find).toHaveBeenCalledWith({
        user: req.user.id,
        date: { $gte: expectedStart, $lte: expectedEnd },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // --------------------------------------
  // CREATE MEAL (SET MEAL)
  // --------------------------------------
  describe('Create Meal', () => {
    test('Create meal berhasil dengan input valid', async () => {
      const mealData = {
        mealType: 'Breakfast', // Gunakan huruf kapital agar aman dengan Enum
        name: 'Nasi Goreng',
        foods: [],
        totalNutrients: { calories: 350, protein: 12, carbs: 45, fat: 10 }
      };
      
      const { req, res } = mockReqRes(mealData);
      const mockCreatedMeal = { ...mealData, user: req.user.id, _id: 'new_meal_id' };

      MealLog.create.mockResolvedValue(mockCreatedMeal);

      await mealController.setMeal(req, res);

      expect(MealLog.create).toHaveBeenCalledWith({
        user: req.user.id,
        mealType: 'Breakfast',
        name: 'Nasi Goreng',
        description: undefined,
        image: undefined,
        foods: [],
        totalNutrients: { calories: 350, protein: 12, carbs: 45, fat: 10 }
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedMeal);
    });

    test('Create meal gagal jika mealType kosong', async () => {
      const { req, res } = mockReqRes({ name: 'Nasi Uduk' }); // mealType dilewati

      await mealController.setMeal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'mealType is required' });
      expect(MealLog.create).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------
  // UPDATE MEAL
  // --------------------------------------
  describe('Update Meal', () => {
    test('Update meal berhasil jika dilakukan pemiliknya', async () => {
      const { req, res } = mockReqRes({ name: 'Oatmeal Premium' }, {}, { id: 'meal_target' });
      
      const existingMeal = { _id: 'meal_target', user: req.user.id, mealType: 'Breakfast' };
      const updatedMeal = { ...existingMeal, name: 'Oatmeal Premium' };

      MealLog.findById.mockResolvedValue(existingMeal);
      MealLog.findByIdAndUpdate.mockResolvedValue(updatedMeal);

      await mealController.updateMeal(req, res);

      expect(MealLog.findById).toHaveBeenCalledWith('meal_target');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedMeal);
    });

    test('Update meal gagal jika data tidak ditemukan', async () => {
      const { req, res } = mockReqRes({ name: 'Soto' }, {}, { id: 'invalid_id' });

      MealLog.findById.mockResolvedValue(null);

      await mealController.updateMeal(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Meal not found' });
    });

    test('Update meal gagal jika diakses oleh user yang berbeda (unauthorized)', async () => {
      const { req, res } = mockReqRes({ name: 'Hack Data' }, {}, { id: 'meal_orang_lain' });
      const mealMilikOrangLain = { _id: 'meal_orang_lain', user: 'id_user_lain', mealType: 'Lunch' };

      MealLog.findById.mockResolvedValue(mealMilikOrangLain);

      await mealController.updateMeal(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not authorized' });
      expect(MealLog.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------
  // DELETE MEAL
  // --------------------------------------
  describe('Delete Meal', () => {
    test('Delete meal berhasil jika dilakukan pemiliknya', async () => {
      const { req, res } = mockReqRes({}, {}, { id: 'meal_yang_mau_dihapus' });
      const existingMeal = { _id: 'meal_yang_mau_dihapus', user: req.user.id };

      MealLog.findById.mockResolvedValue(existingMeal);
      MealLog.findByIdAndDelete.mockResolvedValue(existingMeal);

      await mealController.deleteMeal(req, res);

      expect(MealLog.findByIdAndDelete).toHaveBeenCalledWith('meal_yang_mau_dihapus');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'meal_yang_mau_dihapus' });
    });

    test('Delete meal gagal jika dikerjakan oleh user ilegal', async () => {
      const { req, res } = mockReqRes({}, {}, { id: 'meal_aman' });
      const mealMilikOrangLain = { _id: 'meal_aman', user: 'id_orang_lain' };

      MealLog.findById.mockResolvedValue(mealMilikOrangLain);

      await mealController.deleteMeal(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not authorized' });
      expect(MealLog.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
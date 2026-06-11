const mongoose = require('mongoose');
const foodController = require('../controllers/foodController'); // Sesuaikan path-nya
const FoodItem = require('../models/FoodItem');

// ======================================
// MOCKING DATABASE
// ======================================
jest.mock('../models/FoodItem');

// ======================================
// HELPER REQ & RES PALSU
// ======================================
const mockReqRes = (body = {}, query = {}, params = {}) => {
  const req = {
    user: { id: new mongoose.Types.ObjectId().toString() }, // ID user tiruan yang login
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
// UNIT TESTING LOGIC
// ======================================
describe('Food Controller Unit Testing', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------
  // 1. TESTING SEARCH FOODS
  // --------------------------------------
  describe('searchFoods', () => {
    test('Harus berhasil mengambil data makanan global + milik sendiri tanpa query pencarian', async () => {
      const { req, res } = mockReqRes();
      const mockFoods = [
        { name: 'Apel (Global)', user: null },
        { name: 'Nasi Goreng Kustom (Milik User)', user: req.user.id }
      ];

      // Mengatasi chained methods Mongoose: FoodItem.find().sort().limit()
      FoodItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockFoods),
      });

      await foodController.searchFoods(req, res);

      // Memastikan query database mencakup makanan global OR milik user itu sendiri
      expect(FoodItem.find).toHaveBeenCalledWith({
        $or: [
          { user: { $exists: false } },
          { user: null },
          { user: req.user.id }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFoods);
    });

    test('Harus menerapkan filter regex (case-insensitive) jika mengetik query pencarian', async () => {
      // User mengetik kata kunci "AyaM" di kolom pencarian aplikasi
      const { req, res } = mockReqRes({}, { query: 'AyaM' }); 

      FoodItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await foodController.searchFoods(req, res);

      // Memastikan logika regex 'i' (case-insensitive) berjalan di database palsu
      expect(FoodItem.find).toHaveBeenCalledWith({
        $or: [
          { user: { $exists: false } },
          { user: null },
          { user: req.user.id }
        ],
        name: { $regex: 'AyaM', $options: 'i' }
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('Harus mengembalikan status 500 jika database error saat pencarian', async () => {
      const { req, res } = mockReqRes();
      
      FoodItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Koneksi database terputus')),
      });

      await foodController.searchFoods(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Koneksi database terputus' });
    });
  });

  // --------------------------------------
  // 2. TESTING CREATE FOOD
  // --------------------------------------
  describe('createFood', () => {
    test('Harus berhasil membuat makanan baru yang terikat dengan ID user', async () => {
      const inputBody = {
        name: 'Dada Ayam Rebus',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6
      };
      
      const { req, res } = mockReqRes(inputBody);
      const mockSavedFood = { ...inputBody, user: req.user.id, _id: 'food_id_123' };

      FoodItem.create.mockResolvedValue(mockSavedFood);

      await foodController.createFood(req, res);

      // Memastikan controller otomatis menyuntikkan ID user yang sedang login ke data makanan
      expect(FoodItem.create).toHaveBeenCalledWith({
        ...inputBody,
        user: req.user.id
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockSavedFood);
    });

    test('Harus mengembalikan status 500 jika gagal menyimpan makanan baru', async () => {
      const { req, res } = mockReqRes({ name: 'Makanan Gagal' });
      
      FoodItem.create.mockRejectedValue(new Error('Gagal validasi skema database'));

      await foodController.createFood(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Gagal validasi skema database' });
    });
  });
});
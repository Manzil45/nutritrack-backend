const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../../models/User');
const { protect } = require('../../middleware/authMiddleware');

// ======================================
// MOCK
// ======================================

jest.mock('jsonwebtoken');
jest.mock('../../models/User');

// ======================================
// SETUP
// ======================================

// let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_jwt_secret';
}, 30000);

afterEach(() => {
  jest.clearAllMocks();
});


// ======================================
// HELPER
// ======================================

// Bikin req, res, next palsu
const mockReqResNext = (authHeader = null) => {
  const req = {
    headers: {
      authorization: authHeader,
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
};


// ======================================
// TESTING
// ======================================

describe('Auth Middleware Testing', () => {

  const fakeUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Testing',
    email: 'testing@gmail.com',
  };


  // ======================================
  // BERHASIL
  // ======================================

  describe('Berhasil', () => {

    test('Token valid → next() dipanggil', async () => {
      jwt.verify.mockReturnValue({ id: fakeUser._id });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(fakeUser),
      });

      const { req, res, next } = mockReqResNext('Bearer validtoken123');

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(fakeUser);
    });

  });


  // ======================================
  // GAGAL
  // ======================================

  describe('Gagal', () => {

    test('Tidak ada token → 401', async () => {
      const { req, res, next } = mockReqResNext(null);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, no token',
      });
      expect(next).not.toHaveBeenCalled();
    });


    test('Token tidak pakai Bearer → 401', async () => {
      const { req, res, next } = mockReqResNext('Basic validtoken123');

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, no token',
      });
      expect(next).not.toHaveBeenCalled();
    });


    test('Token invalid → 401', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const { req, res, next } = mockReqResNext('Bearer invalidtoken');

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, token failed',
      });
      expect(next).not.toHaveBeenCalled();
    });


    test('Token valid tapi user tidak ditemukan di DB → 401', async () => {
      jwt.verify.mockReturnValue({ id: fakeUser._id });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null), // user tidak ada
      });

      const { req, res, next } = mockReqResNext('Bearer validtoken123');

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
    message: 'Not authorized, user not found', // ← sesuaikan
  });
  expect(next).not.toHaveBeenCalled();
    });

  });

});
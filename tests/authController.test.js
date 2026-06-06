const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const { registerUser, loginUser } = require('../controllers/authController');

const app = express();
app.use(express.json());

app.post('/register', registerUser);
app.post('/login', loginUser);

// ======================================
// SETUP
// ======================================

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_jwt_secret';

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
}, 15000);

afterEach(async () => {
  await User.deleteMany({});
});


// ======================================
// TESTING
// ======================================

describe('Auth Controller Testing', () => {

  const testUser = {
    name: 'Testing',
    email: 'testing@gmail.com',
    password: '123456',
  };


  // ======================================
  // REGISTER
  // ======================================

  describe('Register', () => {

    test('Register berhasil → 201', async () => {
      const response = await request(app)
        .post('/register')
        .send(testUser);

      expect(response.statusCode).toBe(201);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.name).toBe(testUser.name);
    }, 15000);


    test('Register berhasil → default field tersimpan', async () => {
      const response = await request(app)
        .post('/register')
        .send(testUser);

      expect(response.statusCode).toBe(201);

      // Cek langsung ke DB
      const userInDb = await User.findOne({ email: testUser.email });

      expect(userInDb.goals.calories).toBe(2000);
      expect(userInDb.goals.protein).toBe(150);
      expect(userInDb.goals.carbs).toBe(250);
      expect(userInDb.goals.fat).toBe(60);

      expect(userInDb.preferences.darkMode).toBe(false);
      expect(userInDb.preferences.emailNotifications).toBe(true);
      expect(userInDb.preferences.language).toBe('English (US)');
    }, 15000);


    test('Register gagal → email duplikat → 400', async () => {
      // Register pertama
      await request(app).post('/register').send(testUser);

      // Register kedua dengan email sama
      const response = await request(app)
        .post('/register')
        .send(testUser);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('User already exists');
    }, 15000);


    test('Register gagal → tanpa name → 400', async () => {
      const response = await request(app)
        .post('/register')
        .send({ email: testUser.email, password: testUser.password });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Please add all fields');
    }, 15000);


    test('Register gagal → tanpa email → 400', async () => {
      const response = await request(app)
        .post('/register')
        .send({ name: testUser.name, password: testUser.password });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Please add all fields');
    }, 15000);


    test('Register gagal → tanpa password → 400', async () => {
      const response = await request(app)
        .post('/register')
        .send({ name: testUser.name, email: testUser.email });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Please add all fields');
    }, 15000);

  });


  // ======================================
  // LOGIN
  // ======================================

  describe('Login', () => {

    beforeEach(async () => {
      // Pastikan ada user terdaftar sebelum login
      await request(app).post('/register').send(testUser);
    });


    test('Login berhasil → 200 + dapat token', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(response.statusCode).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.name).toBe(testUser.name);
    }, 15000);


    test('Login gagal → password salah → 400', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    }, 15000);


    test('Login gagal → email tidak terdaftar → 400', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'tidakada@gmail.com', password: testUser.password });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    }, 15000);


    test('Login gagal → tanpa email → 400', async () => {
      const response = await request(app)
        .post('/login')
        .send({ password: testUser.password });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Please add all fields');
    }, 15000);


    test('Login gagal → tanpa password → 400', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: testUser.email });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Please add all fields');
    }, 15000);

  });

});
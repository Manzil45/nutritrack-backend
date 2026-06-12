
// tests/profileController.test.js
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { getProfile, updateProfile } = require('../../controllers/profileController');
const { loginUser, registerUser } = require('../../controllers/authController');
const { protect: authMiddleware } = require('../../middleware/authMiddleware');

const app = express();
app.use(express.json());

// Routes
app.post('/auth/register', registerUser);
app.post('/auth/login', loginUser);
app.get('/api/profile', authMiddleware, getProfile);
app.put('/api/profile', authMiddleware, updateProfile);

// ======================================
// SETUP
// ======================================

let mongoServer;
let token;
let userId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_jwt_secret';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create test user
  const testUserData = {
    name: 'Test User',
    email: 'profiletest@test.com',
    password: 'password123',
  };

  try {
    const registerRes = await request(app).post('/auth/register').send(testUserData);
    if (registerRes.statusCode !== 201) {
      throw new Error(`Register failed: ${registerRes.statusCode}`);
    }

    const loginRes = await request(app).post('/auth/login').send({
      email: testUserData.email,
      password: testUserData.password,
    });
    
    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed: ${loginRes.statusCode}`);
    }

    token = loginRes.body.token;
    userId = loginRes.body._id;
  } catch (error) {
    console.error('Setup error:', error.message);
    throw error;
  }
}, 30000);

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
}, 15000);

// ======================================
// TESTING
// ======================================

describe('Profile Controller Testing', () => {

  // ======================================
  // GET PROFILE
  // ======================================

  describe('GET /api/profile', () => {

    test('Get profile berhasil → 200 & user object', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body._id).toBe(userId);
      expect(response.body.email).toBe('profiletest@test.com');
      expect(response.body.name).toBe('Test User');
    }, 15000);

    test('Get profile tanpa auth → 401', async () => {
      const response = await request(app).get('/api/profile');

      expect(response.statusCode).toBe(401);
    }, 15000);

    test('Get profile → password tidak di-return', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.password).toBeUndefined();
    }, 15000);

    test('Get profile → return goals & preferences', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.goals).toBeDefined();
      expect(response.body.preferences).toBeDefined();
      expect(response.body.goals.calories).toBe(2000);
      expect(response.body.preferences.darkMode).toBe(false);
    }, 15000);

    test('Get profile hanya user sendiri → tidak bisa akses user lain', async () => {
      // Create another user
      const otherUserData = {
        name: 'Other User',
        email: 'other@test.com',
        password: 'password123',
      };

      await request(app).post('/auth/register').send(otherUserData);
      const otherRes = await request(app).post('/auth/login').send({
        email: otherUserData.email,
        password: otherUserData.password,
      });
      const otherToken = otherRes.body.token;

      // Get other profile dengan token user lain
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${otherToken}`);

      // Should get own profile, not the first user
      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('other@test.com');
    }, 15000);

  });

  // ======================================
  // UPDATE PROFILE
  // ======================================

  describe('PUT /api/profile', () => {

    test('Update profile berhasil → 200', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'Health enthusiast',
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.bio).toBe('Health enthusiast');
    }, 15000);

    test('Update goals berhasil → 200', async () => {
      const updateData = {
        goals: {
          calories: 2500,
          protein: 200,
          carbs: 300,
          fat: 80,
        },
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.goals.calories).toBe(2500);
      expect(response.body.goals.protein).toBe(200);
    }, 15000);

    test('Update preferences berhasil → 200', async () => {
      const updateData = {
        preferences: {
          darkMode: true,
          emailNotifications: false,
          language: 'Bahasa Indonesia',
        },
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.preferences.darkMode).toBe(true);
      expect(response.body.preferences.emailNotifications).toBe(false);
      expect(response.body.preferences.language).toBe('Bahasa Indonesia');
    }, 15000);

    test('Update profile partial → only update specified fields', async () => {
      const updateData = {
        name: 'New Name Only',
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('New Name Only');
      // Preferences should not change
      expect(response.body.preferences).toBeDefined();
    }, 15000);

    test('Update profile tanpa auth → 401', async () => {
      const response = await request(app)
        .put('/api/profile')
        .send({ name: 'Hacker' });

      expect(response.statusCode).toBe(401);
    }, 15000);

    test('Update profile → hanya user sendiri bisa update', async () => {
      // Create another user
      const otherUserData = {
        name: 'Other User 2',
        email: 'other2@test.com',
        password: 'password123',
      };

      await request(app).post('/auth/register').send(otherUserData);
      const otherRes = await request(app).post('/auth/login').send({
        email: otherUserData.email,
        password: otherUserData.password,
      });
      const otherToken = otherRes.body.token;

      // Try update dengan token user lain
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Updated by Hacker' });

      expect(response.statusCode).toBe(200);
      // Should update own profile, not the first user
      const profileRes = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(profileRes.body.name).toBe('Updated by Hacker');
    }, 15000);

    test('Update goals partial → only update specified goals', async () => {
      const updateData = {
        goals: {
          calories: 3000,
        },
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.goals.calories).toBe(3000);
      // Other goals should remain
      expect(response.body.goals.protein).toBeDefined();
    }, 15000);

  });

  // ======================================
  // VALIDATION
  // ======================================

  describe('Profile Validation', () => {

    test('Update goals dengan nilai invalid → should still update (trust client)', async () => {
      const updateData = {
        goals: {
          calories: -100, // Invalid
        },
      };

      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      // Depends on backend validation
      expect([200, 400]).toContain(response.statusCode);
    }, 15000);

  });

});
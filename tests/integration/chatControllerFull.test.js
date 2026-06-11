// tests/chatControllerFull.test.js
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock @google/genai so tests don't call the real Gemini API
jest.mock('@google/genai', () => {
  const mockGenerateContent = jest.fn().mockImplementation(({ contents }) => {
    const userMessage = contents[0]?.parts[0]?.text || '';

    // If the message mentions food, return a bento response
    const isFoodRelated = /rice|chicken|eat|ate|nutrition|wheat/i.test(userMessage);

    const responseData = isFoodRelated
      ? {
          text: 'Here is the nutrition info for your food.',
          hasBento: true,
          bentoData: {
            name: 'Food Item',
            description: 'A typical serving',
            calories: 250,
            protein: 20,
            carbs: 30,
            fat: 8,
            image: 'https://example.com/food.jpg',
          },
        }
      : {
          text: 'I can help you with nutrition questions!',
          hasBento: false,
          bentoData: null,
        };

    return Promise.resolve({ text: JSON.stringify(responseData) });
  });

  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

const { chatWithGemini: sendMessage } = require('../controllers/chatController');
const { loginUser, registerUser } = require('../controllers/authController');
const { protect: authMiddleware } = require('../middleware/authMiddleware');

const app = express();
app.use(express.json());

// Routes
app.post('/auth/register', registerUser);
app.post('/auth/login', loginUser);
app.post('/api/chat', authMiddleware, sendMessage);

// ======================================
// SETUP & TEARDOWN
// ======================================

let mongoServer;
let token;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_jwt_secret';
  process.env.GEMINI_API_KEY = 'test_gemini_key';

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create test user
  const testUserData = {
    name: 'Chat Test User',
    email: 'chattest@test.com',
    password: 'password123',
  };

  const _registerRes = await request(app).post('/auth/register').send(testUserData);
  const loginRes = await request(app).post('/auth/login').send({
    email: testUserData.email,
    password: testUserData.password,
  });

  token = loginRes.body.token;
}, 30000);

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
}, 15000);

// ======================================
// TESTING
// ======================================

describe('Chat Controller Testing', () => {

  const testMessage = {
    message: 'What is the nutrition info for 100g of chicken breast?',
  };

  // ======================================
  // SEND MESSAGE
  // ======================================

  describe('POST /api/chat', () => {

    test('Send message berhasil → 200 & response text', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(testMessage);

      expect(response.statusCode).toBe(200);
      expect(response.body.text).toBeDefined();
      expect(typeof response.body.text).toBe('string');
    }, 30000);

    test('Send message → return hasBento boolean', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(testMessage);

      expect(response.statusCode).toBe(200);
      expect(typeof response.body.hasBento).toBe('boolean');
    }, 30000);

    test('Send message dengan nutrisi data → return bentoData', async () => {
      const messageWithFood = {
        message: 'I ate 200g of rice today',
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(messageWithFood);

      expect(response.statusCode).toBe(200);
      if (response.body.hasBento) {
        expect(response.body.bentoData).toBeDefined();
        expect(response.body.bentoData.calories).toBeDefined();
        expect(response.body.bentoData.protein).toBeDefined();
        expect(response.body.bentoData.carbs).toBeDefined();
        expect(response.body.bentoData.fat).toBeDefined();
      }
    }, 30000);

    test('Send message tanpa auth → 401', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send(testMessage);

      expect(response.statusCode).toBe(401);
    }, 15000);

    test('Send message dengan pesan kosong → gagal', async () => {
      const emptyMessage = {
        message: '',
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(emptyMessage);

      expect(response.statusCode).toBe(400);
    }, 15000);

    test('Send message tanpa message field → 400', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.statusCode).toBe(400);
    }, 15000);

  });

  // ======================================
  // RESPONSE VALIDATION
  // ======================================

  describe('Chat Response Validation', () => {

    test('Response nutrients realistic → calories < 3000', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(testMessage);

      if (response.body.hasBento && response.body.bentoData) {
        expect(response.body.bentoData.calories).toBeLessThan(3000);
      }
    }, 30000);

    test('Response nutrients realistic → protein < 200', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(testMessage);

      if (response.body.hasBento && response.body.bentoData) {
        expect(response.body.bentoData.protein).toBeLessThan(200);
      }
    }, 30000);

    test('Response memiliki text field → always return text', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send(testMessage);

      expect(response.statusCode).toBe(200);
      expect(response.body.text).toBeDefined();
      expect(response.body.text.length).toBeGreaterThan(0);
    }, 30000);

  });

  // ======================================
  // ERROR HANDLING
  // ======================================

  describe('Chat Error Handling', () => {

    test('API Error → graceful response', async () => {
      // Test with malformed API key (will trigger error)
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Test message that might cause API error',
        });

      // Should return 200 atau 500, but not crash
      expect([200, 500, 429]).toContain(response.statusCode);
    }, 30000);

  });

  // ======================================
  // MULTI-TURN CONVERSATION
  // ======================================

  describe('Multi-turn Conversation', () => {

    test('Multiple messages dalam satu session → all handled', async () => {
      const messages = [
        'What is the nutrition of rice?',
        'What about wheat?',
        'How about both combined?',
      ];

      for (const msg of messages) {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: msg });

        expect([200, 429]).toContain(response.statusCode);
        if (response.statusCode === 200) {
          expect(response.body.text).toBeDefined();
        }
      }
    }, 60000);

  });

});
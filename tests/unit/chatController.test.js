const chatController = require('../controllers/chatController'); // Pastikan path ini mengarah ke chatController.js kamu
const { GoogleGenAI } = require('@google/genai');

// ======================================
// MOCKING SDK GOOGLE GENAI
// ======================================
jest.mock('@google/genai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

const mockGenerateContentFn = new GoogleGenAI().models.generateContent;

// ======================================
// HELPER REQ & RES PALSU
// ======================================
const mockReqRes = (body = {}) => {
  const req = { body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
};

// ======================================
// UNIT TESTING LOGIC
// ======================================
describe('Chat Controller Unit Testing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'mock_api_key_123';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  // --------------------------------------
  // 1. SKENARIO VALIDASI INPUT & ENV
  // --------------------------------------
  test('Harus gagal jika pesan (message) tidak dikirim → 400', async () => {
    const { req, res } = mockReqRes({});

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Message is required' });
  });

  test('Harus gagal jika GEMINI_API_KEY tidak dikonfigurasi → 500', async () => {
    delete process.env.GEMINI_API_KEY;
    const { req, res } = mockReqRes({ message: 'Halo NutriTrack' });

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing GEMINI_API_KEY' });
  });

  // --------------------------------------
  // 2. SKENARIO BERHASIL (MOCKING AI)
  // --------------------------------------
  test('Harus sukses mengembalikan response umum jika user bertanya pertanyaan umum (bento: false)', async () => {
    const { req, res } = mockReqRes({ message: 'Tips diet sehat apa ya?' });

    const mockAiOutput = {
      text: JSON.stringify({
        text: 'Diet sehat itu kuncinya gizi seimbang dan konsisten!',
        hasBento: false,
        bentoData: null
      })
    };

    mockGenerateContentFn.mockResolvedValue(mockAiOutput);

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      text: 'Diet sehat itu kuncinya gizi seimbang dan konsisten!',
      hasBento: false,
      bentoData: null
    });
  });

  test('Harus sukses mengembalikan data nutrisi jika user mencatat makanan (bento: true)', async () => {
    const { req, res } = mockReqRes({ message: 'Saya makan 1 piring nasi goreng' });

    const mockAiOutput = {
      text: JSON.stringify({
        text: 'Nasi goreng porsi standar diperkirakan mengandung sekitar 350 kalori.',
        hasBento: true,
        bentoData: {
          calories: 350,
          protein: 10,
          carbs: 50,
          fat: 12,
          name: 'Nasi Goreng',
          description: 'Satu porsi piring makan normal'
        }
      })
    };

    mockGenerateContentFn.mockResolvedValue(mockAiOutput);

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      text: 'Nasi goreng porsi standar diperkirakan mengandung sekitar 350 kalori.',
      hasBento: true,
      bentoData: {
        calories: 350,
        protein: 10,
        carbs: 50,
        fat: 12,
        name: 'Nasi Goreng',
        description: 'Satu porsi piring makan normal',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
      }
    });
  });

  // --------------------------------------
  // 3. SKENARIO ERROR / VALIDASI GAGAL
  // --------------------------------------
  test('Harus mengembalikan fallbackResponse jika struktur balasan JSON dari AI cacat/rusak', async () => {
    const { req, res } = mockReqRes({ message: 'Makan ayam' });

    const mockCorruptedOutput = {
      text: JSON.stringify({
        text: 'Ini data rusak',
        hasBento: true,
        bentoData: {
          calories: 200,
          protein: '15g', // Eror karena string, harusnya integer angka bulat
          carbs: 20,
          fat: 5,
          name: 'Ayam',
          description: 'Ayam rusak'
        }
      })
    };

    mockGenerateContentFn.mockResolvedValue(mockCorruptedOutput);

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      text: 'I couldn’t calculate exact nutrition for that. Please try adding more detail (quantity, ingredients, etc).',
      hasBento: false,
      bentoData: null,
    });
  });

  test('Harus mengembalikan status 500 dengan pesan aman jika SDK Gemini mengalami gangguan server (crash)', async () => {
    const { req, res } = mockReqRes({ message: 'Halo' });

    mockGenerateContentFn.mockRejectedValue(new Error('Google Cloud Server Overloaded'));

    await chatController.chatWithGemini(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      text: 'Something went wrong while processing your request.',
      hasBento: false,
      bentoData: null,
    });
  });
});
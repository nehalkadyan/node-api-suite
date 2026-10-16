const request = require('supertest');
const app = require('../app');

describe('Application-Level Routes & Global Error Handlers', () => {
  describe('GET / (API Overview & Health Check)', () => {
    it('should return 200 with API status and directory of endpoints', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Welcome to Book & Auth REST API');
      expect(res.body).toHaveProperty('endpoints');
      expect(res.body.endpoints).toHaveProperty('auth');
      expect(res.body.endpoints).toHaveProperty('books');
      expect(res.body.endpoints.auth.register).toBe('POST /api/auth/register');
      expect(res.body.endpoints.auth.login).toBe('POST /api/auth/login');
      expect(res.body.endpoints.auth.me).toBe('GET /api/auth/me (Protected)');
      expect(res.body.endpoints.books.getAllBooks).toBe('GET /api/books');
      expect(res.body.endpoints.books.storeSingleBook).toBe('POST /api/books (Protected)');
    });
  });

  describe('404 Not Found Handler', () => {
    it('should return 404 with error message for non-existent GET route', async () => {
      const res = await request(app).get('/api/this-route-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found: GET /api/this-route-does-not-exist');
    });

    it('should return 404 with error message for non-existent POST route', async () => {
      const res = await request(app).post('/api/unknown-action').send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found: POST /api/unknown-action');
    });
  });
});

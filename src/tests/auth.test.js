const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const dbHandler = require('./dbHandler');

describe('Authentication APIs', () => {
  beforeAll(async () => {
    await dbHandler.connect();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  afterAll(async () => {
    await dbHandler.closeDatabase();
  });

  // =========================================================================
  // API 1: POST /api/auth/register
  // =========================================================================
  describe('1. POST /api/auth/register', () => {
    const validUserData = {
      name: 'Arthur Conan Doyle',
      email: 'arthur.doyle@example.com',
      password: 'secretPassword123',
      role: 'author',
      bio: 'Creator of Sherlock Holmes',
    };

    it('should successfully register a new author with all valid fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe(validUserData.name);
      expect(res.body.data.email).toBe(validUserData.email.toLowerCase());
      expect(res.body.data.role).toBe('author');
      expect(res.body.data.bio).toBe(validUserData.bio);
      expect(res.body.data.id).toBeDefined();

      // Ensure password is never exposed in response
      expect(res.body.data.password).toBeUndefined();

      // Verify user is persisted in MongoDB with hashed password
      const userInDb = await User.findOne({ email: validUserData.email.toLowerCase() }).select('+password');
      expect(userInDb).not.toBeNull();
      expect(userInDb.password).not.toBe(validUserData.password);
      expect(await userInDb.matchPassword(validUserData.password)).toBe(true);
    });

    it('should register successfully with only required fields and apply defaults', async () => {
      const minimalUser = {
        name: 'Jane Austen',
        email: 'jane.austen@example.com',
        password: 'password123',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(minimalUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('author'); // default role
      expect(res.body.data.bio).toBe(''); // default bio
    });

    it('should support registering with role "user" or "admin"', async () => {
      const adminUser = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(adminUser);

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('admin');
    });

    it('should fail with 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noname@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide name, email, and password');
    });

    it('should fail with 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'No Email',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide name, email, and password');
    });

    it('should fail with 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'No Password',
          email: 'nopass@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide name, email, and password');
    });

    it('should fail with 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide name, email, and password');
    });

    it('should fail with 400 when duplicate email is registered', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      const resDuplicate = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(resDuplicate.status).toBe(400);
      expect(resDuplicate.body.success).toBe(false);
      expect(resDuplicate.body.message).toBe('A user with this email already exists');
    });

    it('should fail with 400 when duplicate email is registered with different casing', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      const resUpper = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          email: validUserData.email.toUpperCase(),
        });

      expect(resUpper.status).toBe(400);
      expect(resUpper.body.success).toBe(false);
    });

    it('should fail with 400 validation error when email format is invalid', async () => {
      const invalidEmails = ['plainaddress', 'missingatdomain.com', '@nodomain.com'];

      for (const badEmail of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Invalid Email User',
            email: badEmail,
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('valid email');
      }
    });

    it('should fail with 400 validation error when password is less than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'shortpass@example.com',
          password: '12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Password must be at least 6 characters long');
    });

    it('should fail with 400 validation error when name exceeds 50 characters', async () => {
      const longName = 'A'.repeat(51);
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: longName,
          email: 'longname@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Name cannot exceed 50 characters');
    });

    it('should fail with 400 validation error when role is not an allowed enum', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Role',
          email: 'badrole@example.com',
          password: 'password123',
          role: 'superhero',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('is not a valid enum value for path `role`');
    });
  });

  // =========================================================================
  // API 2: POST /api/auth/login
  // =========================================================================
  describe('2. POST /api/auth/login', () => {
    const userCredentials = {
      name: 'Agatha Christie',
      email: 'agatha.christie@example.com',
      password: 'mysteryPassword456',
    };

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(userCredentials);
    });

    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User logged in successfully');
      expect(res.body).toHaveProperty('token');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(userCredentials.email.toLowerCase());
      expect(res.body.data.password).toBeUndefined();

      // Verify the JWT token can be decoded
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(res.body.data.id);
    });

    it('should allow login with uppercase / mixed case email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email.toUpperCase(),
          password: userCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(userCredentials.email.toLowerCase());
    });

    it('should fail with 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: userCredentials.password,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide email and password');
    });

    it('should fail with 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide email and password');
    });

    it('should fail with 400 when request body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide email and password');
    });

    it('should fail with 401 when email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should fail with 401 when password does not match', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: 'wrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  // =========================================================================
  // API 3: GET /api/auth/me
  // =========================================================================
  describe('3. GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'George Orwell',
          email: 'george.orwell@example.com',
          password: 'password1984',
          role: 'author',
          bio: 'English novelist and essayist',
        });

      token = res.body.token;
      userId = res.body.data.id;
    });

    it('should successfully return the authenticated user profile with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data._id).toBe(userId);
      expect(res.body.data.name).toBe('George Orwell');
      expect(res.body.data.email).toBe('george.orwell@example.com');
      expect(res.body.data.role).toBe('author');
      expect(res.body.data.bio).toBe('English novelist and essayist');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should fail with 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('no token provided');
    });

    it('should fail with 401 when Authorization header does not use Bearer scheme', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Basic ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('no token provided');
    });

    it('should fail with 401 when Authorization header is empty after Bearer', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with 401 when token is malformed or invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Not authorized, token failed or expired');
    });

    it('should fail with 401 when token is signed with a different secret', async () => {
      const rogueToken = jwt.sign({ id: userId }, 'completely_different_secret_key');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${rogueToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Not authorized, token failed or expired');
    });

    it('should fail with 401 when token has expired', async () => {
      const expiredToken = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Not authorized, token failed or expired');
    });

    it('should fail with 401 when user belonging to valid token has been deleted', async () => {
      // Delete the user from MongoDB
      await User.findByIdAndDelete(userId);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User belonging to this token no longer exists');
    });
  });
});

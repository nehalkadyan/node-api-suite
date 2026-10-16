const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Book = require('../models/Book');
const dbHandler = require('./dbHandler');

describe('Book Management APIs', () => {
  let authorToken;
  let authorUser;
  let secondAuthor;

  beforeAll(async () => {
    await dbHandler.connect();
  });

  beforeEach(async () => {
    // Seed primary author
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'J.R.R. Tolkien',
        email: 'tolkien@example.com',
        password: 'ringPassword123',
        role: 'author',
        bio: 'English author and philologist',
      });

    authorToken = regRes.body.token;
    authorUser = regRes.body.data;

    // Seed second author for testing explicit author attribution
    const secondRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'C.S. Lewis',
        email: 'cs.lewis@example.com',
        password: 'narniaPassword123',
        role: 'author',
        bio: 'Author of The Chronicles of Narnia',
      });

    secondAuthor = secondRes.body.data;
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  afterAll(async () => {
    await dbHandler.closeDatabase();
  });

  // =========================================================================
  // API 4: POST /api/books (Store a Single Book)
  // =========================================================================
  describe('4. POST /api/books', () => {
    const validBookData = {
      title: 'The Hobbit',
      description: 'A fantasy novel about Bilbo Baggins',
      price: 14.99,
      genre: 'Fantasy',
      publishedYear: 1937,
      inStock: true,
    };

    it('should successfully create a single book with all fields for authenticated author', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(validBookData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Book created successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe(validBookData.title);
      expect(res.body.data.description).toBe(validBookData.description);
      expect(res.body.data.price).toBe(validBookData.price);
      expect(res.body.data.genre).toBe(validBookData.genre);
      expect(res.body.data.publishedYear).toBe(validBookData.publishedYear);
      expect(res.body.data.inStock).toBe(true);
      // Author should be automatically linked to logged-in user
      expect(res.body.data.author).toBe(authorUser.id);

      // Verify book exists in database
      const bookInDb = await Book.findById(res.body.data._id);
      expect(bookInDb).not.toBeNull();
      expect(bookInDb.author.toString()).toBe(authorUser.id);
    });

    it('should successfully create a book with minimal required fields and apply defaults', async () => {
      const minimalBook = {
        title: 'The Fellowship of the Ring',
        price: 20.0,
      };

      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(minimalBook);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.genre).toBe('General'); // default genre
      expect(res.body.data.inStock).toBe(true); // default inStock
      expect(res.body.data.description).toBe(''); // default description
      expect(res.body.data.publishedYear).toBe(new Date().getFullYear()); // default current year
    });

    it('should successfully create a free book with price = 0 (boundary edge case)', async () => {
      const freeBook = {
        title: 'Free Open-Source Lore Guide',
        price: 0,
      };

      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(freeBook);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.price).toBe(0);
    });

    it('should allow providing an explicit author ID of another existing author', async () => {
      const explicitAuthorBook = {
        title: 'The Lion, the Witch and the Wardrobe',
        price: 18.5,
        author: secondAuthor.id,
      };

      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(explicitAuthorBook);

      expect(res.status).toBe(201);
      expect(res.body.data.author).toBe(secondAuthor.id);
    });

    it('should fail with 401 when no authorization token is provided', async () => {
      const res = await request(app)
        .post('/api/books')
        .send(validBookData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('no token provided');
    });

    it('should fail with 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          price: 15.0,
          genre: 'Fantasy',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide book title and price');
    });

    it('should fail with 400 when price is missing', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Book without price',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please provide book title and price');
    });

    it('should fail with 400 validation error when price is negative', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Negative Price Book',
          price: -5.99,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Price cannot be negative');
    });

    it('should fail with 400 validation error when title exceeds 150 characters', async () => {
      const longTitle = 'T'.repeat(151);
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: longTitle,
          price: 10.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Title cannot exceed 150 characters');
    });

    it('should fail with 404 when specified author does not exist in DB', async () => {
      const nonExistentAuthorId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Ghost Author Book',
          price: 12.0,
          author: nonExistentAuthorId,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(`Author not found with id: ${nonExistentAuthorId}`);
    });

    it('should fail with 404 CastError when specified author is an invalid ObjectId', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Invalid Author ID Format Book',
          price: 12.0,
          author: 'invalid-author-id-123',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Resource not found with id: invalid-author-id-123');
    });
  });

  // =========================================================================
  // API 5: POST /api/books/bulk (Store Multiple Books)
  // =========================================================================
  describe('5. POST /api/books/bulk', () => {
    const bulkBooksList = [
      {
        title: 'The Two Towers',
        description: 'Second volume of The Lord of the Rings',
        price: 21.5,
        genre: 'Fantasy',
        publishedYear: 1954,
        inStock: true,
      },
      {
        title: 'The Return of the King',
        description: 'Third volume of The Lord of the Rings',
        price: 23.0,
        genre: 'Fantasy',
        publishedYear: 1955,
        inStock: true,
      },
      {
        title: 'The Silmarillion',
        description: 'Mythological tales of the First Age',
        price: 25.0,
        genre: 'Mythology',
        publishedYear: 1977,
        inStock: false,
      },
    ];

    it('should successfully store multiple books using { books: [...] } wrapper', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ books: bulkBooksList });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);
      expect(res.body.message).toBe('Successfully stored 3 books');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Verify all items were attached to the logged-in author
      res.body.data.forEach((book) => {
        expect(book.author).toBe(authorUser.id);
      });

      // Verify in DB
      const countInDb = await Book.countDocuments({ author: authorUser.id });
      expect(countInDb).toBe(3);
    });

    it('should successfully store multiple books when body is a direct array [...]', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(bulkBooksList);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);
    });

    it('should allow custom author ID per item in bulk array', async () => {
      const mixedBooks = [
        {
          title: 'Book by primary author',
          price: 15.0,
        },
        {
          title: 'Book by second author',
          price: 17.0,
          author: secondAuthor.id,
        },
      ];

      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ books: mixedBooks });

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(2);
      expect(res.body.data[0].author).toBe(authorUser.id);
      expect(res.body.data[1].author).toBe(secondAuthor.id);
    });

    it('should fail with 401 when no token is provided', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .send({ books: bulkBooksList });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('no token provided');
    });

    it('should fail with 400 when books array is empty { books: [] }', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ books: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Please provide an array of books to store');
    });

    it('should fail with 400 when direct array is empty []', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send([]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Please provide an array of books to store');
    });

    it('should fail with 400 when books is not an array or empty body', async () => {
      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ books: 'invalid-string' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with 400 validation error when one book in the bulk list is invalid', async () => {
      const invalidBatch = [
        { title: 'Good Book', price: 10.0 },
        { title: '', price: 15.0 }, // Invalid: empty title
      ];

      const res = await request(app)
        .post('/api/books/bulk')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ books: invalidBatch });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Book title is required');
    });
  });

  // =========================================================================
  // API 6: GET /api/books (Get All Books with filtering & options)
  // =========================================================================
  describe('6. GET /api/books', () => {
    beforeEach(async () => {
      // Seed initial books for querying
      await Book.create([
        {
          title: 'The Hobbit',
          price: 14.99,
          genre: 'Fantasy',
          inStock: true,
          author: authorUser.id,
        },
        {
          title: 'Dune',
          price: 19.99,
          genre: 'Sci-Fi',
          inStock: true,
          author: authorUser.id,
        },
        {
          title: 'Foundation',
          price: 12.5,
          genre: 'Sci-Fi',
          inStock: false,
          author: secondAuthor.id,
        },
        {
          title: 'Harry Potter',
          price: 22.0,
          genre: 'Fantasy',
          inStock: false,
          author: secondAuthor.id,
        },
      ]);
    });

    it('should return empty list and count 0 when no books match in empty database', async () => {
      await Book.deleteMany({});

      const res = await request(app).get('/api/books');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toEqual([]);
    });

    it('should retrieve all books sorted by newest first (createdAt: -1)', async () => {
      const res = await request(app).get('/api/books');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(4);
      expect(res.body.data.length).toBe(4);

      // Verify descending creation order
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const current = new Date(res.body.data[i].createdAt).getTime();
        const next = new Date(res.body.data[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should filter books by exact genre', async () => {
      const res = await request(app).get('/api/books?genre=Fantasy');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      res.body.data.forEach((book) => {
        expect(book.genre).toBe('Fantasy');
      });
    });

    it('should filter books by genre case-insensitively and with partial regex match', async () => {
      const res = await request(app).get('/api/books?genre=sci');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      res.body.data.forEach((book) => {
        expect(book.genre).toBe('Sci-Fi');
      });
    });

    it('should return count 0 and empty data when genre filter has no matches', async () => {
      const res = await request(app).get('/api/books?genre=Horror');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toEqual([]);
    });

    it('should filter books by inStock=true', async () => {
      const res = await request(app).get('/api/books?inStock=true');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      res.body.data.forEach((book) => {
        expect(book.inStock).toBe(true);
      });
    });

    it('should filter books by inStock=false', async () => {
      const res = await request(app).get('/api/books?inStock=false');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      res.body.data.forEach((book) => {
        expect(book.inStock).toBe(false);
      });
    });

    it('should support combined filtering by genre AND inStock', async () => {
      const res = await request(app).get('/api/books?genre=Fantasy&inStock=true');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].title).toBe('The Hobbit');
    });

    it('should populate author details when includeAuthor=true query param is set', async () => {
      const res = await request(app).get('/api/books?includeAuthor=true');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(4);
      const firstBook = res.body.data[0];
      expect(typeof firstBook.author).toBe('object');
      expect(firstBook.author).toHaveProperty('name');
      expect(firstBook.author).toHaveProperty('email');
      expect(firstBook.author).toHaveProperty('role');
      expect(firstBook.author.password).toBeUndefined();
    });

    it('should NOT populate author details when includeAuthor is not set', async () => {
      const res = await request(app).get('/api/books');

      expect(res.status).toBe(200);
      const firstBook = res.body.data[0];
      // author should be an ObjectId string, not a populated object
      expect(typeof firstBook.author).toBe('string');
    });
  });

  // =========================================================================
  // API 7: GET /api/books/with-author (Get All Books with Author Populated)
  // =========================================================================
  describe('7. GET /api/books/with-author', () => {
    it('should return empty list and count 0 when no books exist in DB', async () => {
      const res = await request(app).get('/api/books/with-author');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.message).toBe('Fetched all books with author details successfully');
      expect(res.body.data).toEqual([]);
    });

    it('should retrieve all books with full populated author details', async () => {
      await Book.create({
        title: 'Out of the Silent Planet',
        description: 'First book of the Space Trilogy',
        price: 16.99,
        genre: 'Sci-Fi',
        author: secondAuthor.id,
      });

      const res = await request(app).get('/api/books/with-author');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.message).toBe('Fetched all books with author details successfully');

      const book = res.body.data[0];
      expect(book.title).toBe('Out of the Silent Planet');
      expect(typeof book.author).toBe('object');
      expect(book.author._id).toBe(secondAuthor.id);
      expect(book.author.name).toBe(secondAuthor.name);
      expect(book.author.email).toBe(secondAuthor.email);
      expect(book.author.role).toBe(secondAuthor.role);
      expect(book.author.bio).toBe(secondAuthor.bio);
      expect(book.author).toHaveProperty('createdAt');
      expect(book.author.password).toBeUndefined();
    });
  });

  // =========================================================================
  // API 8: GET /api/books/:id (Get Single Book by ID)
  // =========================================================================
  describe('8. GET /api/books/:id', () => {
    let createdBook;

    beforeEach(async () => {
      createdBook = await Book.create({
        title: 'The Lord of the Rings',
        description: 'Epic high-fantasy novel',
        price: 35.0,
        genre: 'Fantasy',
        author: authorUser.id,
      });
    });

    it('should successfully retrieve a single book by valid ID with populated author', async () => {
      const res = await request(app).get(`/api/books/${createdBook._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data._id).toBe(createdBook._id.toString());
      expect(res.body.data.title).toBe('The Lord of the Rings');
      expect(res.body.data.price).toBe(35.0);
      expect(typeof res.body.data.author).toBe('object');
      expect(res.body.data.author._id).toBe(authorUser.id);
      expect(res.body.data.author.name).toBe(authorUser.name);
      expect(res.body.data.author.email).toBe(authorUser.email);
      expect(res.body.data.author.password).toBeUndefined();
    });

    it('should return 404 when book ID is a valid 24-char ObjectId but does not exist in DB', async () => {
      const nonExistentBookId = new mongoose.Types.ObjectId().toString();

      const res = await request(app).get(`/api/books/${nonExistentBookId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(`Book not found with id: ${nonExistentBookId}`);
    });

    it('should return 404 CastError when book ID is not a valid ObjectId format', async () => {
      const res = await request(app).get('/api/books/invalid-mongodb-id-999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Resource not found with id: invalid-mongodb-id-999');
    });
  });
});

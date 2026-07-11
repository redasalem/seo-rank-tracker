import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-key';



// Start the in-memory MongoDB instance before all tests
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

// Clean up database between each test
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});

// Disconnect and stop the server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
      await mongoServer.stop();
  }
});

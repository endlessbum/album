// Force unit tests to run without a real database connection
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Ensure DATABASE_URL is not set so server/db falls back to in-memory mode
if (process.env.DATABASE_URL) {
  delete process.env.DATABASE_URL;
}

// Optionally, provide a minimal window for utils that rely on it
if (!(globalThis as any).window) {
  (globalThis as any).window = { location: { protocol: 'http:', host: 'localhost:5000', port: '5000' } } as any;
}

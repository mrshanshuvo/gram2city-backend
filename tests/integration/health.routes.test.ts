import request from 'supertest';
import app from '../../src/app';

describe('Health & Diagnostic Endpoints', () => {
  it('GET / returns 200 with service welcome message', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Gram2City');
    expect(res.body.version).toBe('2.3.0');
  });

  it('GET /health returns 200 with diagnostic metrics and database state', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('memoryUsageMB');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.environment).toBeDefined();
  });
});

import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/utils/jwt';

describe('Cloudinary Signed Upload Endpoints (POST /upload/signature)', () => {
  const validToken = generateAccessToken({ email: 'user@example.com', role: 'user' });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/upload/signature').send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Unauthorized');
  });

  it('rejects disallowed folder names with 400 validation error', async () => {
    const res = await request(app)
      .post('/upload/signature')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ folder: 'malicious/folder/path' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns valid signature, timestamp, apiKey, and cloudName for default folder', async () => {
    const res = await request(app)
      .post('/upload/signature')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('signature');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('apiKey');
    expect(res.body.data).toHaveProperty('cloudName');
    expect(res.body.data.folder).toBe('gram2city/chat');
    expect(typeof res.body.data.signature).toBe('string');
    expect(res.body.data.signature.length).toBeGreaterThan(10);
  });

  it('returns valid signature for allowed custom folder (e.g. gram2city/parcels)', async () => {
    const res = await request(app)
      .post('/upload/signature')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ folder: 'gram2city/parcels' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.folder).toBe('gram2city/parcels');
    expect(res.body.data).toHaveProperty('signature');
  });
});

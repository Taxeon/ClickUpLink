const request = require('supertest');
const app = require('./index');

// Mock environment variables
process.env.CLICKUP_CLIENT_SECRET = 'test_secret';
process.env.CLICKUP_CLIENT_ID = 'test_client_id';

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('Auth Service API', () => {
  // Health check endpoint
  test('GET /health - should return status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  // Token exchange endpoint
  test('POST /api/token-exchange - should exchange code for tokens', async () => {
    // Mock successful response from ClickUp
    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 3600
      }
    });

    const response = await request(app)
      .post('/api/token-exchange')
      .send({
        code: 'test_code',
        redirectUri: 'clickuplink://auth'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body).toHaveProperty('expires_in');
  });

  // Token refresh endpoint
  test('POST /api/token-refresh - should refresh tokens', async () => {
    // Mock successful response from ClickUp
    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600
      }
    });

    const response = await request(app)
      .post('/api/token-refresh')
      .send({
        refreshToken: 'test_refresh_token'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.access_token).toBe('new_access_token');
    expect(response.body.refresh_token).toBe('new_refresh_token');
  });

  // Error handling tests
  test('POST /api/token-exchange - should handle missing parameters', async () => {
    const response = await request(app)
      .post('/api/token-exchange')
      .send({});
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/token-refresh - should handle ClickUp API errors', async () => {
    // Mock error response from ClickUp
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: 'invalid_grant' }
      }
    });

    const response = await request(app)
      .post('/api/token-refresh')
      .send({
        refreshToken: 'invalid_token'
      });
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  // Test handling of incomplete response from ClickUp
  test('POST /api/token-exchange - should handle incomplete response from ClickUp', async () => {
    // Mock response with missing refresh_token
    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'test_access_token',
        // refresh_token is missing
        expires_in: 3600
      }
    });

    const response = await request(app)
      .post('/api/token-exchange')
      .send({
        code: 'test_code',
        redirectUri: 'clickuplink://auth'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('access_token', 'test_access_token');
    expect(response.body).toHaveProperty('refresh_token', null);
    expect(response.body).toHaveProperty('expires_in', 3600);
  });
});

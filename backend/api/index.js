require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Environment Variables Validation
if (!process.env.CLICKUP_CLIENT_SECRET) {
  console.error('ERROR: CLICKUP_CLIENT_SECRET environment variable is not set!');
  process.exit(1);
}

// Endpoints
app.post('/api/token-exchange', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
      if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing code or redirect URI' });
    }
    
    // Exchange code for tokens using ClickUp OAuth endpoint
    const response = await axios.post(
      'https://api.clickup.com/api/v2/oauth/token',
      {
        client_id: process.env.CLICKUP_CLIENT_ID ,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    // Log the complete response for debugging
    console.log('ClickUp API token response:', JSON.stringify(response.data, null, 2));
    
    // Extract the tokens, providing defaults for potentially missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || null;
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour
    
    if (!access_token) {
      console.error('Missing access_token in ClickUp response');
      return res.status(500).json({ error: 'Invalid response from ClickUp: missing access_token' });
    }
    
    return res.json({ access_token, refresh_token, expires_in });
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Token exchange failed', 
      message: error.response?.data?.error || error.message 
    });
  }
});

app.post('/api/token-refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }
    
    // Refresh access token using ClickUp OAuth endpoint
    const response = await axios.post(
      'https://api.clickup.com/api/v2/oauth/token',
      {
        client_id: process.env.CLICKUP_CLIENT_ID ,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
      // Log the complete response for debugging
    console.log('ClickUp API refresh token response:', JSON.stringify(response.data, null, 2));
    
    // Extract the tokens, providing defaults for potentially missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || refreshToken; // Use old token if not provided
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour
    
    if (!access_token) {
      console.error('Missing access_token in ClickUp refresh response');
      return res.status(500).json({ error: 'Invalid response from ClickUp: missing access_token' });
    }
    
    return res.json({ access_token, refresh_token, expires_in });
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Token refresh failed', 
      message: error.response?.data?.error || error.message 
    });
  }
});

// OAuth callback endpoint
app.get('/oauth/callback', (req, res) => {
  const { code, error } = req.query;
  
  // Create a simple HTML page to handle the callback and pass the code back to the extension
  let htmlResponse = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>ClickUpLink Authentication</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .card {
        background: #fff;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 20px;
        margin-top: 40px;
        text-align: center;
      }
      h1 {
        color: #5E6AD2;
        margin-bottom: 10px;
      }
      .success { color: #2ecc71; }
      .error { color: #e74c3c; }
      .code {
        font-family: monospace;
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
        word-break: break-all;
      }
      .instructions {
        margin: 20px 0;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>ClickUpLink Authentication</h1>
      ${error 
        ? `<p class="error">Authentication Error: ${error}</p>` 
        : `<p class="success">Authentication Successful!</p>
           <p>Your authorization code:</p>
           <div class="code">${code}</div>
           <div class="instructions">
             <p>Return to VS Code and paste this code when prompted.</p>
             <p>If VS Code didn't open automatically, manually open it and run the authentication process again.</p>
           </div>`
      }
    </div>
  </body>
  </html>
  `;
  
  res.send(htmlResponse);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ClickUpLink Auth Service' });
});

// Start server
app.listen(PORT, () => {
  console.log(`ClickUpLink Auth Service running on port ${PORT}`);
});

module.exports = app; // Export for testing

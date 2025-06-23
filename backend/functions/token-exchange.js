const axios = require('axios');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { code, redirectUri } = JSON.parse(event.body);
    
    if (!code || !redirectUri) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or redirect URI' })
      };
    }

    // Exchange code for tokens using ClickUp OAuth endpoint
    const response = await axios.post(
      'https://api.clickup.com/api/v2/oauth/token',
      {
        client_id: process.env.CLICKUP_CLIENT_ID || 'N2QC5GLR8EEIRPSBAPGF4HX9QXLG7CBC',
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Extract the tokens, providing defaults for potentially missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || null;
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour

    if (!access_token) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Invalid response from ClickUp: missing access_token' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ access_token, refresh_token, expires_in })
    };
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({ 
        error: 'Token exchange failed', 
        message: error.response?.data?.error || error.message 
      })
    };
  }
};

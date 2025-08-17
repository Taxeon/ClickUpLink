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
    const { refreshToken } = JSON.parse(event.body);
    
    if (!refreshToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing refresh token' })
      };
    }

    // Verify client_secret is available
    if (!process.env.CLICKUP_CLIENT_SECRET) {
      console.error('CLICKUP_CLIENT_SECRET environment variable is not set!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error',
          message: 'OAuth client secret is not configured'
        })
      };
    }

    // Log the token refresh attempt (without exposing the actual token)
    console.log(`Attempting to refresh token with refresh token (starting with: ${refreshToken.substring(0, 5)}...)`);

    // Refresh access token using ClickUp OAuth endpoint
    const response = await axios.post(
      'https://api.clickup.com/api/v2/oauth/token',
      {
        client_id: process.env.CLICKUP_CLIENT_ID || 'N2QC5GLR8EEIRPSBAPGF4HX9QXLG7CBC',
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('Token refresh response received', {
      status: response.status,
      hasData: !!response.data,
      hasAccessToken: !!response.data?.access_token
    });

    // Extract the tokens, providing defaults for potentially missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || refreshToken; // Use old token if not provided
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour

    if (!access_token) {
      console.error('Missing access_token in ClickUp response:', response.data);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid response from ClickUp: missing access_token',
          details: response.data 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ access_token, refresh_token, expires_in })
    };
  } catch (error) {
    console.error('Token refresh error:', {
      message: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      stackTrace: error.stack
    });
    
    let errorMessage = 'Token refresh failed';
    let errorDetails = error.message;
    
    // Enhanced error details for better debugging
    if (error.response) {
      // The request was made and the server responded with a status code
      errorMessage = `ClickUp API error (${error.response.status})`;
      errorDetails = error.response.data?.error_description || 
                    error.response.data?.error ||
                    error.response.data?.message ||
                    'Unknown API error';
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'No response from ClickUp API';
      errorDetails = 'Network or timeout issue';
    } else {
      // Something happened in setting up the request
      errorMessage = 'Request setup error';
      errorDetails = error.message;
    }

    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({ 
        error: errorMessage, 
        message: errorDetails,
        details: error.response?.data || {}
      })
    };
  }
};

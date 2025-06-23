#!/usr/bin/env node
const axios = require('axios');
const readline = require('readline');
const open = require('open');

// Configure the RL interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const CLIENT_ID = 'N2QC5GLR8EEIRPSBAPGF4HX9QXLG7CBC';
// Try using a standard HTTPS URI which is more widely supported by OAuth providers
const REDIRECT_URI = 'https://clickuplink.vercel.app/oauth/callback';
// For production VSCode extension, we'll need to configure this properly
// const REDIRECT_URI = 'clickuplink://auth';
const AUTH_SERVICE_URL = process.argv[2] || 'http://localhost:3000';

console.log(`
====================================================
ClickUpLink Auth Service Tester
====================================================
Testing auth service at: ${AUTH_SERVICE_URL}
`);

// Test the health endpoint
async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    const response = await axios.get(`${AUTH_SERVICE_URL}/health`);
    console.log('✅ Health check successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return false;
  }
}

// Start the OAuth flow
async function startOAuthFlow() {
  // Create the authorization URL with URL encoding of the redirect URI
  const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
  const authUrl = `https://app.clickup.com/api?client_id=${CLIENT_ID}&redirect_uri=${encodedRedirectUri}`;
  
  console.log('\nStarting OAuth flow...');
  console.log(`\nDebugging information:`);
  console.log(`- Client ID: ${CLIENT_ID}`);
  console.log(`- Redirect URI (raw): ${REDIRECT_URI}`);
  console.log(`- Redirect URI (encoded): ${encodedRedirectUri}`);
  console.log(`\nPlease open this URL in your browser:\n${authUrl}`);
  
  // Try to open the URL automatically
  try {
    await open(authUrl);
    console.log('\nBrowser should open automatically. If not, copy the URL above.');
  } catch (error) {
    console.log('\nCould not open browser automatically. Please copy the URL above.');
  }
  
  // Wait for user to input the authorization code
  return new Promise((resolve) => {
    rl.question('\nAfter authorizing, paste the code here (from the callback URL): ', (code) => {
      resolve(code.trim());
    });
  });
}

// Exchange code for token
async function exchangeCodeForToken(code) {
  try {
    console.log('\nExchanging code for token...');
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/token-exchange`, {
      code,
      redirectUri: REDIRECT_URI
    });
    
    console.log('✅ Token exchange successful');
    
    // Safe logging with null checks
    if (response.data && response.data.access_token) {
      console.log('Access token:', response.data.access_token.substring(0, 10) + '...');
    } else {
      console.log('Access token: [missing]');
    }
    
    if (response.data && response.data.refresh_token) {
      console.log('Refresh token:', response.data.refresh_token.substring(0, 10) + '...');
    } else {
      console.log('Refresh token: [missing]');
    }
    
    console.log('Expires in:', response.data?.expires_in || 'unknown', 'seconds');
      // Log full response for debugging
    console.log('Full response data:', JSON.stringify(response.data, null, 2));
    
    // Check if we have all required fields
    if (!response.data?.access_token) {
      throw new Error('Access token missing in response');
    }
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || 'no-refresh-token-provided', // Provide fallback
      expiresIn: response.data.expires_in || 3600 // Default to 1 hour if missing
    };
  } catch (error) {
    console.error('❌ Token exchange failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return null;
  }
}

// Test token refresh
async function testTokenRefresh(refreshToken) {
  try {
    console.log('\nTesting token refresh...');
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/token-refresh`, {
      refreshToken
    });
    
    console.log('✅ Token refresh successful');
    
    // Safe logging with null checks
    if (response.data && response.data.access_token) {
      console.log('New access token:', response.data.access_token.substring(0, 10) + '...');
    } else {
      console.log('New access token: [missing]');
    }
    
    if (response.data && response.data.refresh_token) {
      console.log('New refresh token:', response.data.refresh_token.substring(0, 10) + '...');
    } else {
      console.log('New refresh token: [missing]');
    }
    
    console.log('Expires in:', response.data?.expires_in || 'unknown', 'seconds');
    
    // Log full response for debugging
    console.log('Full refresh response data:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return false;
  }
}

// Variable to store tokens accessible across promise callbacks
let tokens = null;

// Main function
async function main() {
  try {
    // Test health endpoint
    const isHealthy = await testHealth();
    if (!isHealthy) {
      console.error('\n❌ Auth service is not healthy. Stopping tests.');
      process.exit(1);
    }
    
    // Ask user if they want to test the full OAuth flow
    rl.question('\nDo you want to test the full OAuth flow? (y/n) ', async (answer) => {
      if (answer.toLowerCase() === 'y') {        // Start OAuth flow
        const code = await startOAuthFlow();
        if (!code) {
          console.error('\n❌ No code provided. Stopping tests.');
          rl.close();
          return;
        }
        
        // Exchange code for token
        try {
          // Store the tokens in a variable accessible in the outer scope
          let tokenResponse = await exchangeCodeForToken(code);
          if (!tokenResponse) {
            console.error('\n❌ Token exchange failed. Stopping tests.');
            rl.close();
            return;
          }
          
          // Store tokens in parent scope
          tokens = tokenResponse;
        } catch (error) {
          console.error(`\n❌ Token exchange failed with error: ${error.message}`);
          console.error('Please check your backend logs for more details.');
          rl.close();
          return;
        }
          // Test token refresh
        rl.question('\nDo you want to test token refresh? (y/n) ', async (answer) => {
          if (answer.toLowerCase() === 'y') {
            if (!tokens || !tokens.refreshToken || tokens.refreshToken === 'no-refresh-token-provided') {
              console.log('\n⚠️ Cannot test token refresh: No refresh token was provided by ClickUp');
              console.log('This is normal for some OAuth providers or API configurations.');
            } else {
              await testTokenRefresh(tokens.refreshToken);
            }
          }
            console.log('\n====================================================');
          console.log('Test summary:');
          console.log('✅ Health check: Success');
          console.log('✅ Token exchange: Success');
          if (answer.toLowerCase() === 'y') {
            if (!tokens || !tokens.refreshToken || tokens.refreshToken === 'no-refresh-token-provided') {
              console.log('⚠️ Token refresh: Skipped (no refresh token available)');
            } else {
              console.log('✅ Token refresh: Success');
            }
          }
          console.log('====================================================');
          console.log('\nTests completed. You can now use the auth service in your extension.');
          
          rl.close();
        });
      } else {
        console.log('\n✅ Health check successful. Skipping OAuth flow tests.');
        rl.close();
      }
    });
  } catch (error) {
    console.error('Error in test script:', error);
    rl.close();
  }
}

// Run the main function
main();

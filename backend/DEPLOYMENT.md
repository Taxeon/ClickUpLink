# Deploying the ClickUpLink Auth Service

This guide explains how to deploy the ClickUpLink Auth Service to Vercel, which offers a free tier perfect for this type of microservice.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Node.js installed on your machine
3. The ClickUp Client Secret from your OAuth app

## Deployment Steps

### 1. Prepare your project

The backend directory is structured for deployment to Vercel.

### 2. Install Vercel CLI (optional)

```
npm install -g vercel
```

### 3. Deploy using Vercel CLI

Navigate to the backend directory:

```
cd backend
```

Run the deployment command:

```
vercel
```

Follow the prompts:
- Select your Vercel account
- Confirm the project name (or change it)
- Confirm it's already a Vercel project

### 4. Set environment variables

After deployment, set your environment variables in the Vercel project settings:

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" > "Environment Variables"
4. Add the following:
   - `CLICKUP_CLIENT_SECRET`: Your ClickUp client secret
   - `CLICKUP_CLIENT_ID`: Your ClickUp client ID (should be `XT30CLT9QUIDSAVN6YHYC9SQ44BXG3UK`)

### 5. Redeploy with environment variables

```
vercel --prod
```

### 6. Update your extension code

In `src/utils/tokenStorage.ts`, update the `AUTH_SERVICE_URL` constant to your Vercel deployment URL, such as:

```typescript
const AUTH_SERVICE_URL = 'https://clickuplink-auth.vercel.app';
```

## Testing Your Deployment

### Option 1: Quick Health Check

Test that your service is working by making a request to the health endpoint:

```
curl https://clickuplink.vercel.app/health
```

You should receive: `{"status":"ok","service":"ClickUpLink Auth Service"}`

### Option 2: Full OAuth Flow Test

We've included a test script to verify your deployment and test the full OAuth flow:

1. Install the test script dependencies:

```
npm install
```

2. Run the test script, providing your deployed service URL:

```
npm run test-auth -- https://your-service-url.vercel.app
```

3. Follow the prompts to:
   - Check the health endpoint
   - Go through the OAuth authorization flow
   - Exchange the authorization code for tokens
   - Test token refreshing

This will confirm that your auth service is working correctly with ClickUp's OAuth API.

## OAuth Callback Handler

The backend now includes an OAuth callback handler at `/oauth/callback` that:

1. Receives the authorization code from ClickUp after user authorization
2. Displays a simple page showing the authorization code
3. Allows the user to copy the code back to the extension

### Testing the OAuth Flow

You can use the included OAuth test page to verify your deployment:

1. Deploy the backend service
2. Open `oauth-test.html` locally in your browser or deploy it
3. Click the test links to try different OAuth flows
4. Check the backend logs for any errors

### OAuth Redirect URIs

Two types of redirect URIs are supported:

1. **Custom Protocol URI**: `clickuplink://auth`
   - Used for direct integration with the VSCode extension
   - Requires protocol handler registration in the extension

2. **HTTPS Callback URI**: `https://your-service-url.vercel.app/oauth/callback`
   - More widely supported by OAuth providers
   - Returns the auth code in a web page for the user to copy

## Using Anchor Tags for ClickUp Task References

You can insert a ClickUp task reference by adding a comment to your code with the following format:

```
//Clickup:[taskid]
```

Replace `[taskid]` with the actual ID of the task. The extension will recognize this pattern and provide a link to the task.

## Troubleshooting Deployment

### Common Issues

- **CORS Issues**: If you experience CORS issues, check that your client is sending the correct Origin header
- **Error Responses**: Check Vercel logs for detailed error messages
- **Environment Variables**: Verify that environment variables are properly set

### Vercel Project Name Error

If you get an error like:
```
Error: Project names must be lowercase. (400)
```

Make sure to use a lowercase project name like `clickuplink-auth` or `clickup-link-auth`.

## Alternative Deployment Options

### Deploy to Netlify

1. Push your code to a Git repository
2. Connect Netlify to your repository
3. Configure build settings:
   - Build command: (leave blank)
   - Publish directory: (leave blank)
4. Set environment variables in Netlify settings

### Deploy to Azure Functions

1. Install Azure Functions Core Tools
2. Create a function app in Azure Portal
3. Deploy using Azure CLI or VS Code Azure extension
4. Set application settings in Azure Portal

## Troubleshooting

- **CORS Issues**: If you experience CORS issues, check that your client is sending the correct Origin header
- **Error Responses**: Check Vercel logs for detailed error messages
- **Environment Variables**: Verify that environment variables are properly set

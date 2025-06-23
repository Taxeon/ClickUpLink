# Backend Auth Service for ClickUpLink

This service provides secure OAuth2 token exchange for the ClickUpLink VSCode extension.

## Setup

1. Install dependencies:
```
npm install
```

2. Create a `.env` file with:
```
CLICKUP_CLIENT_SECRET=your_client_secret_here
CLICKUP_CLIENT_ID=XT30CLT9QUIDSAVN6YHYC9SQ44BXG3UK
PORT=3000
```

3. Run the server:
```
npm start
```

For development:
```
npm run dev
```

## API Endpoints

### Exchange Authorization Code for Tokens
```
POST /api/token-exchange
```
Body:
```json
{
  "code": "authorization_code",
  "redirectUri": "ClickUpLink://auth"
}
```

**Note:** ClickUp's API may not return refresh tokens or expiry information in all cases. This service handles this gracefully by providing default values.

### Refresh Access Token
```
POST /api/token-refresh
```
Body:
```json
{
  "refreshToken": "refresh_token"
}
```

### Health Check
```
GET /health
```

## OAuth2 Token Behavior

The ClickUp API has some specific behaviors to be aware of:

1. **Access Tokens Only**: In some cases, ClickUp only returns an access token without a refresh token.
2. **No Expiry Information**: The API might not include token expiry information.
3. **Token Handling**: This service adds default values where needed to ensure consistent behavior.

These are handled as follows:

- Missing refresh tokens: Returned as `null` to the client
- Missing expiry: Default to 3600 seconds (1 hour)
- Error cases: Appropriate error messages are provided

## Deployment

This service is designed to be deployed to platforms like:
- Vercel
- Netlify
- Azure Functions
- Heroku

See individual platform documentation for deployment instructions.

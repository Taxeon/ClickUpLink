exports.handler = async (event, context) => {
  const { code, error } = event.queryStringParameters || {};
  
  // Create a simple HTML page to handle the callback
  const htmlResponse = `
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
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: htmlResponse
  };
};

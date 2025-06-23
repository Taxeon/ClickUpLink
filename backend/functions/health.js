exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      status: 'ok', 
      service: 'ClickUpLink Auth Service',
      platform: 'Netlify' 
    })
  };
};

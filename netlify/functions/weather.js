// Netlify serverless function for weather API
// This function proxies requests to WeatherAPI with the API key

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the API key from environment variable
    const API_KEY = process.env.VITE_WEATHERAPI_KEY || '63d741f83d334782a6332945252810';
    
    // Get the path from the query string
    const { path, q } = event.queryStringParameters || {};
    
    if (!path || !q) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing parameters' })
      };
    }

    // Construct the WeatherAPI URL
    const weatherAPIUrl = `https://api.weatherapi.com/v1/${path}?key=${API_KEY}&q=${encodeURIComponent(q)}`;
    
    // Add additional query parameters from event
    const additionalParams = new URLSearchParams(event.queryStringParameters);
    additionalParams.delete('path');
    additionalParams.delete('q');
    
    const fullUrl = weatherAPIUrl + (additionalParams.toString() ? '&' + additionalParams.toString() : '');

    // Make the request to WeatherAPI
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: 'Weather API error',
          details: errorText 
        })
      };
    }

    const data = await response.json();

    // Return the data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};


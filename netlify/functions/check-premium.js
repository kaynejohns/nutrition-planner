// netlify/functions/check-premium.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    const store = getStore('user-data');
    const premiumData = await store.getJSON(`premium-${userId}`);

    return {
      statusCode: 200,
      body: JSON.stringify(premiumData || { isPremium: false }),
    };
  } catch (error) {
    console.error('Error checking premium status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};


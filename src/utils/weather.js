// Weather API utility - Uses WeatherAPI via secure proxy
const API_BASE = '/api/weather';

// Fetch current weather by city name
export async function fetchWeatherByCity(cityName) {
  try {
    const response = await fetch(
      `${API_BASE}/current.json?q=${encodeURIComponent(cityName)}&aqi=no`
    );
    
    if (!response.ok) {
      throw new Error('Weather fetch failed');
    }
    
    const data = await response.json();
    return {
      temp: data.current.temp_c,
      humidity: data.current.humidity,
      description: data.current.condition.text,
      city: data.location.name,
      country: data.location.country,
      icon: data.current.condition.icon,
      timezone: data.location.tz_id
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}

// Fetch forecast by city name
export async function fetchForecastByCity(cityName) {
  try {
    const response = await fetch(
      `${API_BASE}/forecast.json?q=${encodeURIComponent(cityName)}&days=7&aqi=no&alerts=no`
    );
    
    if (!response.ok) {
      throw new Error('Forecast fetch failed');
    }
    
    const data = await response.json();
    
    // Group forecasts by date
    const summary = {};
    
    data.forecast.forecastday.forEach(day => {
      const dateKey = day.date; // Already in YYYY-MM-DD format
      
      const avgTemp = day.day.avgtemp_c;
      const avgHumidity = day.day.avghumidity;
      const condition = day.day.condition.text;
      
      summary[dateKey] = {
        avgTemp: Math.round(avgTemp),
        avgHumidity: Math.round(avgHumidity),
        condition: condition,
        forecasts: day.hour.map(hour => ({
          time: hour.time,
          temp: hour.temp_c,
          humidity: hour.humidity,
          description: hour.condition.text
        }))
      };
    });
    
    return summary;
  } catch (error) {
    console.error('Forecast fetch error:', error);
    return null;
  }
}

// Calculate hydration needs based on weather
export function calculateHydrationNeeds(temp, humidity, duration, sweatRate = 0.8) {
  // Heat index calculation
  const heatIndex = temp > 27 ? temp + (humidity / 100) * 2 : temp;
  
  // Environmental factor (0.5 to 1.5)
  const envFactor = 0.7 + (heatIndex - 15) / 40;
  const adjustedSweatRate = sweatRate * envFactor;
  
  // Fluid needs in ml/h
  const fluidPerHour = Math.max(300, Math.min(1200, adjustedSweatRate * 1000 * 0.7));
  
  // Sodium needs (increases with temperature)
  const baseSodiumPerL = 500;
  const tempSodium = Math.max(0, temp - 20) * 50;
  const sodiumPerL = baseSodiumPerL + tempSodium;
  
  return {
    fluidPerHour: Math.round(fluidPerHour),
    sodiumPerHour: Math.round(sodiumPerL * (fluidPerHour / 1000)),
    heatIndex: Math.round(heatIndex)
  };
}

// Weather API utility - Uses WeatherAPI via secure proxy in dev, Netlify function in prod

// Fetch current weather by city name
export async function fetchWeatherByCity(cityName) {
  try {
    const url = import.meta.env.PROD
      ? `/.netlify/functions/weather?path=current.json&q=${encodeURIComponent(cityName)}&aqi=no`
      : `/api/weather/current.json?q=${encodeURIComponent(cityName)}&aqi=no`;
    
    console.log('Fetching weather from:', url);
    const response = await fetch(url);
    
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
    const url = import.meta.env.PROD
      ? `/.netlify/functions/weather?path=forecast.json&q=${encodeURIComponent(cityName)}&days=7&aqi=no&alerts=no`
      : `/api/weather/forecast.json?q=${encodeURIComponent(cityName)}&days=7&aqi=no&alerts=no`;
    
    console.log('Fetching forecast from:', url);
    const response = await fetch(url);
    
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
// Now uses premium sodium calculation system
export function calculateHydrationNeeds(temp, humidity, duration, effectiveSweatRate = 1.2, options = {}) {
  // Default options
  const {
    baselineSweatRate = 1.2,
    baselineNaPerL = 900,
    intensitySweatMult = 1.0,
    intensityNaMult = 1.0,
    heatAcclimationMult = 1.0
  } = options;
  
  // Temperature multiplier for sweat rate
  let tempMult = 1.0;
  if (temp <= 15) tempMult = 0.85; // Cool
  else if (temp >= 35) tempMult = 1.40; // Very hot
  else if (temp >= 29) tempMult = 1.25; // Hot
  else if (temp >= 23) tempMult = 1.10; // Warm
  else tempMult = 1.00; // Temperate
  
  // Calculate effective sweat rate
  const effectiveSR = effectiveSweatRate * tempMult;
  
  // Calculate effective sodium concentration
  const effectiveNa = baselineNaPerL * intensityNaMult * heatAcclimationMult;
  
  // Fluid needs in ml/h (target 70% replacement)
  const fluidPerHour = Math.round(effectiveSR * 1000 * 0.7);
  
  // Sodium needs in mg/h
  const sodiumPerHour = Math.round(effectiveSR * effectiveNa);
  
  return {
    fluidPerHour: Math.max(300, Math.min(1200, fluidPerHour)),
    sodiumPerHour: sodiumPerHour,
    effectiveSweatRate: effectiveSR,
    tempMultiplier: tempMult
  };
}

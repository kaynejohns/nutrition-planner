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

// Fetch hourly forecast by city name with date range
export async function fetchHourlyForecastByCity(cityName, fromDate, toDate) {
  try {
    const url = import.meta.env.PROD
      ? `/.netlify/functions/weather?path=forecast.json&q=${encodeURIComponent(cityName)}&days=14&aqi=no&alerts=no`
      : `/api/weather/forecast.json?q=${encodeURIComponent(cityName)}&days=14&aqi=no&alerts=no`;
    
    console.log('Fetching hourly forecast from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Forecast fetch failed');
    }
    
    const data = await response.json();
    
    // Extract hourly data and flatten into array
    const hourlyPoints = [];
    
    data.forecast.forecastday.forEach(day => {
      day.hour.forEach(hour => {
        hourlyPoints.push({
          time: hour.time,
          tempC: hour.temp_c,
          feelsLikeC: hour.feelslike_c,
          dewpointC: hour.dewpoint_c || hour.temp_c - 5, // Estimate if not provided
          humidity: hour.humidity,
          windKph: hour.wind_kph,
          gustKph: hour.gust_kph || hour.wind_kph * 1.3,
          precipMm: hour.precip_mm,
          cloud: hour.cloud,
          condition: hour.condition.text,
          icon: hour.condition.icon
        });
      });
    });
    
    // Filter by date range if provided
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      return hourlyPoints.filter(point => {
        const pointTime = new Date(point.time);
        return pointTime >= from && pointTime <= to;
      });
    }
    
    return hourlyPoints;
  } catch (error) {
    console.error('Hourly forecast fetch error:', error);
    return [];
  }
}

/**
 * Get weather at a specific datetime from hourly forecast data
 * @param {string} datetime - ISO datetime string (e.g., '2024-01-15T07:00:00')
 * @param {Array} hourlyData - Array of hourly forecast points
 * @returns {Object|null} Weather snapshot or null if not found
 */
export function getWeatherAt(datetime, hourlyData) {
  if (!hourlyData || hourlyData.length === 0) return null;
  
  const targetTime = new Date(datetime);
  
  // Find closest hour
  let closestIndex = 0;
  let closestDiff = Infinity;
  
  hourlyData.forEach((point, index) => {
    const pointTime = new Date(point.time);
    const diff = Math.abs(targetTime - pointTime);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = index;
    }
  });
  
  const closestPoint = hourlyData[closestIndex];
  
  // Check if we should interpolate
  const pointTime = new Date(closestPoint.time);
  const timeDiff = Math.abs(targetTime - pointTime);
  const isInterpolated = timeDiff > 30 * 60 * 1000; // More than 30 min difference
  
  // If interpolation needed and we have neighboring points
  if (isInterpolated && hourlyData.length > 1) {
    const nextIndex = closestDiff > 0 ? closestIndex + 1 : closestIndex - 1;
    const prevPoint = hourlyData[nextIndex];
    
    if (prevPoint) {
      // Linear interpolation
      const t = timeDiff / (60 * 60 * 1000); // Hours
      
      return {
        time: datetime,
        tempC: Math.round(closestPoint.tempC * (1 - t) + prevPoint.tempC * t),
        feelsLikeC: Math.round(closestPoint.feelsLikeC * (1 - t) + prevPoint.feelsLikeC * t),
        dewpointC: Math.round((closestPoint.dewpointC * (1 - t) + prevPoint.dewpointC * t) * 10) / 10,
        humidity: Math.round(closestPoint.humidity * (1 - t) + prevPoint.humidity * t),
        windKph: Math.round(closestPoint.windKph * (1 - t) + prevPoint.windKph * t),
        gustKph: Math.round(closestPoint.gustKph * (1 - t) + prevPoint.gustKph * t),
        precipMm: (closestPoint.precipMm * (1 - t) + prevPoint.precipMm * t).toFixed(1),
        cloud: Math.round(closestPoint.cloud * (1 - t) + prevPoint.cloud * t),
        condition: closestPoint.condition,
        icon: closestPoint.icon,
        isInterpolated: true,
        sourceNote: 'Interpolated between hours'
      };
    }
  }
  
  // Return closest point
  return {
    time: datetime,
    tempC: Math.round(closestPoint.tempC),
    feelsLikeC: Math.round(closestPoint.feelsLikeC),
    dewpointC: closestPoint.dewpointC,
    humidity: closestPoint.humidity,
    windKph: Math.round(closestPoint.windKph),
    gustKph: Math.round(closestPoint.gustKph),
    precipMm: closestPoint.precipMm,
    cloud: closestPoint.cloud,
    condition: closestPoint.condition,
    icon: closestPoint.icon,
    isInterpolated: false,
    sourceNote: 'Hourly forecast'
  };
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

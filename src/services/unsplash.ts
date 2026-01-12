// Unsplash API service for fetching city photos
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const UNSPLASH_API_URL = 'https://api.unsplash.com';

interface UnsplashPhoto {
  id: string;
  urls: {
    small: string;
    regular: string;
    full: string;
  };
  alt_description: string;
  user: {
    name: string;
  };
  links: {
    html: string;
  };
}

interface CityPhoto {
  url: string;
  altText: string;
  photographer: string;
  photographerUrl: string;
}

// Cache to avoid multiple requests for the same city
const photoCache = new Map<string, CityPhoto | null>();

// Map of country codes to nice search terms
const countrySearchTerms: Record<string, string> = {
  thailand: 'Bangkok Thailand',
  vietnam: 'Ho Chi Minh City Vietnam',
  singapore: 'Singapore',
  malaysia: 'Kuala Lumpur Malaysia',
  indonesia: 'Jakarta Indonesia',
  philippines: 'Manila Philippines',
  china: 'Shanghai China',
  japan: 'Tokyo Japan',
  south_korea: 'Seoul Korea',
  india: 'Mumbai India',
  pakistan: 'Karachi Pakistan',
  uae: 'Dubai UAE',
  saudi_arabia: 'Jeddah Saudi Arabia',
  usa: 'New York USA',
  uk: 'London UK',
  egypt: 'Alexandria Egypt',
};

function extractCountry(location: string): string {
  const parts = location.split(',').map(p => p.trim());
  return parts[parts.length - 1] || location;
}

async function fetchPhotoFromUnsplash(query: string): Promise<UnsplashPhoto | null> {
  try {
    if (!UNSPLASH_ACCESS_KEY) {
      console.warn('Unsplash API key not configured');
      return null;
    }

    const response = await fetch(
      `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Accept-Version': 'v1',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch from Unsplash:', response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0];
  } catch (error) {
    console.error('Error fetching from Unsplash:', error);
    return null;
  }
}

export async function getCityPhoto(locationName: string): Promise<CityPhoto | null> {
  try {
    // Check cache first
    if (photoCache.has(locationName)) {
      return photoCache.get(locationName) || null;
    }

    // Extract city and country from location string
    const parts = locationName.split(',').map(p => p.trim());
    const city = parts[0];
    const country = parts[parts.length - 1];
    const countryLower = country.toLowerCase();

    // First try to fetch with city name
    let photo = await fetchPhotoFromUnsplash(city);

    // If no results, try with city + country
    if (!photo) {
      photo = await fetchPhotoFromUnsplash(`${city} ${country}`);
    }

    // If still no results, try with country name
    if (!photo) {
      const searchTerm = countrySearchTerms[countryLower] || country;
      photo = await fetchPhotoFromUnsplash(searchTerm);
    }

    if (!photo) {
      console.log(`No photo found for: ${locationName}`);
      photoCache.set(locationName, null);
      return null;
    }

    const cityPhoto: CityPhoto = {
      url: photo.urls.small,
      altText: photo.alt_description || locationName,
      photographer: photo.user.name,
      photographerUrl: photo.links.html,
    };

    // Cache the result
    photoCache.set(locationName, cityPhoto);

    return cityPhoto;
  } catch (error) {
    console.error('Error fetching city photo from Unsplash:', error);
    photoCache.set(locationName, null);
    return null;
  }
}

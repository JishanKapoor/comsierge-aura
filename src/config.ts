// API configuration
// In production, use the Render backend URL
// In development, the Vite proxy handles /api requests

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Helper to build API URLs
export const getApiUrl = (path: string) => {
  // If path already starts with /api, use as-is with base URL
  if (path.startsWith("/api")) {
    return `${API_BASE_URL}${path}`;
  }
  // Otherwise prepend /api
  return `${API_BASE_URL}/api${path.startsWith("/") ? path : `/${path}`}`;
};

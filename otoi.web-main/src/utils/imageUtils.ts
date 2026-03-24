
/**
 * Resolves a server-side image URL to a full URL that can be used in an <img> tag.
 * Handles both relative paths from the backend and local blob URLs for previews.
 * 
 * @param path The path or URL from the backend or a File object
 * @returns A full URL string
 */
export const resolveImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';

  // If it's already a full URL or a blob URL (for local previews), return as is
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  // Get API base URL from env (e.g. "http://host/api")
  const apiUrl = import.meta.env.VITE_APP_API_URL || '';

  // Ensure we don't have double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Flask serves static files at /api/static/... (static_url_path="/api/static")
  // so for /static/ paths, use the full apiUrl (which already contains /api)
  if (cleanPath.startsWith('/static/')) {
    const baseUrl = apiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
    return `${baseUrl}/api${cleanPath}`;
  }

  // For non-static paths, strip /api to get the server root
  const baseUrl = apiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
  return `${baseUrl}${cleanPath}`;
};

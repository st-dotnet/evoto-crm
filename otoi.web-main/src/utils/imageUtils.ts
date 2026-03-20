
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
  
  // Get API base URL from env
  const apiUrl = import.meta.env.VITE_APP_API_URL || '';
  
  // Strip /api (and optional trailing slash) from the base URL
  // We use this because static files are usually served from the root, not /api
  const baseUrl = apiUrl;
  
  // Ensure we don't have double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${cleanPath}`;
};

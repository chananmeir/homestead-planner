/**
 * API Utility Functions
 *
 * Centralized fetch wrapper that automatically includes credentials
 * for all API requests to ensure authentication cookies are sent.
 */

import { API_BASE_URL } from '../config';

/**
 * Custom fetch wrapper that automatically includes credentials
 * @param url - The URL to fetch (can be relative to API_BASE_URL or absolute)
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Add credentials to options
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include', // Always send cookies for authentication
  };

  // If URL is relative (starts with /), prepend API_BASE_URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  return fetch(fullUrl, fetchOptions);
}

/**
 * Convenience method for GET requests
 */
export async function apiGet(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'GET' });
}

/**
 * Convenience method for POST requests
 */
export async function apiPost(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for PUT requests
 */
export async function apiPut(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for DELETE requests
 */
export async function apiDelete(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'DELETE' });
}

/**
 * Convenience method for PATCH requests
 */
export async function apiPatch(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

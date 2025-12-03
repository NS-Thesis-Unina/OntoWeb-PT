/**
 * HTTP Client
 *
 * Preconfigured Axios instance used across service modules.
 * Resolves its base URL from VITE_API_BASE_URL or defaults to localhost.
 *
 * Behavior:
 * - 15s request timeout.
 * - Pass-through response interceptor (surface server errors to caller).
 *
 * Notes:
 * - Centralizing axios configuration makes it easy to add headers,
 *   auth tokens, or error normalization in one place.
 */

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost';

const httpClient = axios.create({
  baseURL,
  timeout: 15000,
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Propagate errors so callers can handle them (e.g., toast, retry, redirect).
    return Promise.reject(error);
  }
);

export default httpClient;

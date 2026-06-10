/**
 * Application Configuration
 *
 * Centralized configuration for the Homestead Planner frontend.
 * Supports environment-specific settings via environment variables.
 */

/**
 * API Base URL
 *
 * Can be overridden via REACT_APP_API_URL environment variable.
 *
 * Examples:
 * - Development (default): http://localhost:5000
 * - Staging: https://api-staging.yourdomain.com
 * - Production: https://api.yourdomain.com
 *
 * To override locally, create a .env.local file:
 * ```
 * REACT_APP_API_URL=http://localhost:8080
 * ```
 *
 * Note: Restart dev server after changing environment variables.
 */
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

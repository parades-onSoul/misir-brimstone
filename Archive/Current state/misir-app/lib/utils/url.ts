/**
 * URL Utilities
 * 
 * Consolidated helper functions for URL parsing and validation.
 */

/**
 * Extracts the domain name from a URL, stripping 'www.' prefix.
 * Returns empty string if URL is invalid.
 */
export function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '';
    }
}

/**
 * Checks if a string is a valid URL.
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the favicon URL for a given page URL using Google's favicon service.
 * Returns null if URL is invalid.
 */
export function getFaviconUrl(url: string, size: number = 16): string | null {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=${size}`;
    } catch {
        return null;
    }
}

/**
 * Normalizes a URL by removing trailing slashes and query params.
 */
export function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/$/, '');
    } catch {
        return url;
    }
}

/**
 * SWR Configuration and Fetcher
 */

/**
 * Default fetcher for SWR hooks.
 * Fetches JSON and throws on non-OK responses.
 */
export async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);

    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        throw error;
    }

    return res.json();
}

/**
 * Default SWR options for all hooks.
 */
export const defaultSwrOptions = {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
};

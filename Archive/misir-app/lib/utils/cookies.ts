import { cookies } from 'next/headers';

const AUTH_COOKIE_NAME = 'sb-access-token';
const REFRESH_COOKIE_NAME = 'sb-refresh-token';

interface CookieOptions {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
}

const DEFAULT_OPTIONS: CookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function setAuthCookies(accessToken: string, refreshToken: string) {
    const cookieStore = await cookies();

    cookieStore.set(AUTH_COOKIE_NAME, accessToken, DEFAULT_OPTIONS);
    cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, DEFAULT_OPTIONS);
}

export async function getAuthCookies() {
    const cookieStore = await cookies();

    return {
        accessToken: cookieStore.get(AUTH_COOKIE_NAME)?.value,
        refreshToken: cookieStore.get(REFRESH_COOKIE_NAME)?.value,
    };
}

export async function clearAuthCookies() {
    const cookieStore = await cookies();

    cookieStore.delete(AUTH_COOKIE_NAME);
    cookieStore.delete(REFRESH_COOKIE_NAME);
}

// Generic cookie helpers
export async function setCookie(name: string, value: string, options: CookieOptions = {}) {
    const cookieStore = await cookies();
    cookieStore.set(name, value, { ...DEFAULT_OPTIONS, ...options });
}

export async function getCookie(name: string) {
    const cookieStore = await cookies();
    return cookieStore.get(name)?.value;
}

export async function deleteCookie(name: string) {
    const cookieStore = await cookies();
    cookieStore.delete(name);
}

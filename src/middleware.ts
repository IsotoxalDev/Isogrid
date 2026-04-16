import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Bot UA block-list — covers major crawlers/scrapers that hammer serverless fns
// ---------------------------------------------------------------------------
const BOT_UA_PATTERNS = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,           // Yahoo
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /sogou/i,
    /exabot/i,
    /facebookexternalhit/i,
    /ia_archiver/i,     // Wayback Machine
    /semrushbot/i,
    /ahrefsbot/i,
    /mj12bot/i,
    /dotbot/i,
    /petalbot/i,
    /bytespider/i,      // TikTok crawler
    /gptbot/i,          // OpenAI
    /claude-web/i,      // Anthropic
    /ccbot/i,           // Common Crawl
    /python-requests/i,
    /go-http-client/i,
    /curl\//i,
    /wget\//i,
    /scrapy/i,
    /axios/i,
    /node-fetch/i,
    /libwww-perl/i,
    /java\//i,
];

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter (Edge-compatible, per-instance)
// Allows up to RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS per IP.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

// Map<ip, timestamp[]>
const rateLimitStore = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (rateLimitStore.get(ip) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= RATE_LIMIT_MAX) {
        rateLimitStore.set(ip, timestamps);
        return true;
    }

    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);

    // Periodically prune entries older than the window to avoid memory leaks
    if (rateLimitStore.size > 5000) {
        for (const [key, val] of rateLimitStore) {
            if (val.every((t) => t <= windowStart)) rateLimitStore.delete(key);
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// Security & caching headers added to every response
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ua = request.headers.get("user-agent") ?? "";

    // --- 1. Block bots ---
    if (BOT_UA_PATTERNS.some((re) => re.test(ua))) {
        return new NextResponse("Forbidden", {
            status: 403,
            headers: { "Content-Type": "text/plain", ...SECURITY_HEADERS },
        });
    }

    // --- 2. Rate limit (all routes) ---
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";

    if (isRateLimited(ip)) {
        return new NextResponse("Too Many Requests", {
            status: 429,
            headers: {
                "Content-Type": "text/plain",
                "Retry-After": "60",
                ...SECURITY_HEADERS,
            },
        });
    }

    // --- 3. Auth-guard /isogrid on GET (client-side auth app) ---
    // We cannot verify Firebase tokens in Edge middleware without an extra round-trip,
    // so we only block GET requests from clients with no session cookie at all.
    // The page itself will redirect to /login via Firebase onAuthStateChanged — this
    // just prevents bots & crawlers from hitting the heavy SSR route.
    if (pathname === "/isogrid" && request.method === "GET") {
        // Allow if any firebase-related cookies present (set by Firebase SDK)
        const hasCookie =
            request.cookies.has("__session") ||
            [...request.cookies.getAll()].some((c) =>
                c.name.startsWith("firebase:") || c.name.startsWith("__firebase_")
            );

        // Only block suspicious empty-UA or clearly headless requests without cookies
        // (real browsers navigating to /isogrid will have cookies after first login)
        const suspicious = !hasCookie && (ua === "" || /headless/i.test(ua));
        if (suspicious) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
    }

    // --- 4. Pass through, adding security headers ---
    const response = NextResponse.next();
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v));

    // Tell search engines not to index user canvas pages
    if (pathname.startsWith("/isogrid")) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    return response;
}

export const config = {
    matcher: [
        // Match all routes except Next.js internals and static files
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|otf)).*)",
    ],
};

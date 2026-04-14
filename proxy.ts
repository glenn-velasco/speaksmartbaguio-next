import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

// Configurable protected paths
const PROTECTED_PATHS = (process.env.PROTECTED_PATHS || "/api").split(",");

// CORS configuration
const ALLOWED_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, x-api-key";
const CORS_MAX_AGE = "86400"; // Cache preflight for 1 day

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10);

// In-memory rate limit store (single-instance friendly for OnRender)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkOrigin(origin: string | null): boolean {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",");
    return allowedOrigins.includes("*") || (!!origin && allowedOrigins.includes(origin));
}

// Constant-time comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const hashA = createHash("sha256").update(a).digest();
    const hashB = createHash("sha256").update(b).digest();
    return timingSafeEqual(hashA, hashB);
}

// Simple rate limiter
function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetAt) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return true;
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    record.count++;
    return true;
}

// Cleanup rate limit store periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        if (now > record.resetAt) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS * 2);

export function proxy(request: NextRequest) {
    const origin = request.headers.get("origin");
    const apiKey = request.headers.get("x-api-key");
    const validApiKey = process.env.API_SECRET_KEY as string;
    const isAllowedOrigin = checkOrigin(origin);

    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Rate limiting check
    if (!checkRateLimit(ip)) {
        logger.warn("Rate limit exceeded", { ip, path: request.nextUrl.pathname });
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 }
        );
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        const preflightHeaders: Record<string, string> = {
            "Access-Control-Allow-Methods": ALLOWED_METHODS,
            "Access-Control-Allow-Headers": ALLOWED_HEADERS,
            "Access-Control-Max-Age": CORS_MAX_AGE,
        };

        if (isAllowedOrigin) {
            preflightHeaders["Access-Control-Allow-Origin"] = origin || "*";
        }

        return new NextResponse(null, { status: 204, headers: preflightHeaders });
    }

    // API key validation for protected paths
    const isProtectedPath = PROTECTED_PATHS.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    );

    if (isProtectedPath) {
        if (!apiKey || !secureCompare(apiKey, validApiKey)) {
            logger.warn("Invalid API key attempt", { ip, path: request.nextUrl.pathname });
            return NextResponse.json(
                { error: "Forbidden: Invalid or missing API Key" },
                { status: 403 }
            );
        }
    }

    const response = NextResponse.next();

    // Set CORS headers (only once, after validation)
    if (isAllowedOrigin) {
        response.headers.set("Access-Control-Allow-Origin", origin || "*");
    }

    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
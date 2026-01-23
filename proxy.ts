import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/api"];

function checkOrigin(origin: string | null) {
    
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",");

    return allowedOrigins.includes("*") || (!!origin && allowedOrigins.includes(origin));
}

export function proxy(request: NextRequest) {

    const origin = request.headers.get("origin");

    const apiKey= request.headers.get("x-api-key");

    const validApiKey = process.env.API_SECRET_KEY as string;
    
    const isAllowedOrigin = checkOrigin(origin);

    if (request.method === "OPTIONS") {

        const preflightHeaders = {

            ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin || "*" }),
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
            "Access-Control-Max-Age": "86400", // Cache for 1 day for fast responses
            
        };

        return new NextResponse(null, { status: 204, headers: preflightHeaders });
    }

    if (PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
        
        if (!apiKey || apiKey !== validApiKey) {

            return NextResponse.json(

                { error: "Forbidden: Invalid or missing API Key" },
                { status: 403 }
            );
            
        }

    }

    const response = NextResponse.next();

    if (isAllowedOrigin) {

        // Allow this we might also use cookies in the future.
        response.headers.set("Access-Control-Allow-Origin", origin || "*");
    }
    
    // Indicate that the response varies based on the Origin header
    response.headers.set("Vary", "Origin");

    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

    return response;
}

export const config = {

    matcher: "/api/:path*",

};
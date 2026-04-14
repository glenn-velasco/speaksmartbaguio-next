import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";

export async function GET() {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    services: {
      firebase: "unknown",
    },
  };

  // Check Firebase Firestore connection
  try {
    await adminDb.collection("_health_check").limit(1).get();
    health.services.firebase = "connected";
  } catch (error) {
    health.services.firebase = "error";
    health.status = "degraded";
    logger.error("Health check: Firebase connection failed", { error: (error as Error).message });
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

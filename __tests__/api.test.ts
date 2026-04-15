import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.TEST_API_KEY || "test-api-key";

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
  message?: string;
  status?: string;
  services?: Record<string, string>;
  timestamp?: string;
}

function apiRequest<T = any>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    includeAuth?: boolean;
  } = {},
) {
  const {
    method = "GET",
    body,
    headers = {},
    includeAuth = true,
  } = options;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (includeAuth) {
    requestHeaders["x-api-key"] = API_KEY;
  }

  if (body) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(`${BASE_URL}${path}`, fetchOptions).then(async (res) => ({
    status: res.status,
    headers: res.headers,
    json: () => res.json() as Promise<ApiResponse<T>>,
  }));
}

// Track created IDs for cleanup
const cleanupIds: { collection: string; id: string }[] = [];

async function cleanup() {
  // Delete all created test entries
  for (const { collection, id } of cleanupIds) {
    try {
      await apiRequest(`/api/v1/${collection}?id=${id}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore cleanup errors
    }
  }
  cleanupIds.length = 0;
}

describe("Speak Smart Baguio API", () => {
  beforeAll(() => {
    // Setup if needed
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("Health Check", () => {
    it("should return health status without authentication", async () => {
      const res = await apiRequest("/api/health", { includeAuth: false });
      expect(res.status).toBeOneOf([200, 503]);
      const json = await res.json();
      expect(json.status).toBeOneOf(["ok", "degraded"]);
      expect(json.services).toBeDefined();
      expect(json.services?.firebase).toBeOneOf(["connected", "error"]);
      expect(json.timestamp).toBeDefined();
    });
  });

  describe("Security", () => {
    it("should reject requests with invalid API key", async () => {
      const res = await apiRequest("/api/v1/dictionary", {
        headers: { "x-api-key": "invalid-key" },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Forbidden");
    });

    it("should reject requests without API key", async () => {
      const res = await apiRequest("/api/v1/dictionary", {
        includeAuth: false,
      });
      expect(res.status).toBe(403);
    });

    it("should accept requests with valid API key", async () => {
      const res = await apiRequest("/api/v1/dictionary");
      expect(res.status).toBe(200);
    });
  });

  describe("Dictionary CRUD", () => {
    const collection = "dictionary";
    let createdId: string;

    it("should create a new dictionary entry", async () => {
      const timestamp = Date.now();
      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "POST",
        body: {
          ilokanoWord: `test_word_${timestamp}`,
          englishTranslation: `English test ${timestamp}`,
          tagalogTranslation: `Tagalog test ${timestamp}`,
          partOfSpeech: "noun",
          category: "test",
          tts_url: "https://example.com/tts/test",
        },
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data?.id).toBeDefined();
      createdId = json.data!.id;
      cleanupIds.push({ collection, id: createdId });
    });

    it("should reject duplicate ilokanoWord", async () => {
      if (!createdId) return;

      // Get the created entry to find the ilokanoWord
      const listRes = await apiRequest(`/api/v1/${collection}?limit=1`);
      const listJson = await listRes.json();

      if (listJson.data && listJson.data.length > 0) {
        const existing = listJson.data[0];
        const res = await apiRequest(`/api/v1/${collection}`, {
          method: "POST",
          body: {
            ilokanoWord: existing.ilokanoWord,
            englishTranslation: "Duplicate",
            tagalogTranslation: "Duplicate",
            partOfSpeech: "noun",
            category: "test",
            tts_url: "https://example.com",
          },
        });

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.code).toBe("CONFLICT");
      }
    });

    it("should fetch dictionary list with pagination", async () => {
      const res = await apiRequest(`/api/v1/${collection}?limit=5`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.hasMore).toBeDefined();
      expect(json.total).toBeDefined();
      if (json.data) {
        expect(json.data.length).toBeLessThanOrEqual(5);
      }
    });

    it("should filter by category", async () => {
      // Use the category from the entry we just created
      const res = await apiRequest(`/api/v1/${collection}?category=test_cat`);
      expect(res.status).toBe(200);
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        json.data.forEach((item: Record<string, unknown>) => {
          expect(item.category).toBe("test_cat");
        });
      }
    });

    it("should update an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "PUT",
        body: {
          id: createdId,
          ilokanoWord: "updated_word",
          englishTranslation: "Updated English",
          tagalogTranslation: "Updated Tagalog",
          partOfSpeech: "verb",
          category: "updated",
          tts_url: "https://example.com/tts/updated",
        },
      });

      expect(res.status).toBe(200);
    });

    it("should return 404 for non-existent ID on update", async () => {
      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "PUT",
        body: {
          id: "nonexistent_id_12345",
          ilokanoWord: "test",
          englishTranslation: "test",
          tagalogTranslation: "test",
          partOfSpeech: "noun",
          category: "test",
          tts_url: "https://example.com",
        },
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe("NOT_FOUND");
    });

    it("should delete an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}?id=${createdId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data?.message).toContain("deleted");
    });

    it("should return 400 when deleting without ID", async () => {
      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("required");
    });
  });

  describe("Validation", () => {
    it("should reject POST with missing required fields", async () => {
      const res = await apiRequest("/api/v1/dictionary", {
        method: "POST",
        body: { ilokanoWord: "only_word" },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("BAD_REQUEST");
      expect(json.details).toBeDefined();
    });

    it("should reject POST without Content-Type header", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/dictionary`, {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ ilokanoWord: "test" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Phrasebook CRUD", () => {
    const collection = "phrasebook";
    let createdId: string;

    it("should create a new phrasebook entry", async () => {
      const timestamp = Date.now();
      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "POST",
        body: {
          ilokanoWord: `phrase_${timestamp}`,
          englishTranslation: `Phrase English ${timestamp}`,
          tagalogTranslation: `Phrase Tagalog ${timestamp}`,
          partOfSpeech: "phrase",
          tts_url: "https://example.com/tts/phrase",
        },
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data?.id).toBeDefined();
      createdId = json.data!.id;
      cleanupIds.push({ collection, id: createdId });
    });

    it("should fetch phrasebook list", async () => {
      const res = await apiRequest(`/api/v1/${collection}?limit=10`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.hasMore).toBeDefined();
    });

    it("should update an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "PUT",
        body: {
          id: createdId,
          ilokanoWord: "updated_phrase",
          englishTranslation: "Updated phrase English",
          tagalogTranslation: "Updated phrase Tagalog",
          partOfSpeech: "phrase",
          tts_url: "https://example.com/tts/updated",
        },
      });

      expect(res.status).toBe(200);
    });

    it("should delete an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}?id=${createdId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });
  });

  describe("Translations CRUD", () => {
    const collection = "translations";
    let createdId: string;

    it("should create a new translation entry", async () => {
      const timestamp = Date.now();
      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "POST",
        body: {
          english: `translation_english_${timestamp}`,
          ilokano: `translation_ilokano_${timestamp}`,
          tagalog: `translation_tagalog_${timestamp}`,
        },
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data?.id).toBeDefined();
      createdId = json.data!.id;
      cleanupIds.push({ collection, id: createdId });
    });

    it("should fetch translations list", async () => {
      const res = await apiRequest(`/api/v1/${collection}?limit=10`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.hasMore).toBeDefined();
    });

    it("should filter by ilokano", async () => {
      const res = await apiRequest(`/api/v1/${collection}?ilokano=test`);
      expect(res.status).toBe(200);
    });

    it("should update an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}`, {
        method: "PUT",
        body: {
          id: createdId,
          english: "Updated english",
          ilokano: "Updated ilokano",
          tagalog: "Updated tagalog",
        },
      });

      expect(res.status).toBe(200);
    });

    it("should delete an entry", async () => {
      if (!createdId) return;

      const res = await apiRequest(`/api/v1/${collection}?id=${createdId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });
  });

  describe("CORS", () => {
    it("should respond to OPTIONS preflight request", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/dictionary`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "x-api-key, Content-Type",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeDefined();
      expect(res.headers.get("Access-Control-Allow-Headers")).toBeDefined();
      expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("should include CORS headers in normal responses", async () => {
      const res = await apiRequest("/api/v1/dictionary", {
        headers: { Origin: "http://localhost:3000" },
      });

      const origin = res.headers.get("Access-Control-Allow-Origin");
      expect(origin).toBeDefined();
      expect(res.headers.get("Vary")).toContain("Origin");
    });
  });

  describe("Caching", () => {
    it("should return consistent results for repeated GET requests", async () => {
      const res1 = await apiRequest("/api/v1/dictionary?limit=2");
      const res2 = await apiRequest("/api/v1/dictionary?limit=2");

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const json1 = await res1.json();
      const json2 = await res2.json();

      // Both should have same structure
      expect(json1.data?.length).toBe(json2.data?.length);
    });
  });
});

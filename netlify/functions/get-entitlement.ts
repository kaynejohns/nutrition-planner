import type { Handler } from "@netlify/functions";
import { blobs } from "@netlify/blobs";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
    // Require the caller to be logged in (JWT from Netlify Identity)
    const auth = event.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return { statusCode: 401, body: "Missing JWT" };

    const { userId } = JSON.parse(event.body || "{}");
    if (!userId) return { statusCode: 400, body: "Missing userId" };

    const store = blobs();
    const data = await store.getJSON<{ isPremium: boolean }>(`entitlements/${userId}.json`);
    const isPremium = !!data?.isPremium;

    return { statusCode: 200, body: JSON.stringify({ isPremium }) };
  } catch (e: any) {
    return { statusCode: 400, body: e.message };
  }
};


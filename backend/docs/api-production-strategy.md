# Backend API Production Guidelines

## 1. Rate Limiting Strategy
The `/api/analyze-food` endpoint connects to paid AI APIs (Gemini) and heavily rate-limited services (USDA API). An attacker could exhaust your API quota or rack up an expensive bill in minutes by spamming the endpoint.

### Recommended Implementation (Vercel + Upstash)
We recommend adding `@upstash/ratelimit` deployed on Vercel Edge Middleware.

**Why at the Edge?**
Blocking a request *before* it spins up an entire Node.js serverless function saves compute costs and is much faster.

### Future Code Example (Middleware)
```typescript
import { Ratelimit } from "@upstash/ratelimit"; // require redis
import { Redis } from "@upstash/redis";
import { NextResponse, NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Configure 5 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
});

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/analyze-food")) {
    const ip = request.ip ?? "127.0.0.1";
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }
  return NextResponse.next();
}
```

## 2. API Configuration (Next.js)
In production Route Handlers (`route.ts`), certain Next.js defaults must be overwritten for long-running AI requests.

```typescript
// Add this to the top of route.ts if API times out over 15 seconds
export const maxDuration = 60; // 60 seconds (requires Serverless environment, Vercel pro)

// Ensure body limit allows large images (though Zod validates within code)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
```

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from '../server';

// Thin Vercel handler that reuses the main Express app (database-backed).
let app: ReturnType<typeof createServer> | null = null;

const getApp = () => {
  if (!app) {
    app = createServer();
  }
  return app;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = getApp();

    // Ensure Express sees /api prefix; Vercel routes /api/* here already.
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + req.url;
    }

    return expressApp(req as any, res as any);
  } catch (error) {
    console.error('[Vercel Handler Error]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

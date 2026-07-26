import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    envKeys: Object.keys(process.env).filter(k => k.startsWith('C') || k.startsWith('M') || k.startsWith('V')),
    clerkSecret: process.env.CLERK_SECRET_KEY,
    clerkSecretLocal: process.env.CLERK_SECRET_KEY_LOCAL,
    mongoUri: process.env.MONGODB_URI
  });
}

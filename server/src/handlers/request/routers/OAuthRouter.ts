import { Request, Response, Router } from 'express';
import { readFile } from 'fs/promises';
import { OAuth2Client } from 'google-auth-library';
import { Auth } from 'googleapis';
import { GoogleClient } from '../../../utils/Google/GoogleClient';

declare module 'express-session' {
  interface SessionData {
    token: string
  }
}
export class OAuthRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('', async (req: Request, res: Response) => {
      console.log(req.query);
      await GoogleClient.validateCode(req.query.code as string).catch(e => res.json(e));
      if (!res.headersSent)
        res.send('Authenticated.');
    });

    router.post('/login', async (req: Request, res: Response) => {
      const payload = await GoogleClient.retrieveUserJWT(req.body.code);
      if (!payload) return res.status(503).json({ error: 'Could not retrieve ticket payload on auth.' });
      if (payload instanceof Error) return res.status(503).json({ error: payload.message });

      const { name, email, picture } = payload;
      res.status(201).json({ name, email, picture });
      req.session.token = payload.jwt;
      req.session.save();
    });

    router.get('/session', async (req: Request, res: Response) => {
      console.log(req.session);
      if (req.session.token) {
        const user = await GoogleClient.validateJWT(req.session.token);
        console.log(user);
        res.json(user);
      } else res.status(404).json({ error: 'Not logged in, no session found.' });
    })

    router.get('/logout', (req: Request, res: Response) => {
      req.session.destroy(() => {
        res.json({ result: 'OK' });
      });
    });

    return router;
  }
}
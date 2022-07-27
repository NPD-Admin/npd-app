import { Request, Response, Router } from 'express';
import { GoogleClient } from '../../../utils/Google/GoogleClient';
import { Wrapper } from '../Wrapper';

declare module 'express-session' {
  interface SessionData {
    token: string
  }
}

export class OAuthRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('', Wrapper(async (req: Request, res: Response) => {
      console.log(req.query);
      await GoogleClient.validateCode(req.query.code as string).catch(e => res.json(e));
      if (!res.headersSent)
        res.send('Authenticated.');
    }));

    router.post('/login', Wrapper(async (req: Request, res: Response) => {
      const payload = await GoogleClient.retrieveUserJWT(req.body.code);
      if (!payload) return res.status(503).json({ error: 'Could not retrieve ticket payload on auth.' });
      if (payload instanceof Error) return res.status(503).json({ error: payload.message });

      const { name, email, picture } = payload;
      res.status(201).json({ name, email, picture });
      req.session.token = payload.jwt;
      req.session.save();
    }));

    router.get('/session', Wrapper(async (req: Request, res: Response) => {
      if (req.session.token) {
        const user = await GoogleClient.validateJWT(req.session.token);
        res.json(user);
      } else res.status(404).json({ error: 'Not logged in, no session found.' });
    }));

    router.get('/logout', Wrapper((req: Request, res: Response) => {
      req.session.destroy(() => {
        res.json({ result: 'OK' });
      });
    }));

    return router;
  }
}
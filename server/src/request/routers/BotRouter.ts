import { Request, Response, Router } from "express";
import { NPDBot } from "../../NPDBot";
import { GoogleClient } from "../../utils/Google/GoogleClient";
import { Wrapper } from "../Wrapper";

export class BotRouter {
  static getRouter(instance: NPDBot): Router {
    const router = Router();

    router.get('', (req: Request, res: Response) => {
      res.json({ active: instance.isActive });
    });

    router.get('/setState', Wrapper(async (req: Request, res: Response) => {
      if (!req.session.token) return res.status(401).json({ error: 'Not authenticated.' });
      const user = await GoogleClient.validateSession(req.session.token!);

      if (!user || user instanceof Error) return res.status(503).json({ error: 'Error retrieving session user information.' });
      if (user.sub !== '113146369515155809637') return res.status(403).json({ error: 'Only the server admin can disable the bot.' });

      if (!req.query.state) {
        instance.isActive = !instance.isActive;
      } else {
        instance.isActive = req.query.state === 'true';
      }

      res.json({ active: instance.isActive });
    }));

    return router;
  }
}
import { Request, Response, Router } from 'express';

export class APIRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('', (req: Request, res: Response) => {
      res.json({ version: '0.1.0'});
    });

    return router;
  }
}
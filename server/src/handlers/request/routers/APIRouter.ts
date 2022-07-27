import { Request, Response, Router } from 'express';
import htmlToImageConverter from 'node-html-to-image';

export class APIRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('', (req: Request, res: Response) => {
      res.json({ version: '0.1.0'});
    });

    router.post('/screenshotHtml', async (req: Request, res: Response) => {
      const imgData = await htmlToImageConverter({
        html: req.body,
        puppeteerArgs: {
          args: ['--no-sandbox']
        }
      });
      res.setHeader('Content-type', 'image/png');
      res.send(imgData);
    });

    return router;
  }
}
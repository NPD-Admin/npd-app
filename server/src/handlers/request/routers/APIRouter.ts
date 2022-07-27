import { Request, Response, Router } from 'express';
import htmlToImageConverter from 'node-html-to-image';
import { GeoLookup } from '../../../utils/GeoLookup';
import { Wrapper } from '../Wrapper';

export class APIRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('', (req: Request, res: Response) => {
      res.json({ version: '0.1.0'});
    });

    router.post('/screenshotHtml', Wrapper(async (req: Request, res: Response) => {
      const imgData = await htmlToImageConverter({
        html: req.body,
        puppeteerArgs: {
          args: ['--no-sandbox']
        }
      });
      res.setHeader('Content-type', 'image/png');
      res.send(imgData);
    }));

    router.post('/legLookup', Wrapper(async (req: Request, res: Response) => {
      const data = await GeoLookup.findLegislators(req.body.address)
        .catch(e => {
          console.error(e);
          res.status(503).json(e.message);
        });
      if (data instanceof Error) res.json({ error: data.message });
      else res.json(data);
    }));

    return router;
  }
}
import { load } from 'cheerio';
import { Request, Response, Router } from 'express';
import htmlToImageConverter from 'node-html-to-image';
import { GeoLookup } from '../../../utils/GeoLookup';
import { HTTPSRequest } from '../../../utils/HTTPSRequest';
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

    router.get('/scrapeImage', Wrapper(async (req: Request, res: Response) => {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'No legislator URL provided.' });

      const html = (await HTTPSRequest.httpsGetRequest(url)).toString();
      const img = load(html)('.img-avatar');
      
      if (img && img[0] && img[0].attribs.src) {
        res.setHeader('Content-type', 'image/png').send(img[0].attribs.src);
      } else {
        res.status(404).json('Failed to download image.');
      }
    }));

    return router;
  }
}
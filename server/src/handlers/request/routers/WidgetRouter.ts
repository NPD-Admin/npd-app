import { Request, Response, Router } from 'express';
import { readdirSync } from 'fs';
import path from 'path';

export class WidgetRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('/widget/:widgetName', (req: Request, res: Response) => {
      const widgetDivId = req.query.widgetDivId;
      res.set({ 'Content-type': 'text/javascript' });
      res.render(`pages/widgets/${req.params.widgetName}`, {
        widgetDivId
      });
    });

    router.get('/:page?', (req: Request, res: Response) => {
      if (!req.params.page) {
        const fileList = readdirSync(path.join(process.cwd(), '/views/pages/widgets'), { withFileTypes: true });
        const widgetList = fileList.map(file => {
          if (file.isDirectory()) return null;
          if (file.name === 'index.ejs') return null;
          return ({ name: file.name.split('.')[0] });
        }).filter(w => w);
        res.render('pages/index', { widgetList });
      } else res.render(`pages/widget`, { page: req.params.page });
    });

    return router;
  }
}
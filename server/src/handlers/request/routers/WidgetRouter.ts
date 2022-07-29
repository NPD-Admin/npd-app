import { Request, Response, Router } from 'express';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { Wrapper } from '../Wrapper';

export class WidgetRouter {
  static getRouter(): Router {
    const router = Router();

    router.get('/widget/:widgetName', Wrapper((req: Request, res: Response) => {
      const widgetDivId = req.query.widgetDivId;
      res.set({ 'Content-type': 'text/javascript' });
      console.log(req.params.widgetName);
      const root = [process.cwd()];
      if (process.cwd().includes('server')) root.push('..');
      const tail = ['widgets'];
      if (!process.cwd().includes('dist')) tail.unshift('dist');
      const filename = path.join(...root, ...tail, req.params.widgetName);
      if (existsSync(filename)) res.sendFile(filename);
      else res.status(404).json({ error: `Widget file "${req.params.widgetName}" not found.`});
    }));

    router.get('/:page?', Wrapper((req: Request, res: Response) => {
      if (!req.params.page) {
        const root = [process.cwd()];
        if (process.cwd().includes('server')) root.push('..');
        const tail = ['widgets'];
        if (!process.cwd().includes('dist')) tail.unshift('dist');
        const fileList = readdirSync(path.join(...root, ...tail), { withFileTypes: true });
        const widgetList = fileList.map(file => ({ name: file.name.split('.')[0], url: file.name }));
        console.log(widgetList);
        res.render('pages/index', { widgetList });
      } else res.render(`pages/widget`, { page: req.params.page });
    }));

    return router;
  }
}
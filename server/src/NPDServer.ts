import { TextChannel } from 'discord.js';
import express, { Express, Request, Response } from 'express';
import { readdirSync } from 'fs';
import path, { join } from 'path';
import { NPDBot } from './NPDBot';
import { GoogleClient } from './utils/Google/GoogleClient';

export class NPDServer {
  static start(botInstance: NPDBot): void {
    const app: Express = express();
    const port = process.env.PORT || 5000;

    app.set('view engine', 'ejs');

    app.use(express.json());
    app.use(express.raw());
    app.use(express.urlencoded({ extended: true }));

    app.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "https://www.nonpartisande.org");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    app.get('/api', (req, res) => {
      res.json({ version: '0.1.0'});
    });

    app.get('/oauth', async (req, res) => {
      console.log(req.query);
      await GoogleClient.validateCode(req.query.code as string).catch(e => res.json(e));
      res.send('Authenticated.');
    });

    app.get('/widgets/widget/:widgetName', (req, res) => {
      const widgetId = req.query.widgetId;
      res.set({ 'Content-type': 'text/javascript' });
      res.render(`pages/widgets/${req.params.widgetName}`, {
        widgetId
      });
    });

    app.get('/widgets/:page?', (req, res) => {
      if (!req.params.page) {
        const fileList = readdirSync(path.join(__dirname, '../views/pages/widgets'), { withFileTypes: true });
        const widgetList = fileList.map(file => {
          if (file.isDirectory()) return null;
          if (file.name === 'index.ejs') return null;
          return ({ name: file.name.split('.')[0] });
        }).filter(w => w);
        res.render('pages/index', { widgetList });
      } else res.render(`pages/widget`, { page: req.params.page });
    });

    // app.get('/discord', async (req: Request, res: Response) => {
    //   const channel = botInstance.client.channels.resolve('822532580674371605') as TextChannel;
    //   if (channel) {
    //     await channel.send('posted from the web');
    //     res.send('OK');
    //   } else {
    //     res.status(503).send('Channel not available');
    //   }
    // });

    // app.post('/discord', async (req: Request, res: Response) => {
    //   const channel = botInstance.client.channels.resolve('822532580674371605') as TextChannel;
    //   if (channel) {
    //     await channel.send(req.body.message);
    //     res.send('OK');
    //   } else {
    //     res.status(503).send('Channel not available');
    //   }
    // })

    app.use(express.static(join(__dirname, '..', '/build')));

    app.listen(port, () => {
      console.log(`Web server listening on: ${port}...`);
    });
  }
}
import express, { Express } from 'express';
import session, { MemoryStore } from 'express-session';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { APIRouter } from './handlers/request/routers/APIRouter';
import { BotRouter } from './handlers/request/routers/BotRouter';
import { OAuthRouter } from './handlers/request/routers/OAuthRouter';
import { WidgetRouter } from './handlers/request/routers/WidgetRouter';
import { NPDBot } from './NPDBot';

export class NPDServer {
  static start(botInstance: NPDBot): void {
    const app: Express = express();
    const port = process.env.PORT || 5000;

    app.set('view engine', 'ejs');
    if (process.cwd().includes('app')) app.set('views', join(__dirname, '..', 'views'));

    app.use((req, res, next) => {
      try {
        next();
      } catch (e) {
        console.error(e);
        res.status(503).json({
          error: JSON.stringify(e, null, 2)
        });
      }
    });

    app.use(session({
      secret: process.env.SESSION_SECRET!,
      resave: true,
      saveUninitialized: true,
      cookie: { secure: 'auto', maxAge: 1000*60*60*24 },
      store: new MemoryStore({})
    }));

    app.use(express.json());
    app.use(express.raw());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.text({
      type: 'text/html',
      limit: '100mb'
    }));

    app.use(function(req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    app.use('/api', APIRouter.getRouter());
    app.use('/bot', BotRouter.getRouter(botInstance));
    app.use('/oauth', OAuthRouter.getRouter());
    app.use('/widgets', WidgetRouter.getRouter());

    // app.post('/discord', async (req: Request, res: Response) => {
    //   const channel = botInstance.client.channels.resolve('822532580674371605') as TextChannel;
    //   if (channel) {
    //     await channel.send(req.body.message);
    //     res.send('OK');
    //   } else {
    //     res.status(503).send('Channel not available');
    //   }
    // })

    let buildFolder = join(__dirname, '..', 'build');
    console.log(buildFolder, existsSync(buildFolder));
    if (!existsSync(buildFolder)) buildFolder = join(__dirname, '..', '..', '..', 'build');
    app.use('/', express.static(buildFolder));

    app.listen(port, () => {
      console.log(`Web server listening on: ${port}...`);
    });
  }
}
import express, { Express, Request, Response } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongodb-session';
import { ServerApiVersion } from 'mongodb';
import { existsSync } from 'fs';
import { join } from 'path';

import { APIRouter } from './request/routers/APIRouter';
import { BotRouter } from './request/routers/BotRouter';
import { OAuthRouter } from './request/routers/OAuthRouter';
import { WidgetRouter } from './request/routers/WidgetRouter';
import { NPDBot } from './NPDBot';
import { ErrorGenerator } from './utils/ErrorGenerator';
import { Wrapper } from './request/Wrapper';

const MONTH_MS = 1000 * 60 * 60 * 24 * 30;

export class NPDServer {
  static start(botInstance: NPDBot): void {
    const app: Express = express();
    const port = process.env.PORT || 5000;

    app.set('view engine', 'ejs');
    if (process.cwd().includes('app')) app.set('views', join(__dirname, '..', 'views'));

    const mongoStore = new (MongoStore(session))({
      uri: process.env.MONGO_URI!,
      collection: 'sessionStorage',
      databaseName: 'NPD-Data',
      expires: MONTH_MS,
      connectionOptions: {
        serverApi: ServerApiVersion.v1
      }
    }, error => error && ErrorGenerator.generate({ e: error, message: 'Failed to connect to MongoDB Session Store:' }));
    mongoStore.on('error', error => ErrorGenerator.generate({ e: error, message: 'Error from MongoDB Session Store:' }));

    app.use((req, res, next) => {
      try {
        next();
      } catch (e) {
        res.status(503).json({
          error: ErrorGenerator.generate({ e, message: `Uncaught error in request handler:\n${req}` })
        });
      }
    });

    app.use(session({
      secret: process.env.SESSION_SECRET!,
      resave: true,
      saveUninitialized: true,
      name: `npdSessionCookie`,
      cookie: {
        secure: 'auto',
        maxAge: MONTH_MS
      },
      store: mongoStore
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
  
    console.log(process.env.LE_URL, process.env.LE_CONTENT);
    if (process.env.LE_URL && process.env.LE_CONTENT) {
      app.get(process.env.LE_URL, Wrapper((req: Request, res: Response) => {
        res.send(process.env.LE_CONTENT);
      }));
    }

    let buildFolder = join(__dirname, '..', 'build');
    console.log(buildFolder, existsSync(buildFolder));
    if (!existsSync(buildFolder)) buildFolder = join(__dirname, '..', '..', '..', 'build');
    app.use('/', express.static(buildFolder));

    app.listen(port, () => {
      console.log(`Web server listening on: ${port}...`);
    });
  }
}
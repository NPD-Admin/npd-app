'use strict';

import { google, Auth, admin_directory_v1, gmail_v1, drive_v3, Common, GoogleApis } from 'googleapis';
import readline from 'readline';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { ErrorGenerator } from '../ErrorGenerator';

export { Common, admin_directory_v1 };
const scopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',

  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/blogger'
];

let tokenEnvData = process.env.google_token;

export class GoogleClient {
  static client: Auth.OAuth2Client;
  
  private static webCredentials: { web: { client_secret: string, client_id: string, redirect_uris: string }};

  static get google() { return (this.client && google) || 'Not ready' };

  static async login(): Promise<GoogleApis | void> {
    const result = await this.getClient();
    if (!(result instanceof Auth.OAuth2Client)) return;
    const profile = await google.people('v1').people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses,names'
    });
    console.log(`User ${profile.data.emailAddresses![0].value} (${profile.data.names![0].displayName}) logged in to Google OAuth.`);
    return google;
  }

  static async getClient(): Promise<Auth.OAuth2Client | void> {
    if (this.client) return this.client;

    const credentials = process.env.google_creds as string ||
      await readFile(process.cwd() + '/creds/google_creds.json');
    if (!credentials) return console.error('Could not load OAuth2 Client Credentials.');

    const { client_secret, client_id, redirect_uris } = JSON.parse(credentials.toString()).installed;
    const oAuth2Client = this.client = new Auth.OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uris[0]});

    return new Promise(async (resolve, reject) => {
      const token = process.env.google_token || await readFile(process.cwd()+'/creds/google_token.json').catch(e => {
        console.log('No token found, please authenticate:');
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes.join(' ')
        });
        console.log(authUrl);
        if (process.env.google_creds || true)
          return resolve(console.error('Please authenticate your Google Account then submit your code as a query string to {HOST}/oauth.'));

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('CODE: ', async code => {
          const token = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(token.tokens);
          await writeFile(process.cwd()+'/creds/google_token.json', JSON.stringify(token, null, 2));
          console.log(token);
          google.options({ auth: oAuth2Client });
          await this.testMailer();
          resolve(this.client);
        });
      }) as Buffer;
      if (token && (token instanceof Buffer || typeof token === 'string')) {
        const tokenData = JSON.parse(token.toString()) as { tokens: Auth.Credentials, res: Common.GaxiosResponse };
        const tokenScopes = (tokenData.tokens.scope || '').split(' ');
        
        if (!scopes.every(scope => tokenScopes.includes(scope))) {
          console.log('Existing token is missing required scopes.  Resetting token...');
          if (existsSync(process.cwd()+'/creds/google_token.json'))
            await unlink(process.cwd()+'/creds/google_token.json');
          tokenEnvData = undefined;
          resolve(await this.getClient());
        } else {
          oAuth2Client.setCredentials(tokenData.tokens);
          google.options({ auth: oAuth2Client });
          resolve(this.client);
        }
      }
    });
  }

  static async validateCode(code: string): Promise<Auth.OAuth2Client | Error> {
    const token = await this.client.getToken(code).catch(e => ErrorGenerator.generate(e, 'Error retrieving token from code:'));
    if (token instanceof Error) return token;

    this.client.setCredentials(token.tokens);

    if (!existsSync(process.cwd() + '/creds')) {
      const mkdirRes = await mkdir(process.cwd() + '/creds').catch(e => ErrorGenerator.generate(e, 'Error creating directory for token:'));
      if (mkdirRes instanceof Error) return mkdirRes;
    }

    const writeFileRes = await writeFile(process.cwd() + '/creds/google_token.json', JSON.stringify(token, null, 2))
      .catch(e => ErrorGenerator.generate(e, 'Error writing token file:'));
    if (writeFileRes instanceof Error) return writeFileRes;

    google.options({ auth: this.client });
    console.log('Server code validated, tokens issued:\n', token);

    const mailerRes = await this.testMailer().catch(e => ErrorGenerator.generate(e, 'Failed to send mail using Google Client:'));
    if (mailerRes instanceof Error) return mailerRes;

    return this.client;
  }

  static async retrieveUserJWT(code: string): Promise<(Auth.TokenPayload & { tokens: Auth.Credentials }) | Error> {
    const client = await this.getWebClient();
    if (client instanceof Error) return client;

    const token = await client.getToken(code).catch(e => ErrorGenerator.generate(e, 'Invalid code failed to retrieve token:'));
    if (token instanceof Error) return token;

    client.setCredentials(token.tokens);
    const payload = await this.validateJWT(token.tokens.id_token!);
    if (!payload) return new Error('Failed to retrieve JWT payload from ID token.');
    if (payload instanceof Error) return payload as Error;

    return { ...payload, tokens: token.tokens };
  }

  static async validateJWT(token: string): Promise<Auth.TokenPayload | Error> {
    const client = await this.getWebClient();
    if (client instanceof Error) return client;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: client._clientId!
    }).catch(e => ErrorGenerator.generate(e, 'Failed to verify ID token based on the code provided:'));
    if (ticket instanceof Error) return ticket;

    const payload = ticket.getPayload();
    if (!payload) return new Error('Failed to retrieve JWT payload from ID token.');

    return payload;
  }

  static async validateSession(tokensJSON: string) {
    try {
      const tokens = JSON.parse(tokensJSON) as Auth.Credentials;

      const client = await this.getWebClient();
      if (client instanceof Error) return client;
      
      client.setCredentials(tokens);

      const payload = await client.refreshAccessToken().catch(e => ErrorGenerator.generate(e, 'Error refreshing access token:'));
      if (payload instanceof Error) return payload;

      return this.validateJWT(payload.credentials.id_token!);
    } catch (e) {
      if (e instanceof SyntaxError) return ErrorGenerator.generate(e, `Invalid tokens JSON:\n${tokensJSON}`);
      return ErrorGenerator.generate(e, 'Unknown Error Validating Session Tokens:');
    }
  }

  static async getWebClient(): Promise<Auth.OAuth2Client | Error> {
    const credentials = this.webCredentials ||
      JSON.parse(process.env.google_web as string
        || (await readFile(process.cwd() + '/creds/google_web.json')
          .catch(e => JSON.stringify(ErrorGenerator.generate(e, 'Failed to load web client credentials:')))).toString());
    if (credentials instanceof Error) return credentials;

    const { client_secret, client_id, redirect_uris } = credentials.web;
    const client = new Auth.OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uris[0] });

    return client;
  }

  static async testMailer(): Promise<Error | string> {
    const mailer = await this.getMailer();
    if (mailer instanceof Error) return mailer;
    
    const utf8 = `=?utf-8?B?${Buffer.from('Bot Authenticated').toString('base64')}?=`;
    const part = [
      'From: Non-Partisan Delaware <NonPartisanDE@gmail.com>',
      `To: Non-Partisan Delaware <info@NonPartisanDE.org>`,
      'Content-type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8}`,
      '',
      'The NPD Bot has successfully authenticated with the Google OAuth2 API.'
    ];
    const message = part.join('\n');
    const coded = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await mailer.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: coded
      }
    });

    return result.statusText;
  }

  static async getMailer(): Promise<gmail_v1.Gmail | Error> {
    const client = (await this.getClient());
    if (client instanceof Error) return client;
    return google.gmail('v1');
  }

  static async getDrive(): Promise<drive_v3.Drive | Error> {
    const client = (await this.getClient());
    if (client instanceof Error) return client;
    return google.drive('v3');
  }
}
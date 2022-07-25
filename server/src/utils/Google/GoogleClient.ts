'use strict';

import { google, Auth, admin_directory_v1, gmail_v1, drive_v3, Common, GoogleApis } from 'googleapis';
import readline from 'readline';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';

export { Common, admin_directory_v1 };
const scopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/blogger',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.group'
];

export class GoogleClient {
  static client: Auth.OAuth2Client;
  static webClient: Auth.OAuth2Client;

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

    const credentials = await readFile(process.cwd() + '/creds/google_creds.json').catch(e => console.error('No creds file, getting from env'))
      || process.env.google_creds as string;
    const { client_secret, client_id, redirect_uris } = JSON.parse(credentials.toString()).installed;
    const oAuth2Client = this.client = new Auth.OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uris[0]});
    return new Promise(async (resolve, reject) => {
      const token = await readFile(process.cwd()+'/creds/google_token.json').catch(e => {
        console.log('Token not found.  Please authenticate to generate a new token.\n');
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes.join(' ')
        });
        console.log(authUrl);
        if (process.env.google_creds)
          return resolve(console.error('Please authenticate your Google Account then submit your code as a query string to {HOST}/oauth.'));

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('CODE: ', async code => {
          const token = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(token.tokens);
          await writeFile(process.cwd()+'/creds/google_token.json', JSON.stringify(token, null, 2));
          google.options({ auth: oAuth2Client });
          await this.testMailer();
          resolve(this.client);
        });
      }) as Buffer;
      if (token && token instanceof Buffer) {
        const tokenData = JSON.parse(token.toString()) as { tokens: Auth.Credentials, res: Common.GaxiosResponse };
        const tokenScopes = (tokenData.tokens.scope || '').split(' ');
        
        if (!scopes.every(scope => tokenScopes.includes(scope))) {
          console.log('Existing token is missing required scopes.  Resetting token...');
          await unlink(process.cwd()+'/creds/google_token.json');
          resolve(await this.getClient());
        } else {
          oAuth2Client.setCredentials(tokenData.tokens);
          google.options({ auth: oAuth2Client });
          resolve(this.client);
        }
      }
    });
  }

  static async validateCode(code: string): Promise<Auth.OAuth2Client> {
    const token = await this.client.getToken(code);
    this.client.setCredentials(token.tokens);
    await mkdir(process.cwd() + '/creds');
    await writeFile(process.cwd() + '/creds/google_token.json', JSON.stringify(token, null, 2));
    google.options({ auth: this.client });
    await this.testMailer();
    return this.client;
  }

  static async retrieveUserJWT(code: string): Promise<(Auth.TokenPayload & { jwt: string }) | Error> {
    await this.getWebClient();

    const token = await this.webClient.getToken(code).catch() || new Error('Invalid code failed to retrieve token.');
    if (token instanceof Error) return token;

    this.webClient.setCredentials(token.tokens);
    const payload = await this.validateJWT(token.tokens.id_token!);
    if (!payload) return new Error('Failed to retrieve JWT payload from ID token.');
    if (payload instanceof Error) return payload as Error;

    return { ...payload, jwt: token.tokens.id_token! };
  }

  static async getWebClient(): Promise<Auth.OAuth2Client> {
    if (this.webClient) return this.webClient;

    const credentials = await readFile(process.cwd() + '/creds/google_web.json').catch(e => console.error('No creds file, getting from env'))
      || process.env.google_web as string;
    const { client_secret, client_id, redirect_uris } = JSON.parse(credentials.toString()).web;
    this.webClient = new Auth.OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uris[0] });

    return this.webClient;
  }

  static async validateJWT(token: string): Promise<Auth.TokenPayload | Error> {
    const ticket = await this.webClient.verifyIdToken({
      idToken: token,
      audience: this.webClient._clientId!
    }).catch() || new Error('Failed to verify ID token based on the code provided.');
    if (ticket instanceof Error) return ticket;

    const payload = ticket.getPayload();
    if (!payload) return new Error('Failed to retrieve JWT payload from ID token.');

    return payload;
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
'use strict';

import { google, Auth, admin_directory_v1, gmail_v1, drive_v3, Common, GoogleApis } from 'googleapis';
import * as fs from 'fs/promises';
import readline from 'readline';

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
  static get google() { return (this.client && google) || 'Not ready' };
  static async login(): Promise<GoogleApis | void> {
    const result = await this.getClient();
    if (result instanceof Error) return console.error(result.message);
    const profile = await google.people('v1').people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses,names'
    });
    console.log(`User ${profile.data.emailAddresses![0].value} (${profile.data.names![0].displayName}) logged in to Google OAuth.`);
    return google;
  }

  static async getClient(): Promise<Auth.OAuth2Client | Error> {
    if (this.client) return this.client;

    const credentials = await fs.readFile(process.cwd()+'/creds/google_creds.json').catch(console.error) || process.env.google_creds as string;
    const { client_secret, client_id, redirect_uris } = JSON.parse(credentials.toString()).installed;
    const oAuth2Client = this.client = new Auth.OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uris[0]});
    return new Promise(async (resolve, reject) => {
      const token = await fs.readFile(process.cwd()+'/creds/google_token.json').catch(e => {
        console.log('Token not found.  Please authenticate to generate a new token.\n');
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes.join(' ')
        });
        console.log(authUrl);
        if (!(redirect_uris[0] as string).includes('urn:ietf:wg:oauth:2.0:oob')) return new Error('Please authenticate your Google Account.');

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('CODE: ', async code => {
          const token = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(token.tokens);
          await fs.writeFile(process.cwd()+'/creds/google_token.json', JSON.stringify(token, null, 2));
          google.options({ auth: oAuth2Client });
          await this.testMailer();
          resolve(this.client);
        });
      }) as Buffer;
      if (token) {
        const tokenData = JSON.parse(token.toString()) as { tokens: Auth.Credentials, res: Common.GaxiosResponse };
        const tokenScopes = (tokenData.tokens.scope || '').split(' ');
        
        if (!scopes.every(scope => tokenScopes.includes(scope))) {
          console.log('Existing token is missing required scopes.  Resetting token...');
          await fs.unlink(process.cwd()+'/creds/google_token.json');
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
    await fs.writeFile(process.cwd()+'/creds/google_token.json', JSON.stringify(token, null, 2));
    google.options({ auth: this.client });
    await this.testMailer();
    return this.client;
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
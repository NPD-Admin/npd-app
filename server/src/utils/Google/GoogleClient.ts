'use strict';

import { google, Auth, gmail_v1, drive_v3, GoogleApis } from 'googleapis';
import { GetTokenResponse } from 'google-auth-library/build/src/auth/oauth2client';

import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

import { ErrorGenerator } from '../ErrorGenerator';
import { idUser } from './People';

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
  
  private static webCredentials: Buffer;

  static get google() { return (this.client && google) || 'Not ready' };

  static async login(): Promise<GoogleApis | Error> {
    const result = await this.getClient();
    if (result instanceof Error) return result;

    const profile = await idUser(google);
    if (profile instanceof Error) return profile;

    console.log(`User ${profile.emailAddress} (${profile.displayName}) logged in to Google OAuth.`);
    return google;
  }

  static async getClient(): Promise<Auth.OAuth2Client | Error> {
    if (this.client) return this.client;

    const oAuth2Client = await this.getOAuthClient();
    if (oAuth2Client instanceof Error) return oAuth2Client;

    const token = await this.loadToken(oAuth2Client);
    if (token instanceof Error) return token;
    
    const tokenData = JSON.parse(token.toString()) as GetTokenResponse;
    if (!this.isTokenScopeValid(tokenData)) return await this.deleteTokensRetry();

    oAuth2Client.setCredentials(tokenData.tokens);
    google.options({ auth: oAuth2Client });

    return this.client = oAuth2Client;
  }

  private static async getOAuthClient(): Promise<Auth.OAuth2Client | Error> {
    const credentials = (process.env.google_creds && Buffer.from(process.env.google_creds)) as Buffer
      ?? await readFile(process.cwd() + '/creds/google_creds.json').catch(e =>
      ErrorGenerator.generate({ message: 'Could not load OAuth2 Client Credentials:', e })
    );
    if (credentials instanceof Error) return credentials;

    const { client_secret: clientSecret, client_id: clientId, redirect_uris } = JSON.parse(credentials.toString()).installed,
      [redirectUri] = redirect_uris, oAuth2Client = new Auth.OAuth2Client({ clientId, clientSecret, redirectUri });

    return oAuth2Client;
  }

  private static async loadToken(oAuth2Client: Auth.OAuth2Client): Promise<Buffer | Error> {
    const token = (tokenEnvData && Buffer.from(tokenEnvData)) as Buffer
      ?? await readFile(process.cwd()+'/creds/google_token.json').catch(e => {
      console.log('No token found, please authenticate:');
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes.join(' ')
      });
      console.log(authUrl);
      return ErrorGenerator.generate({ message: 'Please authenticate your Google Account then submit your code as a query string to {HOST}/oauth.' });
    });

    return token;
  }

  private static isTokenScopeValid(tokenData: GetTokenResponse): boolean {
    const tokenScopes = (tokenData.tokens.scope ?? '').split(' ');
    
    return scopes.every(scope => tokenScopes.includes(scope));
  }

  private static async deleteTokensRetry(): Promise<Auth.OAuth2Client | Error> {
    console.log('Existing token is missing required scopes.  Resetting token...');
    
    tokenEnvData = undefined;
    if (existsSync(process.cwd()+'/creds/google_token.json'))
      await unlink(process.cwd()+'/creds/google_token.json');

    return await this.getClient();
  }

  static async validateCode(code: string): Promise<Auth.OAuth2Client | Error> {
    const client = await this.getOAuthClient();
    if (client instanceof Error) return client;

    this.client = client;
    const token = await this.client.getToken(code).catch(e => ErrorGenerator.generate({ e, message: 'Error retrieving token from code:' }));
    if (token instanceof Error) return token;

    this.client.setCredentials(token.tokens);
    google.options({ auth: this.client });
    tokenEnvData = JSON.stringify(token, null, 2);
    console.log('Server code validated, tokens issued:\n', tokenEnvData);

    if (!existsSync(process.cwd() + '/creds')) {
      const mkdirRes = await mkdir(process.cwd() + '/creds')
        .catch(e => ErrorGenerator.generate({ e, message: 'Error creating directory for token:' }));
      if (mkdirRes instanceof Error) return mkdirRes;
    }
    
    const writeFileRes = await writeFile(process.cwd() + '/creds/google_token.json', tokenEnvData)
      .catch(e => ErrorGenerator.generate({ e, message: 'Error writing token file:' }));
    if (writeFileRes instanceof Error) return writeFileRes;    

    const mailerRes = await this.testMailer()
      .catch(e => ErrorGenerator.generate({ e, message: 'Failed to send mail using Google Client:' }));
    if (mailerRes instanceof Error) return mailerRes;

    return this.client;
  }

  static async retrieveUserJWT(code: string): Promise<(Auth.TokenPayload & { tokens: Auth.Credentials }) | Error> {
    const client = await this.getWebClient();
    if (client instanceof Error) return client;

    const token = await client.getToken(code).catch(e => ErrorGenerator.generate({ e, message: 'Invalid code failed to retrieve token:' }));
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
    }).catch(e => ErrorGenerator.generate({ e, message: 'Failed to verify ID token based on the code provided:' }));
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

      const payload = await client.refreshAccessToken().catch(e => ErrorGenerator.generate({ e, message: 'Error refreshing access token:' }));
      if (payload instanceof Error) return payload;

      return this.validateJWT(payload.credentials.id_token!);
    } catch (e) {
      if (e instanceof SyntaxError) return ErrorGenerator.generate({ e, message: `Invalid tokens JSON:\n${tokensJSON}` });
      return ErrorGenerator.generate({ e, message: 'Unknown Error Validating Session Tokens:' });
    }
  }

  static async getWebClient(): Promise<Auth.OAuth2Client | Error> {
    const credentials = this.webCredentials
      ?? (process.env.google_web && Buffer.from(process.env.google_web)) as Buffer
      ?? await readFile(process.cwd() + '/creds/google_web.json').catch(e =>
      ErrorGenerator.generate({ e, message: 'Failed to load web client credentials:' })
    );
    if (credentials instanceof Error) return credentials;
    this.webCredentials = credentials;

    const { client_secret: clientSecret, client_id: clientId, redirect_uris } = JSON.parse(credentials.toString()).web,
      [redirectUri] = redirect_uris, client = new Auth.OAuth2Client({ clientId, clientSecret, redirectUri });

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
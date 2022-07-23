import { request } from 'https';

export class HTTPSRequest {
  static httpsGetRequest(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = request(url, response => {
        const chunks: Buffer[] = [];
        response.on('data', data => chunks.push(data));
        response.on('error', reject);
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.end();
    });
  }

  static httpsPayloadRequest(method: string, url: string, payload: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = request({
        method: method,
        href: url
      }, response => {
        const chunks: Buffer[] = [];
        response.on('data', data => chunks.push(data));
        response.on('error', reject);
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.end(Buffer.from(JSON.stringify(payload, null, 2)));
    });
  }
}
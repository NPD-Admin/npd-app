import { Message, MessageAttachment, SMTPClient } from 'emailjs';

export class Mailer {
  private static smtpClient: SMTPClient;

  private static init(): SMTPClient {
    if (this.smtpClient) return this.smtpClient;
    this.smtpClient = new SMTPClient({
      user: process.env.emailUser,
      password: process.env.emailPass,
      host: 'smtppro.zoho.com',
      ssl: true,
      timeout: 10000
    });
    return this.smtpClient;
  }

  static async sendMail(htmlText: string, to: string, subject: string,
      attachments: MessageAttachment[] = [],
      from: string = '"NPD Bot" <no-reply@NonPartisanDE.org',
      reply: string = '"NPD Bot" <no-reply@NonPartisanDE.org>'): Promise<void> {
    attachments.splice(0, 0, { data: htmlText, alternative: true });
    const msg = new Message({
      from: from,
      'reply-to': reply,
      to: to,
      subject: subject,
      attachment: attachments
    });
    await new Promise((resolve, reject) => this.init().send(msg, (e, m) => (e && reject(e) as unknown as true) || resolve(m)));
  }
}
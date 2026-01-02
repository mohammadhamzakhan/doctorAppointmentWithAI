import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { MAIL_FROM } from './const/const.mail';
import { otpTemplate } from './templates/otp.template';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendVerificationEmail(to: string, code: string) {
    return await this.sendMail(to, 'Email Verification', otpTemplate(code));
  }
  async sendPasswordResetEmail(to: string, code: string) {
    return await this.sendMail(to, 'Password Reset Code', otpTemplate(code));
  }
  async emailChangeOtp(to: string, code: string) {
    return await this.sendMail(
      to,
      'Email Change Verification Code',
      otpTemplate(code),
    );
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      return await this.resend.emails.send({
        from: MAIL_FROM,
        to,
        subject,
        html,
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}

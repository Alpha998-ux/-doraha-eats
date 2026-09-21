import { env } from '../../config/env.js';

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Dev provider: prints the OTP to the server log so you can log in locally. */
const consoleProvider: SmsProvider = {
  async sendOtp(phone, code) {
    console.log(`\n  [OTP] ${phone} -> ${code}   (dev only; wire a real SMS provider for production)\n`);
  },
};

export const smsProvider: SmsProvider =
  env.SMS_PROVIDER === 'console' ? consoleProvider : consoleProvider;

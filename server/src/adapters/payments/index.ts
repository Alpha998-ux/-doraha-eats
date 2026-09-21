import { env } from '../../config/env.js';

export type PaymentIntent = {
  provider: string;
  reference: string;
  amountPaise: number;
  /** For UPI: a deep link the mobile app can open. */
  upiUri?: string;
  qrPayload?: string;
  instructions: string;
};

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: { orderCode: string; amountPaise: number }): Promise<PaymentIntent>;
  verify(input: { reference: string; upiRef?: string }): Promise<{ paid: boolean; providerRef?: string }>;
  refund(input: { reference: string; amountPaise: number }): Promise<{ refunded: boolean }>;
}

/** Cash on delivery — settled by the rider, nothing external to call. */
export const codProvider: PaymentProvider = {
  name: 'cod',
  async createIntent({ orderCode, amountPaise }) {
    return {
      provider: 'cod', reference: `COD-${orderCode}`, amountPaise,
      instructions: 'Pay the delivery partner in cash when your order arrives.',
    };
  },
  async verify() { return { paid: false }; },
  async refund() { return { refunded: true }; },
};

/**
 * Mock UPI provider. Builds a real UPI deep link (works with any UPI app) and
 * accepts a UTR typed by the customer, which an admin then verifies.
 * Swap for RazorpayProvider later — nothing outside this folder changes.
 */
export const mockUpiProvider: PaymentProvider = {
  name: 'upi_mock',
  async createIntent({ orderCode, amountPaise }) {
    const amount = (amountPaise / 100).toFixed(2);
    const upiUri =
      `upi://pay?pa=${encodeURIComponent(env.UPI_VPA)}&pn=${encodeURIComponent('Doraha Eats')}` +
      `&am=${amount}&cu=INR&tn=${encodeURIComponent(orderCode)}`;
    return {
      provider: 'upi_mock', reference: `UPI-${orderCode}`, amountPaise, upiUri,
      qrPayload: upiUri,
      instructions: 'Pay using any UPI app, then enter the 12-digit UTR to confirm.',
    };
  },
  /** Dev rule: any 12-character UTR is treated as valid. Replace with gateway webhook. */
  async verify({ reference, upiRef }) {
    const paid = !!upiRef && upiRef.trim().length >= 6;
    return { paid, providerRef: paid ? `${reference}-VERIFIED` : undefined };
  },
  async refund() { return { refunded: true }; },
};

export function getPaymentProvider(method: 'COD' | 'UPI'): PaymentProvider {
  if (method === 'COD') return codProvider;
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    // Razorpay keys are optional; fall back rather than crash the MVP.
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      console.warn('[payments] RAZORPAY_* keys missing — using mock UPI provider.');
      return mockUpiProvider;
    }
  }
  return mockUpiProvider;
}

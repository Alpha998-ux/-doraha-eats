import { env } from '../../config/env.js';

export interface StorageProvider {
  /** Returns a URL the client can PUT to, plus the public URL it will live at. */
  signedUpload(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }>;
  publicUrl(key: string): string;
}

/** Local dev: files are served from /uploads by the API. No cloud account needed. */
const localProvider: StorageProvider = {
  async signedUpload(key) {
    return { uploadUrl: `/uploads/${key}`, publicUrl: `/uploads/${key}` };
  },
  publicUrl: (key) => `/uploads/${key}`,
};

export const storageProvider: StorageProvider =
  env.STORAGE_PROVIDER === 'local' ? localProvider : localProvider;

import { Dropbox } from "dropbox";

let dropboxClient: Dropbox | null = null;

export function getDropboxClient(): Dropbox {
  if (!dropboxClient) {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;

    if (!refreshToken || !appKey || !appSecret) {
      throw new Error(
        "Dropbox configuration is missing. Please set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET"
      );
    }

    dropboxClient = new Dropbox({
      clientId: appKey,
      clientSecret: appSecret,
      refreshToken,
      fetch: fetch.bind(globalThis),
    });
  }

  return dropboxClient;
}

export function isDropboxConfigured(): boolean {
  return !!(
    process.env.DROPBOX_REFRESH_TOKEN &&
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET
  );
}

export function generateAudioKey(
  collection: string,
  itemId: string,
  originalFilename: string
): string {
  const timestamp = Date.now();
  const extension = originalFilename.split(".").pop() || "mp3";
  return `/audio/${collection}/${itemId}/${timestamp}.${extension}`;
}

export async function uploadToDropbox(
  key: string,
  fileBuffer: Buffer,
  contentType?: string
): Promise<string> {
  const client = getDropboxClient();

  const response = await client.filesUpload({
    path: key,
    contents: new Uint8Array(fileBuffer),
    mode: { ".tag": "overwrite" },
    autorename: false,
    mute: true,
  });

  return response.result.path_display || key;
}

export async function getDropboxTemporaryLink(
  key: string
): Promise<string> {
  const client = getDropboxClient();

  const response = await client.filesGetTemporaryLink({
    path: key,
  });

  return response.result.link;
}

export async function deleteDropboxFile(key: string): Promise<void> {
  const client = getDropboxClient();

  await client.filesDeleteV2({
    path: key,
  });
}

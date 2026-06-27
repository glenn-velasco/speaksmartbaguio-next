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

/**
 * Detect a raw Dropbox URL (a temporary link or shared link) stored in the DB.
 * These cannot be reverse-mapped to a storage key from the URL alone; the real
 * key must be recovered by listing the item's folder.
 */
export function isStaleDropboxUrl(url: string): boolean {
  return (
    (url.startsWith("http://") || url.startsWith("https://")) &&
    (url.includes("dropbox.com") || url.includes("dropboxusercontent.com"))
  );
}

/**
 * List the files inside an item's audio folder.
 * Returns an empty array when the folder does not exist.
 */
async function listItemFolder(
  collection: string,
  itemId: string
): Promise<Array<{ path: string; serverModified: string }>> {
  const client = getDropboxClient();
  const folderPath = `/audio/${collection}/${itemId}`;

  try {
    const response = await client.filesListFolder({ path: folderPath });
    return response.result.entries
      .filter((entry) => entry[".tag"] === "file")
      .map((entry) => ({
        path: entry.path_display || `${folderPath}/${entry.name}`,
        serverModified: (entry as { server_modified?: string }).server_modified || "",
      }));
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const body = (error as { error?: unknown })?.error;
    const summary =
      typeof body === "string"
        ? body
        : (body as { error_summary?: string })?.error_summary ?? JSON.stringify(body ?? "");
    if (status === 409 || summary.includes("not_found")) {
      return [];
    }
    throw error;
  }
}

/**
 * Recover the real Dropbox storage key for an item by listing its folder and
 * picking the most-recently-modified file. Returns null if no file is found.
 */
export async function findDropboxKeyForItem(
  collection: string,
  itemId: string
): Promise<string | null> {
  const files = await listItemFolder(collection, itemId);

  if (files.length === 0) {
    return null;
  }

  files.sort((a, b) => b.serverModified.localeCompare(a.serverModified));
  return files[0].path;
}

/**
 * Delete every file in an item's audio folder except `keepKey`.
 * Used to remove orphaned/old audio while preserving a freshly-uploaded file
 * that already lives in the same folder. Tolerant of a missing folder.
 */
export async function pruneDropboxFolderExcept(
  collection: string,
  itemId: string,
  keepKey: string | null
): Promise<void> {
  const files = await listItemFolder(collection, itemId);

  for (const file of files) {
    if (keepKey && file.path === keepKey) {
      continue;
    }
    await deleteDropboxFile(file.path);
  }
}

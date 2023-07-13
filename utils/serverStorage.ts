import { createHash, randomBytes } from 'crypto'
import fs, { Dirent } from 'fs';

import { WORKING_DIR } from "@/config/serverSettings";

const CACHE_DIR = `${WORKING_DIR}/cache`;
const TMP_DIR = `${CACHE_DIR}/tmp`;

 
export class ServerStorage {

  constructor(private defaultTimeToLiveSec: number = 60) {
    // ensure cache and tmp folder
    if (!fs.existsSync(TMP_DIR)) {      
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  public async removeExpiredItems() {

    const expMs = Date.now();

    const files = await fs.promises.readdir(CACHE_DIR, { withFileTypes: true });
    files.forEach(async (entry: Dirent) => {
      if (entry.isFile()) {
        const filePath = `${CACHE_DIR}/${entry.name}`
        const stat = await fs.promises.stat(filePath);
        if (stat.mtimeMs < expMs) {
          fs.promises.unlink(filePath);
        }
      }
    });

  }

  private tmpFileName(): string {
    return `${TMP_DIR}/${randomBytes(16).toString('hex')}.tmp`;
  }

  private keyFileName(key: string) {
    return `${CACHE_DIR}/${createHash('md5').update(key, 'utf-8').digest('hex')}.obj`;
  }

  public async SetItem<T>(key: string, obj: T, timeToLiveSec: number = this.defaultTimeToLiveSec) {
    const tmpFile = this.tmpFileName();
    await fs.promises.writeFile(tmpFile, JSON.stringify(obj), 'utf-8');
    const validUnitlMs = Date.now() / 1000 + timeToLiveSec;
    await fs.promises.utimes(tmpFile, validUnitlMs, validUnitlMs);    
    await fs.promises.rename(tmpFile, this.keyFileName(key));
  }

  /**
   * 
   * @param key 
   * @param createCallback called to create  
   * @returns the item
   */
  public async GetCreateItem<T>(key: string, createCallback: () => T, timeToLiveSec: number = this.defaultTimeToLiveSec) {
    const keyFileName = this.keyFileName(key);
    try {
      const content = await fs.promises.readFile(keyFileName, 'utf-8');
      const obj = JSON.parse(content);
      return obj as T;
    } catch(error) {
      const item = createCallback();
      await this.SetItem(key, item, timeToLiveSec);
      return item;
    }
  }

}


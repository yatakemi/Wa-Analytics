import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1日 (ミリ秒)

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

function getCacheFilePath(key: string): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return path.join(CACHE_DIR, `${key}.json`);
}

export async function readCache<T>(key: string): Promise<T | null> {
  const filePath = getCacheFilePath(key);
  if (fs.existsSync(filePath)) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const cacheEntry: CacheEntry<T> = JSON.parse(content);
      if (Date.now() - cacheEntry.timestamp < CACHE_TTL_MS) {
        console.log(`  キャッシュから ${key} を読み込みました。`);
        return cacheEntry.data;
      } else {
        console.log(`  ${key} のキャッシュが期限切れです。`);
        fs.promises.unlink(filePath).catch((err) => console.error(`キャッシュファイル削除エラー (${filePath}):`, err));
      }
    } catch (error) {
      console.error(`キャッシュ読み込みエラー (${filePath}):`, error);
    }
  }
  return null;
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const filePath = getCacheFilePath(key);
  const cacheEntry: CacheEntry<T> = {
    timestamp: Date.now(),
    data: data,
  };
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(cacheEntry, null, 2), 'utf8');
    console.log(`  ${key} をキャッシュに保存しました。`);
  } catch (error) {
    console.error(`キャッシュ書き込みエラー (${filePath}):`, error);
  }
}

export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    console.log('キャッシュディレクトリをクリアしました。');
  }
}

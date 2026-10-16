import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src/config -> up 3 = repository root (karabakh-agro-invest)
const ROOT = path.resolve(__dirname, '../../..');

export const UPLOAD_DIR = path.join(ROOT, 'uploads');
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist');

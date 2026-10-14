import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface DomainPack {
  name: string;
  dir: string;
  packFile: string;
  markers: string[];
  altMarkers: string[];
}

const NAME_RE = /^[A-Za-z0-9._-]+$/;

// QA_DOMAIN_PACKS_DIR, else <home>/.qa-bug-hunter/domains (USERPROFILE on Windows).
export function getPacksRoot(): string {
  const fromEnv = process.env.QA_DOMAIN_PACKS_DIR;
  if (fromEnv && fromEnv.trim()) return path.resolve(fromEnv.trim());
  return path.join(os.homedir(), '.qa-bug-hunter', 'domains');
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.replace(/[`*_]/g, '').trim())
    .filter(Boolean);
}

// Reads `Markers:` / `Alt-Markers:` from the pack.md header (first 60 lines).
export function parsePack(name: string, root: string): DomainPack | null {
  if (!NAME_RE.test(name)) return null;
  const dir = path.join(root, name);
  const packFile = path.join(dir, 'pack.md');
  let text: string;
  try {
    text = fs.readFileSync(packFile, 'utf-8');
  } catch {
    return null;
  }
  const header = text.split(/\r?\n/).slice(0, 60);
  let markers: string[] = [];
  let altMarkers: string[] = [];
  for (const line of header) {
    const m = line.match(/^[\s>*_-]*(Alt-Markers|Markers)\s*:\s*\**\s*(.*)$/i);
    if (!m) continue;
    const list = parseList(m[2]);
    if (m[1].toLowerCase() === 'markers') markers = list;
    else altMarkers = list;
  }
  return { name, dir, packFile, markers, altMarkers };
}

function allExist(repoRoot: string, markers: string[]): boolean {
  return markers.length > 0 && markers.every(m => fs.existsSync(path.join(repoRoot, m)));
}

export function packMatches(pack: DomainPack, repoRoot: string): boolean {
  return allExist(repoRoot, pack.markers) || allExist(repoRoot, pack.altMarkers);
}

export interface DomainResolution {
  /** Pack name or 'none'. */
  name: string;
  packFile: string | null;
  how: 'explicit' | 'auto-detect' | 'none';
}

// Explicit name wins; otherwise scan every pack.md one level under the packs root
// against repoRoot. Never throws; a missing directory yields 'none'.
export function resolveDomain(explicit: string | undefined, repoRoot: string): DomainResolution {
  const none: DomainResolution = { name: 'none', packFile: null, how: 'none' };
  const root = getPacksRoot();
  try {
    if (explicit && explicit !== 'none') {
      const pack = parsePack(explicit, root);
      if (!pack) {
        console.warn(`Domain pack "${explicit}" not found under ${root}; continuing with none.`);
        return none;
      }
      return { name: pack.name, packFile: pack.packFile, how: 'explicit' };
    }
    if (explicit === 'none' || !fs.existsSync(root)) return none;
    const names = fs
      .readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
    for (const n of names) {
      const pack = parsePack(n, root);
      if (pack && packMatches(pack, repoRoot)) {
        return { name: pack.name, packFile: pack.packFile, how: 'auto-detect' };
      }
    }
  } catch {
    // unreadable pack dir: treat as no pack
  }
  return none;
}

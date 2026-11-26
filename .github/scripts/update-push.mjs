// Liest den obersten Eintrag der Update-Liste und schickt ihn als Push an alle Geräte aus casino-push-abos.json (privates Repo Larsens-World-Daten).
import webpush from 'web-push';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const DATA = 'https://api.github.com/repos/Larsen140/Larsens-World-Daten/contents/';
const { DATA_TOKEN, BEFORE, MANUAL } = process.env;
const headers = { Authorization: `Bearer ${DATA_TOKEN}`, Accept: 'application/vnd.github+json' };

export function topEntry(html) {
  const m = html.match(/const UPDATES=\[\s*\{v:'([^']+)',d:'[^']*',t:'((?:[^'\\]|\\.)*)'/);
  return m ? { v: m[1], t: m[2].replace(/\\(.)/g, '$1') } : null;
}
async function readJson(name) {
  const r = await fetch(DATA + name, { headers });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${name} nicht lesbar (${r.status}) – stimmt der DATA_TOKEN?`);
  const j = await r.json();
  return { sha: j.sha, data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) };
}

async function main() {
  if (!DATA_TOKEN) { console.log('⚠️  Secret DATA_TOKEN fehlt noch – keine Nachricht gesendet.'); return; }
  const cur = topEntry(fs.readFileSync('index.html', 'utf8'));
  if (!cur) { console.log('Kein Eintrag in der Update-Liste gefunden.'); return; }
  const manual = MANUAL === 'true';
  if (!manual) {
    let prev = null;
    if (BEFORE && !/^0+$/.test(BEFORE)) { try { prev = topEntry(execSync(`git show ${BEFORE}:index.html`, { maxBuffer: 50e6 }).toString()); } catch {} }
    if (prev && prev.v === cur.v) { console.log(`Version ${cur.v} unverändert – keine Nachricht.`); return; }
  }
  const keys = await readJson('casino-vapid.json');
  if (!keys) throw new Error('casino-vapid.json fehlt im Daten-Repo.');
  const file = await readJson('casino-push-abos.json');
  if (!file || !file.data.length) { console.log('Noch kein Gerät angemeldet.'); return; }

  webpush.setVapidDetails('https://larsen140.github.io/Larsens-Casino/', keys.data.publicKey, keys.data.privateKey);
  const payload = JSON.stringify(manual
    ? { title: 'Larsens Casino', body: `Test: Benachrichtigungen funktionieren (Version ${cur.v})`, tag: 'test' }
    : { title: `Neues Update – Version ${cur.v}`, body: cur.t, tag: 'update-' + cur.v });

  const keep = [];
  for (const s of file.data) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 86400 }); console.log(`✓ gesendet an ${s.device || 'Gerät'}`); keep.push(s); }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) console.log(`✗ ${s.device || 'Gerät'} ist nicht mehr angemeldet – wird entfernt`);
      else { console.log(`✗ ${s.device || 'Gerät'}: Fehler ${e.statusCode || ''} ${e.body || e.message}`); keep.push(s); }
    }
  }
  if (keep.length !== file.data.length) {
    const body = { message: 'Casino: abgemeldete Geräte entfernt', sha: file.sha, content: Buffer.from(JSON.stringify(keep, null, 1)).toString('base64') };
    await fetch(DATA + 'casino-push-abos.json', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
}
main().catch(e => { console.log('Fehler:', e.message); process.exitCode = 1; });

/* global RTCPeerConnection -- dipakai di dalam page.evaluate (konteks browser) */
// Periksa konfigurasi TURN sebelum deploy.
// Membaca VITE_ICE_SERVERS / VITE_ICE_SERVERS_URL dari environment atau .env.local / .env,
// lalu meminta kandidat relay di Chromium sungguhan.
// Pakai: node scripts/turn-check.mjs
import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(VITE_ICE_SERVERS(?:_URL)?)\s*=\s*(.*)\s*$/.exec(line);
      if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return env;
}

const env = loadEnv();
let servers = [];
if (env.VITE_ICE_SERVERS_URL) {
  try {
    const r = await fetch(env.VITE_ICE_SERVERS_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error('bukan array');
    servers.push(...list);
    console.log(`URL: ${list.length} server diterima.`);
  } catch (e) {
    console.log(`URL gagal: ${e.message}`);
  }
}
if (env.VITE_ICE_SERVERS) {
  try {
    servers.push(...JSON.parse(env.VITE_ICE_SERVERS));
  } catch {
    console.log('VITE_ICE_SERVERS bukan JSON yang sah.');
  }
}
const turn = servers.filter((s) => [s.urls].flat().some((u) => /^turns?:/.test(u)));
if (!turn.length) {
  console.log(
    'Tidak ada server TURN. Isi VITE_ICE_SERVERS_URL atau VITE_ICE_SERVERS (lihat docs/MULTIPLAYER.md).',
  );
  process.exit(1);
}
console.log(`Menguji ${turn.length} entri TURN...`);
const b = await chromium.launch();
const p = await b.newPage();
const relays = await p.evaluate(async (iceServers) => {
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
  pc.createDataChannel('uji');
  const found = [];
  const done = new Promise((res) => {
    pc.onicecandidate = (e) => (e.candidate ? found.push(e.candidate.candidate) : res());
    setTimeout(res, 8000);
  });
  await pc.setLocalDescription(await pc.createOffer());
  await done;
  pc.close();
  return found.filter((c) => / typ relay /.test(c)).map((c) => c.split(' ').slice(4, 8).join(' '));
}, turn);
await b.close();
if (relays.length) {
  console.log(`TURN berfungsi: ${relays.length} kandidat relay.`);
  process.exit(0);
}
console.log('TURN TIDAK menjawab: periksa username/credential, kuota, atau blokir jaringan.');
process.exit(1);

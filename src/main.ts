import { assetUrl } from './assetUrl';

const app = document.getElementById('app');
if (app) {
  const h1 = document.createElement('h1');
  h1.textContent = 'Nusantara Ngawur';
  const p = document.createElement('p');
  p.textContent = 'Sabang sampai Merauke. (Fase 0: fondasi)';
  const img = document.createElement('img');
  img.alt = 'Bidak';
  img.src = assetUrl('ppl/p0.webp');
  img.height = 96;
  app.append(h1, p, img);
}

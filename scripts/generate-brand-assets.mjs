import fs from 'fs';
import path from 'path';

export const BRANDS = [
  { name: 'Head Field', sub: 'TALENT & SOLUTIONS', primary: '#0f172a', accent: '#8b1e24', truck: '#ea6c3c', truckShade: '#c2410c', ground: '#9a4a16', bgTop: '#fdfbf6', bgBot: '#f8efe2' },
  { name: 'Glocal Edit', sub: 'CONTENT & EDITORIAL', primary: '#312e81', accent: '#d97706', truck: '#e06d3b', truckShade: '#b45309', ground: '#92400e', bgTop: '#fdfcf8', bgBot: '#fef3c7' },
  { name: 'Glocal BPO', sub: 'BUSINESS OPERATIONS', primary: '#134e4a', accent: '#ea580c', truck: '#ea580c', truckShade: '#9a3412', ground: '#7c2d12', bgTop: '#fafdf9', bgBot: '#ffedd5' },
  { name: 'Glocal RPO', sub: 'RECRUITMENT PARTNER', primary: '#1e3a8a', accent: '#ca8a04', truck: '#d97706', truckShade: '#92400e', ground: '#854d0e', bgTop: '#fdfbf7', bgBot: '#fef9c3' },
  { name: 'Glocal Accounting', sub: 'FINANCE & TAX', primary: '#064e3b', accent: '#b45309', truck: '#d97706', truckShade: '#92400e', ground: '#78350f', bgTop: '#fcfdfb', bgBot: '#fef3c7' },
  { name: 'HF Events', sub: 'EXPERIENCES & EVENTS', primary: '#881337', accent: '#f59e0b', truck: '#e11d48', truckShade: '#9f1239', ground: '#881337', bgTop: '#fffbfb', bgBot: '#ffe4e6' },
  { name: 'Glocal Design', sub: 'CREATIVE STUDIO', primary: '#4c1d95', accent: '#ea580c', truck: '#ea580c', truckShade: '#c2410c', ground: '#9a3412', bgTop: '#fdfaff', bgBot: '#ffedd5' },
  { name: 'Glocal LPO', sub: 'LEGAL PROCESS', primary: '#1e293b', accent: '#991b1b', truck: '#c2410c', truckShade: '#7c2d12', ground: '#78350f', bgTop: '#fdfbf7', bgBot: '#fee2e2' },
  { name: 'Glocal Opportunities', sub: 'GROWTH & CAREERS', primary: '#0c4a6e', accent: '#d97706', truck: '#ea6c3c', truckShade: '#c2410c', ground: '#92400e', bgTop: '#fafcff', bgBot: '#fef3c7' },
  { name: 'Glocal Assist', sub: 'VIRTUAL ASSISTANCE', primary: '#164e63', accent: '#c2410c', truck: '#ea580c', truckShade: '#9a3412', ground: '#7c2d12', bgTop: '#fafdfe', bgBot: '#ffedd5' },
  { name: 'Glocal Codes', sub: 'SOFTWARE & TECH', primary: '#1e3a8a', accent: '#b45309', truck: '#d97706', truckShade: '#b45309', ground: '#78350f', bgTop: '#fafbff', bgBot: '#fef3c7' },
  { name: 'Glocal Studio', sub: 'MEDIA & BRANDING', primary: '#701a75', accent: '#ca8a04', truck: '#db2777', truckShade: '#9d174d', ground: '#831843', bgTop: '#fefaff', bgBot: '#fce7f3' },
  { name: 'HF Realtors', sub: 'REAL ESTATE', primary: '#14532d', accent: '#c2410c', truck: '#c2410c', truckShade: '#9a3412', ground: '#7c2d12', bgTop: '#fafdf9', bgBot: '#ffedd5' },
];

for (const dir of ['public/uploads', 'server/uploads']) {
  fs.mkdirSync(dir, { recursive: true });
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

for (const b of BRANDS) {
  const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const upperName = escapeXml(b.name.toUpperCase());
  const subLabel = escapeXml(b.sub);
  const fontSize = b.name.length > 15 ? 21 : b.name.length > 12 ? 25 : 29;

  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="82" viewBox="0 0 380 82">
  <rect width="380" height="82" fill="#ffffff"/>
  <text x="190" y="39" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="3" fill="${b.primary}">${upperName}</text>
  <line x1="34" y1="56" x2="108" y2="56" stroke="${b.accent}" stroke-width="3"/>
  <text x="190" y="60" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="1.8" fill="#475569">${subLabel}</text>
  <line x1="272" y1="56" x2="346" y2="56" stroke="${b.accent}" stroke-width="3"/>
</svg>`;

  const signText = upperName.length > 14 ? upperName.slice(0, 14) : upperName;
  const posterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="540" viewBox="0 0 600 540">
  <defs>
    <linearGradient id="bg-${slug}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${b.bgTop}"/>
      <stop offset="100%" stop-color="${b.bgBot}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="540" fill="url(#bg-${slug})"/>
  <g opacity="0.92">
    <g transform="translate(55,34) rotate(-18)"><ellipse cx="0" cy="0" rx="22" ry="42" fill="#b91c1c"/><ellipse cx="-18" cy="10" rx="16" ry="26" transform="rotate(-35)" fill="#b91c1c"/><ellipse cx="18" cy="10" rx="16" ry="26" transform="rotate(35)" fill="#b91c1c"/></g>
    <g transform="translate(150,24) rotate(12)"><ellipse cx="0" cy="0" rx="26" ry="48" fill="#f59e0b"/><ellipse cx="-20" cy="12" rx="18" ry="28" transform="rotate(-35)" fill="#f59e0b"/><ellipse cx="20" cy="12" rx="18" ry="28" transform="rotate(35)" fill="#f59e0b"/></g>
    <g transform="translate(245,18) rotate(-10)"><ellipse cx="0" cy="0" rx="20" ry="38" fill="#991b1b"/><ellipse cx="-15" cy="10" rx="14" ry="22" transform="rotate(-35)" fill="#991b1b"/><ellipse cx="15" cy="10" rx="14" ry="22" transform="rotate(35)" fill="#991b1b"/></g>
    <g transform="translate(345,28) rotate(16)"><ellipse cx="0" cy="0" rx="26" ry="48" fill="#d97706"/><ellipse cx="-20" cy="12" rx="18" ry="28" transform="rotate(-35)" fill="#d97706"/><ellipse cx="20" cy="12" rx="18" ry="28" transform="rotate(35)" fill="#d97706"/></g>
    <g transform="translate(445,20) rotate(-14)"><ellipse cx="0" cy="0" rx="22" ry="42" fill="#eab308"/><ellipse cx="-18" cy="10" rx="15" ry="24" transform="rotate(-35)" fill="#eab308"/><ellipse cx="18" cy="10" rx="15" ry="24" transform="rotate(35)" fill="#eab308"/></g>
    <g transform="translate(538,34) rotate(22)"><ellipse cx="0" cy="0" rx="24" ry="44" fill="#c2410c"/><ellipse cx="-18" cy="10" rx="16" ry="24" transform="rotate(-35)" fill="#c2410c"/><ellipse cx="18" cy="10" rx="16" ry="24" transform="rotate(35)" fill="#c2410c"/></g>
  </g>
  <g transform="rotate(-4 300 245)">
    <text x="300" y="218" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" fill="${b.accent}">Happy</text>
    <text x="300" y="274" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="48" fill="${b.primary}">Thanksgiving!</text>
  </g>
  <rect x="0" y="476" width="600" height="64" fill="${b.ground}"/>
  <ellipse cx="118" cy="402" rx="28" ry="22" fill="#92400e"/>
  <ellipse cx="164" cy="396" rx="34" ry="26" fill="#d97706"/>
  <ellipse cx="210" cy="404" rx="24" ry="19" fill="#64748b"/>
  <rect x="74" y="416" width="166" height="58" rx="8" fill="${b.truck}"/>
  <path d="M236,374 L305,374 L334,418 L374,424 C384,426 390,434 390,444 L390,474 L236,474 Z" fill="${b.truck}"/>
  <path d="M250,384 L298,384 L320,418 L250,418 Z" fill="#fef3c7"/>
  <rect x="74" y="456" width="316" height="18" rx="4" fill="${b.truckShade}"/>
  <circle cx="144" cy="478" r="26" fill="#1e293b"/><circle cx="144" cy="478" r="14" fill="#f8fafc"/><circle cx="144" cy="478" r="6" fill="#334155"/>
  <circle cx="332" cy="478" r="26" fill="#1e293b"/><circle cx="332" cy="478" r="14" fill="#f8fafc"/><circle cx="332" cy="478" r="6" fill="#334155"/>
  <rect x="444" y="388" width="14" height="92" rx="3" fill="#78350f"/>
  <rect x="372" y="380" width="156" height="46" rx="6" fill="#9a6b3b" stroke="#78350f" stroke-width="2"/>
  <text x="450" y="408" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" fill="#ffffff">${signText}</text>
  <ellipse cx="412" cy="466" rx="22" ry="18" fill="#eab308"/>
  <ellipse cx="496" cy="458" rx="30" ry="30" fill="#f59e0b"/>
</svg>`;

  for (const dir of ['public/uploads', 'server/uploads']) {
    fs.writeFileSync(path.join(dir, `logo-${slug}.svg`), logoSvg, 'utf8');
    fs.writeFileSync(path.join(dir, `poster-${slug}.svg`), posterSvg, 'utf8');
  }
}

console.log(`Generated ${BRANDS.length * 2} brand assets in public/uploads and server/uploads`);

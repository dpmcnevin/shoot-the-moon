// Renders the app icon: the game's own pixel-art queen of spades on the felt.
// Usage: node make-icon.cjs <game-bundle.js> <out.png>
const vm = require('vm'), fs = require('fs'), zlib = require('zlib');
const [bundle, out] = process.argv.slice(2);
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(bundle, 'utf8'), ctx);
const S = vm.runInContext('ShootTheMoon', ctx);
const card = JSON.parse(S.cardImage(4, 12, false, false));
const src = Buffer.from(card.rgba, 'base64');

const N = 1024, px = new Uint8Array(N * N * 4);
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const felt = hex(0x14402c), light = hex(0x1c5239), edge = hex(0x0b1f17);

// Felt with sunburst rays and a vignette, in chunky 8px blocks to match the art.
const B = 8;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
	const bx = Math.floor(x / B) * B + B / 2, by = Math.floor(y / B) * B + B / 2;
	const dx = bx - N / 2, dy = by - N * 0.56;
	const ray = Math.floor(((Math.atan2(dy, dx) / (2 * Math.PI)) + 1) * 18) % 2 === 0;
	const base = ray ? light : felt;
	const d = Math.min(1, Math.hypot(dx, dy) / (N * 0.75));
	const k = d * d * 0.8;
	const i = (y * N + x) * 4;
	for (let c = 0; c < 3; c++) px[i + c] = Math.round(base[c] * (1 - k) + edge[c] * k);
	px[i + 3] = 255;
}

// The card at 14x, with a hard shadow down and to the right.
const s = 14, cw = card.w * s, ch = card.h * s;
const ox = Math.round((N - cw) / 2) - 8, oy = Math.round((N - ch) / 2) - 8;
const blit = (offX, offY, shadow) => {
	for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
		const si = (Math.floor(y / s) * card.w + Math.floor(x / s)) * 4;
		const a = src[si + 3] / 255;
		if (a === 0) continue;
		const i = ((oy + offY + y) * N + (ox + offX + x)) * 4;
		for (let c = 0; c < 3; c++) {
			const v = shadow ? px[i + c] * 0.45 : src[si + c];
			px[i + c] = Math.round(px[i + c] * (1 - a) + v * a);
		}
	}
};
blit(28, 34, true);
blit(0, 0, false);

// Minimal PNG writer.
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
	return Buffer.concat([len, td, c]);
};
const raw = Buffer.alloc(N * (N * 3 + 1));
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
	const i = (y * N + x) * 4, o = y * (N * 3 + 1) + 1 + x * 3;
	raw[o] = px[i]; raw[o + 1] = px[i + 1]; raw[o + 2] = px[i + 2];
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
]));
console.log('wrote', out);

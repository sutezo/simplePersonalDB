// Generates the PWA icon PNGs (static/icons) without external dependencies:
// a dark rounded background with a light "database dot" circle.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRC_TABLE = new Int32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});

/**
 * Computes the CRC32 checksum of a buffer (PNG chunk checksum).
 * @param {Buffer} buf - Input bytes.
 * @returns {number} Unsigned CRC32 value.
 */
function crc32(buf) {
	let c = -1;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

/**
 * Builds one PNG chunk (length + type + data + CRC).
 * @param {string} type - Four-character chunk type.
 * @param {Buffer} data - Chunk payload.
 * @returns {Buffer} Encoded chunk.
 */
function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

/**
 * Renders the icon as a truecolor PNG.
 * @param {number} size - Icon width/height in pixels.
 * @returns {Buffer} PNG file bytes.
 */
function renderIcon(size) {
	const bg = [15, 23, 42]; // slate-900
	const fg = [125, 211, 252]; // sky-300
	const cx = size / 2;
	const cy = size / 2;
	const radius = size * 0.3;

	const raw = Buffer.alloc(size * (1 + size * 3));
	for (let y = 0; y < size; y++) {
		const rowStart = y * (1 + size * 3);
		raw[rowStart] = 0; // filter: none
		for (let x = 0; x < size; x++) {
			const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
			const [r, g, b] = inCircle ? fg : bg;
			const offset = rowStart + 1 + x * 3;
			raw[offset] = r;
			raw[offset + 1] = g;
			raw[offset + 2] = b;
		}
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: truecolor
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
	writeFileSync(join(outDir, `icon-${size}.png`), renderIcon(size));
	console.log(`generated icon-${size}.png`);
}

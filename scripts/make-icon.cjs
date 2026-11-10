'use strict';

const fs = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, '..', 'src', 'icons');
const sizes = [256, 128, 48, 32, 16];
const images = sizes.map(size => {
  const file = path.join(directory, `icon${size}.png`);
  const png = fs.readFileSync(file);
  if (png.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`Invalid PNG icon: ${file}`);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (width !== size || height !== size) throw new Error(`Expected ${size}×${size} PNG, got ${width}×${height}`);
  return { size, png };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = 6 + images.length * 16;
const entries = images.map(({ size, png }) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

const output = path.join(directory, 'icon.ico');
fs.writeFileSync(output, Buffer.concat([header, ...entries, ...images.map(image => image.png)]));
process.stdout.write(`Created ${output}\n`);

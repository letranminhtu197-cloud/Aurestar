import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [archivePathArg, destinationArg, toolsRootArg] = process.argv.slice(2);
if (!archivePathArg || !destinationArg || !toolsRootArg) {
  console.error('Usage: node extract-packed-asar.mjs <archive> <destination> <asar-tools-root>');
  process.exit(2);
}

const archivePath = path.resolve(archivePathArg);
const destination = path.resolve(destinationArg);
const toolsRoot = path.resolve(toolsRootArg);
if (!fs.existsSync(archivePath)) throw new Error(`ASAR archive not found: ${archivePath}`);

const requireFromTools = createRequire(path.join(toolsRoot, 'package.json'));
const asarEntry = requireFromTools.resolve('@electron/asar');
const asar = await import(pathToFileURL(asarEntry).href);
const getRawHeader = asar.getRawHeader ?? asar.default?.getRawHeader;
const extractFile = asar.extractFile ?? asar.default?.extractFile;
if (typeof getRawHeader !== 'function' || typeof extractFile !== 'function') {
  throw new Error('Installed @electron/asar package does not expose the required header/extract APIs.');
}

fs.mkdirSync(destination, { recursive: true });
const { header } = getRawHeader(archivePath);
if (!header?.files || typeof header.files !== 'object') {
  throw new Error('ASAR header has no root files object.');
}

const extracted = [];
const omittedUnpacked = [];
const omittedUnpackedDirectories = [];
const omittedLinks = [];

function safeDestination(relativePath) {
  const segments = relativePath.split('/').filter(Boolean);
  const target = path.resolve(destination, ...segments);
  const relative = path.relative(destination, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing path outside extraction directory: ${relativePath}`);
  }
  return target;
}

/**
 * Entries below an ASAR directory flagged "unpacked" are stored outside the
 * archive. Child entries do not necessarily repeat that flag, so collect
 * their names recursively and never pass them to extractFile().
 */
function collectUnpackedTree(entries, prefix) {
  for (const [name, entry] of Object.entries(entries)) {
    const relativePath = prefix ? `${prefix}/${name}` : name;

    if (entry && typeof entry === 'object' && entry.files && typeof entry.files === 'object') {
      collectUnpackedTree(entry.files, relativePath);
      continue;
    }

    if (entry && typeof entry === 'object' && typeof entry.link === 'string') {
      omittedLinks.push(relativePath);
      continue;
    }

    omittedUnpacked.push(relativePath);
  }
}

function walk(entries, prefix = '') {
  for (const [name, entry] of Object.entries(entries)) {
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const target = safeDestination(relativePath);

    if (entry && typeof entry === 'object' && entry.files && typeof entry.files === 'object') {
      if (entry.unpacked === true) {
        omittedUnpackedDirectories.push(relativePath);
        collectUnpackedTree(entry.files, relativePath);
        continue;
      }

      fs.mkdirSync(target, { recursive: true });
      walk(entry.files, relativePath);
      continue;
    }

    if (entry && typeof entry === 'object' && typeof entry.link === 'string') {
      omittedLinks.push(relativePath);
      continue;
    }

    if (entry?.unpacked === true) {
      omittedUnpacked.push(relativePath);
      continue;
    }

    if (!entry || typeof entry.offset !== 'string' || typeof entry.size !== 'number') {
      throw new Error(`Unrecognized ASAR entry at ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, extractFile(archivePath, relativePath));
    extracted.push(relativePath);
  }
}

walk(header.files);

const report = {
  archive: path.basename(archivePath),
  extractedPackedFiles: extracted.length,
  omittedUnpackedFiles: omittedUnpacked.length,
  omittedUnpackedDirectories: omittedUnpackedDirectories.length,
  omittedLinks: omittedLinks.length,
  extracted,
  omittedUnpacked,
  omittedUnpackedDirectories,
  omittedLinks
};
fs.writeFileSync(
  path.join(destination, '.ci-extraction-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log(JSON.stringify({
  extractedPackedFiles: report.extractedPackedFiles,
  omittedUnpackedFiles: report.omittedUnpackedFiles,
  omittedUnpackedDirectories: report.omittedUnpackedDirectories,
  omittedLinks: report.omittedLinks
}, null, 2));

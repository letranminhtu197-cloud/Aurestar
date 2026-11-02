const fs = require('node:fs');
const path = require('node:path');

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node patch-recovered-source.cjs <asar-extract-directory>');
  process.exit(2);
}

const rendererPath = path.join(sourceDir, 'renderer.js');
if (!fs.existsSync(rendererPath)) {
  throw new Error(`Recovered renderer.js not found: ${rendererPath}`);
}

let renderer = fs.readFileSync(rendererPath, 'utf8');
const replacements = [
  {
    before: "$('[data-edit-task]').forEach",
    after: "$$('[data-edit-task]').forEach"
  },
  {
    before: "$('[data-task-menu]').forEach",
    after: "$$('[data-task-menu]').forEach"
  }
];

for (const item of replacements) {
  const beforeCount = renderer.split(item.before).length - 1;
  const afterCount = renderer.split(item.after).length - 1;

  if (beforeCount === 1 && afterCount === 0) {
    renderer = renderer.replace(item.before, () => item.after);
  } else if (beforeCount === 0 && afterCount === 1) {
    // Already patched; keep the operation idempotent.
  } else {
    throw new Error(
      `Expected exactly one original or patched selector. Original=${beforeCount}, patched=${afterCount}`
    );
  }
}

fs.writeFileSync(rendererPath, renderer, 'utf8');
console.log('Applied/verified the two bindGlobal() querySelectorAll corrections.');

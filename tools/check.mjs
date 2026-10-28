import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files = ['config.js', 'studio-config.js', 'verify-ui.cjs'];
for (const dir of ['js', 'tools', 'tests']) {
  for (const file of await readdir(dir)) if (/\.(m?js|cjs)$/.test(file)) files.push(`${dir}/${file}`);
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit', windowsHide: true});
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);

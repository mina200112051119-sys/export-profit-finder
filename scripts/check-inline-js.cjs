const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]))
  .map((match) => match[2])
  .filter((source) => source.trim());

if (!scripts.length) {
  throw new Error('index.html に検査対象のインラインJavaScriptがありません');
}

scripts.forEach((source, index) => {
  try {
    new vm.Script(source, { filename: 'index.html:inline-script-' + (index + 1) });
    console.log('OK: index.html inline script ' + (index + 1));
  } catch (error) {
    console.error('NG: index.html inline script ' + (index + 1));
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
});

import fs from 'node:fs/promises';
const names=['index.html','app.js','model.js','style.css'];
await fs.mkdir('docs',{recursive:true});
for(const n of names)await fs.copyFile(n,'docs/'+n);
await fs.writeFile('docs/.nojekyll','');
console.log('Pages assets updated. docs/config.js contains public connection settings only.');

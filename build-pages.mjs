import fs from 'node:fs/promises';
const names=['index.html','app.js','model.js','style.css','manifest.webmanifest'];
await fs.mkdir('docs',{recursive:true});
for(const n of names)await fs.copyFile(n,'docs/'+n);
await fs.cp('icons','docs/icons',{recursive:true});
await fs.writeFile('docs/.nojekyll','');
console.log('Pages assets and icons updated. docs/config.js contains public settings only.');

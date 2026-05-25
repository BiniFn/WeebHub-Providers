const fs = require('fs');

const lightNovelManifestPath = 'src/plugins/Light novel/manifest.json';
let lnManifest = JSON.parse(fs.readFileSync(lightNovelManifestPath, 'utf8'));
lnManifest.version = '1.0.3'; // or whatever it was + 1
fs.writeFileSync(lightNovelManifestPath, JSON.stringify(lnManifest, null, 2));
console.log("Bumped Light Novel to " + lnManifest.version);

const comicManifestPath = 'src/plugins/Comics/manifest.json';
let comicManifest = JSON.parse(fs.readFileSync(comicManifestPath, 'utf8'));
comicManifest.version = '1.0.6';
fs.writeFileSync(comicManifestPath, JSON.stringify(comicManifest, null, 2));
console.log("Bumped Comics to " + comicManifest.version);

const fs = require('fs');
let content = fs.readFileSync('src/plugins/Comics/main.ts', 'utf-8');

// Replace anilist with comic_metadata
content = content.replace(/src\/plugins\/Comics\/anilist\.js/g, 'src/plugins/Comics/comic_metadata.js');
content = content.replace(/AnilistQueries/g, 'ComicMetadataQueries');

// Fix the Discover title
content = content.replace(/>Trending Light Comics</g, '>Popular Comics<');
content = content.replace(/>Search Light Comics</g, '>Search Comics<');
content = content.replace(/Search Anilist/g, 'Search Comics');

fs.writeFileSync('src/plugins/Comics/main.ts', content);
console.log('Patched main.ts');

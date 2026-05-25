const fs = require('fs');
const files = [
    'src/plugins/Light novel/providers/novelfire.js',
    'src/plugins/Light novel/providers/novelbin.js',
    'src/plugins/Light novel/providers/novelbuddy.js',
    'src/plugins/Light novel/providers/novelhall.js',
    'src/plugins/Light novel/providers/readlightnovel.js'
];

const newSimilarity = `    function getSimilarity(s1, s2) {
        let longer = s1.toLowerCase().trim();
        let shorter = s2.toLowerCase().trim();
        if (s1.length < s2.length) { longer = s2.toLowerCase().trim(); shorter = s1.toLowerCase().trim(); }
        let longerLength = longer.length;
        if (longerLength == 0) { return 1.0; }
        
        if (longer.startsWith(shorter) || longer.includes(shorter)) {
            return Math.max(0.85, (longerLength - getLevenshteinDistance(longer, shorter)) / parseFloat(longerLength));
        }

        const distance = getLevenshteinDistance(longer, shorter);
        return (longerLength - distance) / parseFloat(longerLength);
    }`;

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/    function getSimilarity\(s1, s2\) \{[\s\S]*?return \(longerLength - distance\) \/ parseFloat\(longerLength\);\n    \}/, newSimilarity);
    
    // Also fix the syntax error in novelfire.js
    if (file.includes('novelfire.js')) {
        content = content.replace(/return \[\];proxyrl\(\)\n\s*\}/g, 'return [];\n        }');
    }
    
    fs.writeFileSync(file, content);
    console.log("Fixed " + file);
}

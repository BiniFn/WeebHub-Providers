const fs = require('fs');
const path = require('path');

const SEANIME_DIR = '/Users/amela/Visual Studio Code/seanime-extension/online-streaming';
const WEEBHUB_DIR = '/Users/amela/Visual Studio Code/WeebHub_Providers_Target/src/anime';
const MARKETPLACE_JSON = '/Users/amela/Visual Studio Code/WeebHub_Providers_Target/marketplace/main.json';

const PROVIDERS_TO_PORT = [
    'anikoto', 'anime-sama', 'anime-sama-vip', 'anime-ultra', 
    'french-anime', 'hanime', 'hentaihaven', 'oppai-stream', 
    'toonanime', 'vostfree', 'watchhentai'
];

function fixBrokenStuff(payload) {
    let newPayload = payload;
    
    // 1. Remove /// <reference ... />
    newPayload = newPayload.replace(/\/\/\/ <reference path=".*?" \/>\n/g, '');

    // 2. WeebHub doesn't have ChromeDP. We need to implement regex fallbacks for Voe, Vidmoly, Sendvid.
    // For Voe: look for `var hls = 'url'` or `"hls": "url"`
    // For Sendvid: look for `video_source = "url"`
    // For Vidmoly: look for `file:"url"`
    const fallbackRegexCode = `
        const targetUrl = (typeof embedUrl !== "undefined") ? embedUrl : ((typeof serverUrl !== "undefined") ? serverUrl : arguments[0]);
        const cleanUrl = targetUrl.replace(/\\\\\\\\/g, '');
        console.log("[ChromeDP Polyfill] Attempting regex extraction for: " + targetUrl);
        
        let extractedSources = [];
        try {
            const html = await fetch(targetUrl).then(r => r.text());
            
            // Vidmoly / Sendvid / JWPlayer
            const jwMatch = html.match(/file\\s*:\\s*["']([^"']+\\.(?:mp4|m3u8))["']/i);
            if (jwMatch) extractedSources.push({ url: jwMatch[1], type: jwMatch[1].includes('.m3u8') ? 'm3u8' : 'mp4' });
            
            // Voe.sx
            const voeMatch = html.match(/'hls'\\s*:\\s*'(http[^']+)'/i) || html.match(/"hls"\\s*:\\s*"(http[^"]+)"/i);
            if (voeMatch) extractedSources.push({ url: voeMatch[1], type: 'm3u8' });
            
            // Generic MP4/M3U8 fallback
            if (extractedSources.length === 0) {
                const genericMatch = html.match(/https?:\\\\/\\\\/[^"']+\\\\.(?:mp4|m3u8)/gi);
                if (genericMatch) {
                    genericMatch.forEach(u => extractedSources.push({ url: u, type: u.includes('.m3u8') ? 'm3u8' : 'mp4' }));
                }
            }
            
            if (extractedSources.length > 0) {
                return JSON.stringify(extractedSources);
            }
        } catch (e) {
            console.error("[ChromeDP Polyfill] Failed", e);
        }
        return JSON.stringify([]);
    `;

    // Replace ChromeDP evaluation in handleServerUrl or extractViaChromedp
    // `const browser = await ChromeDP.newBrowser...`
    // `const extracted = await browser.evaluate(...);`
    // We will replace ChromeDP with our fetch + regex code.
    newPayload = newPayload.replace(
        /const browser = await ChromeDP\.newBrowser[^]+?const sources = JSON\.parse\(extracted\);/g,
        fallbackRegexCode + '\nconst sources = JSON.parse(extractedSources.length > 0 ? JSON.stringify(extractedSources) : "[]");'
    );

    newPayload = newPayload.replace(
        /const browser = await ChromeDP\.newBrowser[^]+?const parsed = JSON\.parse\(raw\);/g,
        fallbackRegexCode + '\nconst parsed = JSON.parse(extractedSources.length > 0 ? JSON.stringify(extractedSources[0]) : "{}");'
    );

    // Some places use ChromeDP for proxyFetch fallback
    newPayload = newPayload.replace(
        /const browser = await ChromeDP\.newBrowser[^]+?await browser\.close\(\);\n\s*if\s*\(url\.includes\("vidstream"\)\)[^]+?return result;/g,
        `return await fetch(url).then(r => r.text());`
    );

    return newPayload;
}

function run() {
    let marketplaceStr = fs.readFileSync(MARKETPLACE_JSON, 'utf-8');
    let marketplace = JSON.parse(marketplaceStr);

    for (const provider of PROVIDERS_TO_PORT) {
        console.log("Porting " + provider);
        const sourceManifestPath = path.join(SEANIME_DIR, provider, 'manifest.json');
        if (!fs.existsSync(sourceManifestPath)) {
            console.log("Skipping " + provider + " (no manifest)");
            continue;
        }

        const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf-8'));
        const payload = sourceManifest.payload;
        if (!payload) {
            console.log("Skipping " + provider + " (no payload in manifest)");
            continue;
        }

        const fixedPayload = fixBrokenStuff(payload);

        // Create target directory
        const targetDir = path.join(WEEBHUB_DIR, provider);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Write provider.ts
        fs.writeFileSync(path.join(targetDir, 'provider.ts'), fixedPayload);
        
        // Write icon if exists
        const iconPath = path.join(SEANIME_DIR, provider, 'favicon.png');
        if (fs.existsSync(iconPath)) {
            fs.copyFileSync(iconPath, path.join(targetDir, 'favicon.png'));
        }

        // Create WeebHub manifest
        const newManifest = {
            id: sourceManifest.id || provider,
            name: sourceManifest.name,
            version: sourceManifest.version,
            manifestURI: `https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/main/src/anime/${provider}/manifest.json`,
            language: "typescript",
            type: "onlinestream-provider",
            description: sourceManifest.description,
            author: sourceManifest.author,
            icon: `https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/main/src/anime/${provider}/favicon.png`,
            website: sourceManifest.website || "",
            lang: sourceManifest.lang || "en",
            payloadURI: `https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/main/src/anime/${provider}/provider.ts`
        };

        fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(newManifest, null, 2));

        // Update marketplace
        const existingIndex = marketplace.findIndex(m => m.id === newManifest.id);
        if (existingIndex >= 0) {
            marketplace[existingIndex] = newManifest;
        } else {
            marketplace.push(newManifest);
        }
    }

    fs.writeFileSync(MARKETPLACE_JSON, JSON.stringify(marketplace, null, 2));
    console.log("Porting complete!");
}

run();

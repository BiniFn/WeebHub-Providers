(function() {
    if (window.ReadLightNovelSource) return;

    let cachedPort = null;
    function detectPortFromNetwork() {
        try {
            const entries = window.performance.getEntries();
            for (const entry of entries) {
                const match = entry.name.match(/http:\/\/(127\.0\.0\.1|localhost):(\d+)\/api\/v1\//);
                if (match && match[2]) return match[2];
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function getProxyUrl() {
        if (cachedPort) return `http://localhost:${cachedPort}/api/v1/proxy?url=`;
        const port = detectPortFromNetwork() || window.location.port;
        if (port) {
            cachedPort = port;
            return `http://localhost:${port}/api/v1/proxy?url=`;
        }
        return '';
    }

    const BASE_URL = "https://www.readlightnovel.me";
    const PROXY_BASE = getProxyUrl();

    function proxyUrl(targetUrl) {
        if (!PROXY_BASE) return targetUrl;
        return PROXY_BASE + encodeURIComponent(targetUrl);
    }

    function getSimilarity(s1, s2) {
        let longer = s1.toLowerCase();
        let shorter = s2.toLowerCase();
        if (s1.length < s2.length) { longer = s2.toLowerCase(); shorter = s1.toLowerCase(); }
        if (longer.length == 0) return 1.0;
        
        let costs = [];
        for (let i = 0; i <= longer.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= shorter.length; j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (longer.charAt(i - 1) != shorter.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[shorter.length] = lastValue;
        }
        return (longer.length - costs[shorter.length]) / parseFloat(longer.length);
    }

    async function manualSearch(query) {
        // ReadLightNovel uses a POST request for search or simply query via URL.
        // For simplicity we will mock the proxy request assuming standard search behavior.
        const url = proxyUrl(`${BASE_URL}/search/autocomplete?query=${encodeURIComponent(query)}`);
        try {
            const res = await fetch(url);
            // Assuming it returns JSON or HTML. Many sites return HTML for search.
            const text = await res.text();
            
            // For resilience without actual backend verification, 
            // if it returns HTML, parse it:
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const results = [];

            doc.querySelectorAll('.search-result-item, .top-novel-block').forEach(item => {
                const link = item.querySelector('a');
                const img = item.querySelector('img');
                if (link && link.href) {
                    results.push({
                        title: link.textContent.trim(),
                        url: link.getAttribute('href').replace(BASE_URL, ''),
                        id: link.getAttribute('href').replace(BASE_URL, ''),
                        image: img ? img.src : "",
                        latestChapter: "Unknown"
                    });
                }
            });

            return results;
        } catch (err) {
            console.error("[novel-plugin] ReadLightNovel Search Error:", err);
            return [];
        }
    }

    async function getChapters(novelUrl) {
        try {
            const url = proxyUrl(`${BASE_URL}${novelUrl}`);
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const chapters = [];
            doc.querySelectorAll('.chapter-list li a, .panel-body ul li a').forEach(el => {
                chapters.push({
                    url: el.getAttribute('href').replace(BASE_URL, ''),
                    title: el.textContent.trim()
                });
            });
            
            return chapters;
        } catch (err) {
            return [];
        }
    }

    async function getChapterContent(chapterUrl) {
        try {
            const url = proxyUrl(`${BASE_URL}${chapterUrl}`);
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const contentElement = doc.querySelector('.chapter-content');
            if (!contentElement) throw new Error("Could not extract chapter content.");
            
            // Cleanup ads
            contentElement.querySelectorAll('.ads, script, iframe').forEach(el => el.remove());
            return contentElement.innerHTML;
        } catch (err) {
            return "<p>Error loading chapter content.</p>";
        }
    }

    async function autoMatch(romajiTitle, englishTitle) {
        const results = await manualSearch(englishTitle || romajiTitle);
        if (!results || results.length === 0) return null;

        let bestMatch = null;
        let highestSimilarity = 0.0;

        results.forEach(item => {
            const simEng = englishTitle ? getSimilarity(englishTitle, item.title) : 0;
            const simRom = getSimilarity(romajiTitle, item.title);
            const maxSim = Math.max(simEng, simRom);
            
            if (maxSim > highestSimilarity) {
                highestSimilarity = maxSim;
                bestMatch = item;
            }
        });

        if (highestSimilarity > 0.8 && bestMatch) {
            return { match: bestMatch, similarity: highestSimilarity };
        }
        return null;
    }

    const source = {
        id: "readlightnovel",
        name: "ReadLightNovel",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.novelPluginRegistry) {
        window.novelPluginRegistry.registerSource(source);
        console.log('[novel-plugin] ReadLightNovel registered.');
    }
})();

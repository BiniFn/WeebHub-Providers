(function() {

    const BATCAVE_URL = "https://batcave.biz";

    // Removed proxyUrl because it triggers Cloudflare blocking when run from a Node.js proxy instead of the browser context.

    function getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        var matrix = [];
        for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (var i = 1; i <= b.length; i++) {
            for (var j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function getSimilarity(s1, s2) {
        let longer = s1.toLowerCase();
        let shorter = s2.toLowerCase();
        if (s1.length < s2.length) { longer = s2.toLowerCase(); shorter = s1.toLowerCase(); }
        let longerLength = longer.length;
        if (longerLength == 0) { return 1.0; }
        const distance = getLevenshteinDistance(longer, shorter);
        return (longerLength - distance) / parseFloat(longerLength);
    }

    async function manualSearch(query) {
        const url = `${BATCAVE_URL}/search?q=${encodeURIComponent(query)}`;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const results = [];
            
            // Guessing generic search structure for comic sites
            doc.querySelectorAll('.comic-item, .item, .manga-list .manga-item, .c-tabs-item__content').forEach(element => {
                const linkElement = element.querySelector('h3 a, .post-title h3 a, a');
                const imageElement = element.querySelector('img');
                if (!linkElement) return;

                const title = linkElement.textContent.trim() || linkElement.getAttribute('title');
                let mangaUrl = linkElement.getAttribute('href');
                if (mangaUrl && mangaUrl.startsWith('/')) mangaUrl = BATCAVE_URL + mangaUrl;
                
                let image = imageElement ? (imageElement.getAttribute('data-src') || imageElement.getAttribute('src')) : "";
                if (image && image.startsWith('/')) image = BATCAVE_URL + image;

                if (title && mangaUrl) {
                    results.push({
                        title: title,
                        url: mangaUrl,
                        id: mangaUrl,
                        image: image,
                        latestChapter: "View Chapters"
                    });
                }
            });
            return results;
        } catch (err) {
            console.error("[comic-plugin] Batcave Search Error:", err);
            return [];
        }
    }

    async function getChapters(mangaUrl) {
        const url = mangaUrl;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const chapters = [];
            
            doc.querySelectorAll('.chapter-list li a, .wp-manga-chapter a, #chapterlist li a, .listing-chapters_wrap ul li a').forEach(linkElement => {
                let fullUrl = linkElement.getAttribute('href');
                if (fullUrl && fullUrl.startsWith('/')) fullUrl = BATCAVE_URL + fullUrl;
                const titleWithDate = linkElement.textContent.trim();
                
                if (fullUrl) {
                    chapters.push({
                        url: fullUrl,
                        title: titleWithDate
                    });
                }
            });
            return chapters.reverse();
        } catch (err) {
            console.error("[comic-plugin] Batcave Details Error:", err);
            return [];
        }
    }

    async function getChapterContent(chapterUrl) {
        const url = chapterUrl;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            let contentHtml = "";
            doc.querySelectorAll('.reading-content img, #vungdoc img, .container-chapter-reader img, .page-break img').forEach(img => {
                const src = img.getAttribute('data-src') || img.getAttribute('src');
                if (src) {
                    contentHtml += `<img src="${src}" class="comic-plugin-page-image" style="width: 100%; height: auto; display: block; margin: 0 auto; margin-bottom: 8px;" />`;
                }
            });
            
            if (!contentHtml) {
                return "<p>No images found or chapter empty. Note: BatCave.biz may have Cloudflare protection.</p>";
            }
            return contentHtml;
        } catch (err) {
            console.error("[comic-plugin] Batcave ChapterContent Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    async function autoMatch(romajiTitle, englishTitle) {
        console.log(`[comic-plugin-matcher] (Batcave) START: Matching for "${romajiTitle}"`);
        
        const romajiResults = await manualSearch(romajiTitle);
        let bestRomajiMatch = null;
        let bestRomajiScore = 0.0;
        if (romajiResults && romajiResults.length > 0) {
            romajiResults.forEach(item => {
                const similarity = getSimilarity(romajiTitle, item.title);
                if (similarity > bestRomajiScore) {
                    bestRomajiScore = similarity;
                    bestRomajiMatch = item;
                }
            });
        }

        let bestEnglishMatch = null;
        let bestEnglishScore = 0.0;
        if (englishTitle && englishTitle.toLowerCase() !== romajiTitle.toLowerCase()) {
            const englishResults = await manualSearch(englishTitle);
            if (englishResults && englishResults.length > 0) {
                englishResults.forEach(item => {
                    const similarity = getSimilarity(englishTitle, item.title);
                    if (similarity > bestEnglishScore) {
                        bestEnglishScore = similarity;
                        bestEnglishMatch = item;
                    }
                });
            }
        }

        let bestMatch = null;
        let highestSimilarity = 0.0;
        if (bestRomajiScore > bestEnglishScore) {
            bestMatch = bestRomajiMatch;
            highestSimilarity = bestRomajiScore;
        } else {
            bestMatch = bestEnglishMatch;
            highestSimilarity = bestEnglishScore;
        }

        if (highestSimilarity > 0.8 && bestMatch) {
            return { match: bestMatch, similarity: highestSimilarity };
        } else {
            return null;
        }
    }

    const batcaveSource = {
        id: "batcave",
        name: "Batcave",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.comicPluginRegistry) {
        window.comicPluginRegistry.registerSource(batcaveSource);
        console.log('[comic-plugin] Batcave source registered.');
    } else {
        console.error('[comic-plugin] Batcave: Registry not found!');
    }

})();

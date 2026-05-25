(function() {

    const COMICEXTRA_API_URL = "https://comicextra.org";

    function proxyUrl(url) {
        // Find proxy port from window location or default
        let port = "43211";
        if (window.location.port && window.location.port.length === 5) {
            port = window.location.port;
        }
        return `http://localhost:${port}/api/v1/proxy?url=${encodeURIComponent(url)}`;
    }

    function getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        var matrix = [];
        for (var i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (var j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
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
        const url = proxyUrl(`${COMICEXTRA_API_URL}/comic-search?key=${encodeURIComponent(query)}`);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const results = [];
            
            doc.querySelectorAll('.cartoon-box').forEach(element => {
                const linkElement = element.querySelector('h3 a');
                const imageElement = element.querySelector('img');
                if (!linkElement || !imageElement) return;

                const title = linkElement.textContent.trim();
                const mangaUrl = linkElement.getAttribute('href');
                const mangaId = mangaUrl.split('/').pop();
                const image = imageElement.getAttribute('src');

                results.push({
                    title: title,
                    url: mangaId,
                    id: mangaId,
                    image: image,
                    latestChapter: "View Chapters"
                });
            });
            return results;
        } catch (err) {
            console.error("[comic-plugin] ComicExtra Search Error:", err);
            return [];
        }
    }

    async function getChapters(novelUrl) {
        const url = proxyUrl(`${COMICEXTRA_API_URL}/comic/${novelUrl}`);
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const chapters = [];
            
            doc.querySelectorAll('#list tr a').forEach(linkElement => {
                const fullUrl = linkElement.getAttribute('href');
                const titleWithDate = linkElement.textContent.trim();
                const chapterIdMatch = fullUrl.match(/comicextra\.org\/(.+)/);
                if (!chapterIdMatch) return;
                
                chapters.push({
                    url: chapterIdMatch[1],
                    title: titleWithDate
                });
            });
            // Reverse so chapter 1 is first
            return chapters.reverse();
        } catch (err) {
            console.error("[comic-plugin] ComicExtra Details Error:", err);
            return [];
        }
    }

    async function getChapterContent(chapterUrl) {
        // Append /full for single-page reading
        const url = proxyUrl(`${COMICEXTRA_API_URL}/${chapterUrl}/full`);
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            let contentHtml = "";
            doc.querySelectorAll('.chapter-container img').forEach(img => {
                const src = img.getAttribute('src');
                if (src) {
                    contentHtml += `<img src="${src}" class="comic-plugin-page-image" style="width: 100%; height: auto; display: block; margin: 0 auto; margin-bottom: 8px;" />`;
                }
            });
            
            if (!contentHtml) {
                return "<p>No images found or chapter empty.</p>";
            }
            return contentHtml;
        } catch (err) {
            console.error("[comic-plugin] ComicExtra ChapterContent Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    async function autoMatch(romajiTitle, englishTitle) {
        console.log(`[comic-plugin-matcher] (ComicExtra) START: Matching for "${romajiTitle}"`);
        
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

    const comicExtraSource = {
        id: "comicextra",
        name: "ComicExtra",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.comicPluginRegistry) {
        window.comicPluginRegistry.registerSource(comicExtraSource);
        console.log('[comic-plugin] ComicExtra source registered.');
    } else {
        console.error('[comic-plugin] ComicExtra: Registry not found!');
    }

})();

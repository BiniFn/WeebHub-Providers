(function() {
    // Check if script is already loaded
    if (window.ComicMetadataQueries) {
        return;
    }

    const BATCAVE_URL = "https://batcave.biz";

    function proxyUrl(url) {
        let port = "43211";
        if (window.location.port && window.location.port.length === 5) {
            port = window.location.port;
        }
        return `http://localhost:${port}/api/v1/proxy?url=${encodeURIComponent(url)}`;
    }

    /**
     * Searches for comics
     * @param {string} query - The search term
     * @returns {Promise<Array>}
     */
    async function searchComics(query) {
        const url = proxyUrl(`${BATCAVE_URL}/search?q=${encodeURIComponent(query)}`);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const results = [];
            
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
                        id: mangaUrl, // Using URL as unique ID
                        title: { romaji: title, english: title },
                        coverImage: { extraLarge: image, large: image, color: '#333' },
                        averageScore: Math.floor(Math.random() * 10) + 85 // Mock score
                    });
                }
            });
            return results;
        } catch (err) {
            console.error("[comic-plugin] ComicMetadata Search Error:", err);
            return [];
        }
    }

    /**
     * Fetches trending comics
     * @returns {Promise<Array>}
     */
    async function getTrendingComics() {
        console.log("[comic-plugin] Fetching trending comics from metadata...");
        
        // We fetch a mix of popular western comics to populate the Discover page
        const popularQueries = ["Batman", "Spider-Man", "Superman", "Invincible", "The Walking Dead", "The Boys", "Spawn", "Saga", "Teenage Mutant Ninja Turtles", "Deadpool", "X-Men", "Avengers"];
        
        // Shuffle the array to show different trending comics each time
        const shuffled = popularQueries.sort(() => 0.5 - Math.random());
        const selectedQueries = shuffled.slice(0, 10);
        
        const results = [];
        
        // Fetch sequentially to avoid triggering rate limits/Cloudflare
        for (const query of selectedQueries) {
            const searchRes = await searchComics(query);
            if (searchRes && searchRes.length > 0) {
                // Add only the best match
                if (!results.find(r => r.id === searchRes[0].id)) {
                    results.push(searchRes[0]);
                }
            }
        }
        
        return results;
    }

    /**
     * Fetches detailed information for a specific comic
     * @param {string} id - The comic URL ID
     * @returns {Promise<object|null>}
     */
    async function getComicDetails(id) {
        // id is the full URL in this context
        const url = proxyUrl(id);
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const titleElement = doc.querySelector('.post-title h1, .manga-info h1, .post-title');
            const title = titleElement ? titleElement.textContent.trim() : "Unknown Title";
            
            const imageElement = doc.querySelector('.summary_image img, .manga-info img');
            let image = imageElement ? (imageElement.getAttribute('data-src') || imageElement.getAttribute('src')) : "";
            if (image && image.startsWith('/')) image = BATCAVE_URL + image;
            
            const descElement = doc.querySelector('.summary__content, .manga-about, .description-summary');
            const desc = descElement ? descElement.textContent.trim() : "No description available.";
            
            return {
                id: id,
                title: { romaji: title, english: title },
                description: desc,
                genres: ["Comic"],
                status: "ONGOING",
                coverImage: { extraLarge: image, large: image, color: '#333' },
                bannerImage: image,
                averageScore: 90,
                startDate: { year: new Date().getFullYear() },
                tags: [],
                recommendations: { nodes: [] },
                externalLinks: [{ url: id, site: "Read on Batcave" }],
                chapters: 0
            };
        } catch (err) {
            console.error("[comic-plugin] ComicMetadata Details Error:", err);
            return null;
        }
    }

    // Expose the functions to the global window object
    window.ComicMetadataQueries = {
        getTrendingLightComics: getTrendingComics,
        searchAnilistLightComics: searchComics,
        getAnilistLightComicDetails: getComicDetails
    };

    console.log('[comic-plugin] ComicMetadataQueries loaded.');

})();

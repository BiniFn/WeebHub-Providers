(function() {
    // Check if script is already loaded
    if (window.AnilistQueries) {
        return;
    }

    const ANILIST_API_URL = "https://graphql.anilist.co";

    /**
     * The core fetch function for the Anilist API
     * @param {string} query - The GraphQL query string
     * @param {object} variables - Variables for the query
     * @returns {Promise<object|null>}
     */
    async function fetchAnilist(query, variables) {
        try {
           const res = await fetch(ANILIST_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables,
                }),
            });
            if (!res.ok) {
                throw new Error(`Network response was not ok: ${res.statusText}`);
            }
            const json = await res.json();
            return json.data;
        } catch (err) {
            console.error("[comic-plugin] Anilist API Error:", err);
            return null;
        }
    }

    /**
     * Fetches trending comics
     * @returns {Promise<Array>}
     */
    async function getTrendingLightComics() {
        let query = `
            query {
                Page(page: 1, perPage: 20) {
                     media(type: MANGA, format: MANGA, sort: TRENDING_DESC) {
                        id
                        title { romaji, english }
                        coverImage { extraLarge, large, color }
                        bannerImage
                        averageScore
                    }
                }
            }
        `;
        query = query.replace(/\s*\n\s*/g, ' ').trim(); // Minify
        const data = await fetchAnilist(query);
        return data?.Page?.media || [];
    }

    /**
     * Searches for comics on Anilist
     * @param {string} search - The search term
     * @param {string} sort - The sort method (e.g., "TRENDING_DESC")
     * @param {string} genre - The genre to filter by
     * @returns {Promise<Array>}
     */
    async function searchAnilistLightComics(search, sort, genre) {
        let query = `
            query ($search: String, $sort: [MediaSort], $genre: String) {
                Page(page: 1, perPage: 20) {
                   media(type: MANGA, format: MANGA, search: $search, sort: $sort, genre: $genre) {
                        id
                        title { romaji, english }
                         coverImage { extraLarge, large, color }
                        averageScore
                    }
                 }
            }
        `;
        query = query.replace(/\s*\n\s*/g, ' ').trim(); // Minify
        const data = await fetchAnilist(query, { search, sort: [sort], genre });
        return data?.Page?.media || [];
    }

    /**
     * Fetches detailed information for a specific comic
     * @param {number} id - The Anilist media ID
     * @returns {Promise<object|null>}
     */
    async function getAnilistLightComicDetails(id) {
        let query = `
            query ($id: Int) {
                Media(id: $id, type: MANGA, format: MANGA) {
                    id
                    title { romaji, english }
                    description(asHtml: false)
                    genres
                    status
                    coverImage { extraLarge, large, color }
                    bannerImage
                    averageScore
                    startDate { year }
                    tags {
                        id
                        name
                        isMediaSpoiler
                    }
                    rankings {
                        id
                        rank
                        type
                        context
                        allTime
                    }
                    characters(perPage: 6) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                        }
                    }
                    staff(perPage: 6) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji, english }
                                coverImage { large, color }
                            }
                        }
                    }
                    externalLinks {
                        id
                        url
                        site
                        icon
                    }
                    reviews(perPage: 3) {
                        nodes {
                            id
                            summary
                            score
                            user {
                                name
                                avatar { large }
                            }
                        }
                    }
                }
            }
         `;
         query = query.replace(/\s*\n\s*/g, ' ').trim(); // Minify
        const data = await fetchAnilist(query, { id });
        return data?.Media || null;
    }

    // Expose the functions to the global window object
    window.AnilistQueries = {
        getTrendingLightComics,
        searchAnilistLightComics,
        getAnilistLightComicDetails
    };

    console.log('[comic-plugin] AnilistQueries loaded.');

})();

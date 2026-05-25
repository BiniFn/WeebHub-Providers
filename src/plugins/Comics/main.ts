/// <reference path="./core.d.ts" />

// ---------------------------------------------------------------------------
// MAIN ENTRYPOINT
// ---------------------------------------------------------------------------

function init() {
    $ui.register((ctx) => {
        console.log("[comic-plugin] $ui.register() called.");

        /**
         * Generates the complete, self-contained plugin script.
         */
        function getInjectedScriptString(scriptId: string): string {
            return `
        (async function() {
        
            console.log("[comic-plugin] Injected script running.");

            // ---------------------------------------------------------------------------
            // 1. CONFIGURATION & CONSTANTS
            // ---------------------------------------------------------------------------
            const CONFIG = {
                scriptId: "${scriptId}",
                ids: {
                    style: "comic-plugin-styles",
                    scriptQuery: "comic-plugin-queries",
                    scriptScraperBuddy: "comic-plugin-scrapers-comicbuddy",
                    scriptScraperBin: "comic-plugin-scrapers-comicbin",
                    scriptScraperHall: "comic-plugin-scrapers-comichall",
                    scriptScraperFire: "comic-plugin-scrapers-comicfire",
                    backdrop: "comic-plugin-backdrop",
                    modal: "comic-plugin-modal-content",
                    wrapper: "comic-plugin-content-wrapper",
                    closeBtn: "comic-plugin-btn-close",
                    searchInput: "comic-plugin-search-input",
                    autoMatchContainer: "comic-plugin-auto-match-container",
                },
                selectors: {
                    appLayout: ".UI-AppLayout__root"
                },
                assets: {
                    css: "https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/refs/heads/main/src/plugins/Comics/styles.css",
                    queries: "https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/refs/heads/main/src/plugins/Comics/anilist.js",
                    scraperExtra: "https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/refs/heads/main/src/plugins/Comics/providers/comicextra.js"
                },
                genres: [
                    "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai",
                    "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological",
                    "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
                ]
            };

            const DEFAULT_SETTINGS = {
                theme: 'dark', // dark, light, sepia
                fontSize: 18,
                lineHeight: 1.6,
                fontFamily: 'sans-serif',
                maxWidth: 800
            };

            // Exit if already running
            if (document.getElementById(CONFIG.ids.modal)) {
                console.log("[comic-plugin] Modal already exists.");
                return;
            }

            // ---------------------------------------------------------------------------
            // 2. STATE MANAGEMENT
            // ---------------------------------------------------------------------------
            const State = {
                page: "discover",
                activeTab: "discover",
                isLoading: false,
                currentComic: null,         
                currentSourceId: null,      
                currentChapters: [],        
                currentChapterContent: null,
                currentChapterIndex: 0,
                matches: new Map(),         
                sourceRegistry: new Map(),
                showSettings: false,
                libraryComics: [],  // Array of library items
                libraryLoaded: false, // Flag to track if library is loaded
                libraryViewMode: localStorage.getItem('comic_plugin_library_view') || 'list', // 'list' or 'cards'
                libraryPage: 1,
                libraryPageSize: 10,
                libraryTotalPages: 1
            };

            // Expose registry globally
            window.comicPluginRegistry = {
                registerSource: (source) => {
                    console.log(\`[comic-plugin] Registered source: \${source.name}\`);
                    State.sourceRegistry.set(source.id, source);
                }
            };

            // ---------------------------------------------------------------------------
            // 3. STORAGE & CACHE SERVICES
            // ---------------------------------------------------------------------------
            const CacheService = {
                // TASK 2: Anilist Caching to prevent rate limiting
                getCacheKey: (type, params) => {
                    const paramString = typeof params === 'object' 
                        ? JSON.stringify(params) 
                        : String(params);
                    return \`comic_plugin_cache_\${type}_\${btoa(encodeURIComponent(paramString))}\`;
                },

                get: (key) => {
                    try {
                        const item = localStorage.getItem(key);
                        if (!item) return null;
                        
                        const { data, expiry } = JSON.parse(item);
                        if (expiry && Date.now() > expiry) {
                            localStorage.removeItem(key);
                            return null;
                        }
                        return data;
                    } catch (e) {
                        console.error("[comic-plugin] Cache read error:", e);
                        return null;
                    }
                },

                set: (key, data, ttl = 3600000) => { // 1 hour default TTL
                    try {
                        const item = {
                            data,
                            expiry: Date.now() + ttl
                        };
                        localStorage.setItem(key, JSON.stringify(item));
                    } catch (e) {
                        console.error("[comic-plugin] Cache write error:", e);
                    }
                },

                clearExpired: () => {
                    const now = Date.now();
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key?.startsWith('comic_plugin_cache_')) {
                            try {
                                const item = localStorage.getItem(key);
                                if (item) {
                                    const { expiry } = JSON.parse(item);
                                    if (expiry && now > expiry) {
                                        localStorage.removeItem(key);
                                    }
                                }
                            } catch (e) {
                                // Ignore malformed cache entries
                            }
                        }
                    }
                }
            };

            // Wrapped Anilist Queries with Caching
            const CachedAnilistQueries = {
                getTrendingLightComics: async () => {
                    const cacheKey = CacheService.getCacheKey('trending', {});
                    const cached = CacheService.get(cacheKey);
                    if (cached) {
                        console.log("[comic-plugin] Using cached trending comics");
                        return cached;
                    }
                    
                    console.log("[comic-plugin] Fetching fresh trending comics");
                    const data = await AnilistQueries.getTrendingLightComics();
                    if (data) {
                        CacheService.set(cacheKey, data, 1800000); // 30 minutes
                    }
                    return data;
                },

                searchAnilistLightComics: async (query, sort, genre) => {
                    const cacheKey = CacheService.getCacheKey('search', { query, sort, genre });
                    const cached = CacheService.get(cacheKey);
                    if (cached) {
                        console.log("[comic-plugin] Using cached search results");
                        return cached;
                    }
                    
                    console.log("[comic-plugin] Fetching fresh search results");
                    const data = await AnilistQueries.searchAnilistLightComics(query, sort, genre);
                    if (data) {
                        CacheService.set(cacheKey, data, 900000); // 15 minutes
                    }
                    return data;
                },

                getAnilistLightComicDetails: async (id) => {
                    const cacheKey = CacheService.getCacheKey('details', id);
                    const cached = CacheService.get(cacheKey);
                    if (cached) {
                        console.log(\`[comic-plugin] Using cached details for comic \${id}\`);
                        return cached;
                    }
                    
                    console.log(\`[comic-plugin] Fetching fresh details for comic \${id}\`);
                    const data = await AnilistQueries.getAnilistLightComicDetails(id);
                    if (data) {
                        CacheService.set(cacheKey, data, 3600000); // 1 hour
                    }
                    return data;
                }
            };

            const StorageService = {
                getKey: (anilistId, sourceId) => {
                    return (anilistId && sourceId) 
                        ? \`comic_plugin_last_read_\${anilistId}_\${sourceId}\`
                        : \`comic_plugin_last_read_\${anilistId}\`;
                },

                saveChapter: (anilistId, sourceId, chapterUrl, title, index) => {
                    if (!anilistId || !sourceId) return;
                    try {
                        const data = {
                            chapterUrl,
                            chapterTitle: title,
                            chapterIndex: parseInt(index, 10),
                            timestamp: Date.now()
                        };
                        localStorage.setItem(StorageService.getKey(anilistId, sourceId), JSON.stringify(data));
                        
                        // Add/update in library
                        StorageService.updateLibrary(anilistId, sourceId, title, index);
                    } catch (e) {
                        console.error("[comic-plugin] Save error:", e);
                    }
                },

                getLastRead: (anilistId, sourceId) => {
                    if (!anilistId || !sourceId) return null;
                    try {
                        const key = StorageService.getKey(anilistId, sourceId);
                        let data = localStorage.getItem(key);
                        
                        // Migration logic for old keys
                        if (!data) {
                            const oldKey = StorageService.getKey(anilistId, null);
                            const oldData = localStorage.getItem(oldKey);
                            if (oldData) {
                                const parsed = JSON.parse(oldData);
                                StorageService.saveChapter(anilistId, sourceId, parsed.chapterUrl, parsed.chapterTitle, parsed.chapterIndex);
                                localStorage.removeItem(oldKey);
                                return parsed;
                            }
                            return null;
                        }
                        return JSON.parse(data);
                    } catch (e) {
                        return null;
                    }
                },

                // TASK 3: Remove last read data when removing from library
                removeLastRead: (anilistId, sourceId) => {
                    try {
                        const key = StorageService.getKey(anilistId, sourceId);
                        localStorage.removeItem(key);
                        console.log(\`[comic-plugin] Removed last read data for comic \${anilistId}\`);
                    } catch (e) {
                        console.error("[comic-plugin] Error removing last read data:", e);
                    }
                },

                getSettings: () => {
                    try {
                        const s = localStorage.getItem('comic_plugin_reader_settings');
                        return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
                    } catch { return DEFAULT_SETTINGS; }
                },

                saveSettings: (settings) => {
                    try {
                        localStorage.setItem('comic_plugin_reader_settings', JSON.stringify(settings));
                    } catch (e) { console.error("Save settings error", e); }
                },

                // LIBRARY FUNCTIONS
                getLibrary: () => {
                    try {
                        const library = localStorage.getItem('comic_plugin_library');
                        return library ? JSON.parse(library) : [];
                    } catch (e) {
                        console.error("[comic-plugin] Library read error:", e);
                        return [];
                    }
                },

                updateLibrary: (anilistId, sourceId, chapterTitle, chapterIndex) => {
                    try {
                        const libraryKey = 'comic_plugin_library';
                        let library = StorageService.getLibrary();
                        
                        // Check if comic already exists in library
                        const existingIndex = library.findIndex(item => item.anilistId === anilistId);
                        
                        if (existingIndex >= 0) {
                            // Update existing entry
                            library[existingIndex] = {
                                ...library[existingIndex],
                                lastChapterTitle: chapterTitle,
                                lastChapterIndex: chapterIndex,
                                lastReadTime: Date.now(),
                                sourceId: sourceId
                            };
                        } else {
                            // Add new entry
                            library.push({
                                anilistId: anilistId,
                                sourceId: sourceId,
                                lastChapterTitle: chapterTitle,
                                lastChapterIndex: chapterIndex,
                                lastReadTime: Date.now(),
                                addedTime: Date.now()
                            });
                        }
                        
                        // Sort by last read time (newest first)
                        library.sort((a, b) => b.lastReadTime - a.lastReadTime);
                        
                        // Keep only the last 100 items
                        if (library.length > 100) {
                            library = library.slice(0, 100);
                        }
                        
                        localStorage.setItem(libraryKey, JSON.stringify(library));
                        // Mark library as needing reload
                        State.libraryLoaded = false;
                        return library;
                    } catch (e) {
                        console.error("[comic-plugin] Library update error:", e);
                        return [];
                    }
                },

                removeFromLibrary: (anilistId) => {
                    try {
                        const libraryKey = 'comic_plugin_library';
                        let library = StorageService.getLibrary();
                        
                        // Find the comic to get sourceId before removal
                        const comicToRemove = library.find(item => item.anilistId === anilistId);
                        
                        library = library.filter(item => item.anilistId !== anilistId);
                        localStorage.setItem(libraryKey, JSON.stringify(library));
                        
                        // TASK 3: Also remove last read data
                        if (comicToRemove && comicToRemove.sourceId) {
                            StorageService.removeLastRead(anilistId, comicToRemove.sourceId);
                        }
                        
                        // Mark library as needing reload
                        State.libraryLoaded = false;
                        return library;
                    } catch (e) {
                        console.error("[comic-plugin] Library remove error:", e);
                        return StorageService.getLibrary();
                    }
                }
            };

            // ---------------------------------------------------------------------------
            // 4. HTML GENERATORS
            // ---------------------------------------------------------------------------
            const Templates = {
                icon: (name) => {
                    const icons = {
                        link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>',
                        twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>',
                        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
                        library: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
                        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
                        grid: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>',
                        list: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>'
                    };
                    return icons[name] || icons['link'];
                },

                posterCard: (item) => \`<div class="comic-plugin-poster-card" data-id="\${item.id}">
                        <img src="\${item.coverImage.large}" class="comic-plugin-poster-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
                        <p class="comic-plugin-poster-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                    </div>\`,

                // TASK 1 & 4: Updated library card (list view) without status or progress counter
                libraryCardList: (item) => {
                    return \`<div class="comic-plugin-library-card-list" data-id="\${item.id}">
                        <div class="comic-plugin-library-card-header">
                            <img src="\${item.coverImage.large}" class="comic-plugin-library-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
                            <div class="comic-plugin-library-info">
                                <p class="comic-plugin-library-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                                <p class="comic-plugin-library-chapter" title="\${item.lastChapterTitle || 'Chapter ' + (item.lastChapterIndex + 1)}">
                                    Last: \${item.lastChapterTitle || 'Chapter ' + (item.lastChapterIndex + 1)}
                                </p>
                            </div>
                        </div>
                        <div class="comic-plugin-library-actions">
                            <button class="comic-plugin-button small continue-btn" data-id="\${item.id}" data-source="\${item.sourceId}">Continue</button>
                            <button class="comic-plugin-button small secondary icon-only remove-btn" data-id="\${item.id}">\${Templates.icon('trash')}</button>
                        </div>
                    </div>\`;
                },

                // TASK 1 & 4: New card view for library without status
                libraryCardGrid: (item) => {
                    return \`<div class="comic-plugin-library-card-grid" data-id="\${item.id}">
                        <div class="comic-plugin-library-grid-img-container">
                            <img src="\${item.coverImage.large}" class="comic-plugin-library-grid-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
                            <div class="comic-plugin-library-grid-overlay">
                                <button class="comic-plugin-button small overlay-btn continue-btn" data-id="\${item.id}" data-source="\${item.sourceId}">Continue</button>
                                <button class="comic-plugin-button small secondary overlay-btn remove-btn" data-id="\${item.id}">\${Templates.icon('trash')}</button>
                            </div>
                        </div>
                        <div class="comic-plugin-library-grid-info">
                            <p class="comic-plugin-library-grid-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                            <p class="comic-plugin-library-grid-chapter" title="\${item.lastChapterTitle || 'Chapter ' + (item.lastChapterIndex + 1)}">
                                \${item.lastChapterTitle || 'Chapter ' + (item.lastChapterIndex + 1)}
                            </p>
                        </div>
                    </div>\`;
                },

                modalStructure: () => \`<div id="\${CONFIG.ids.modal}">
                        <button id="\${CONFIG.ids.closeBtn}"></button>
                        <div class="comic-plugin-header">
                           <div class="comic-plugin-tabs">
                               <button class="comic-plugin-tab" id="comic-plugin-tab-discover" data-page="discover">Discover</button>
                               <button class="comic-plugin-tab" id="comic-plugin-tab-library" data-page="library">Library</button>
                               <button class="comic-plugin-tab" id="comic-plugin-tab-search" data-page="search">Search</button>
                           </div>
                        </div>
                        <div id="\${CONFIG.ids.wrapper}"></div>
                    </div>\`,
                
                detailsHeader: (media) => \`<div class="comic-plugin-details-header">
                        <img src="\${media.coverImage.extraLarge}" class="comic-plugin-details-cover" style="--cover-color: \${media.coverImage.color || '#8A2BE2'};">
                        <div class="comic-plugin-details-info">
                            <h1 class="comic-plugin-title">\${media.title.romaji}</h1>
                            <p class="comic-plugin-subtitle">\${media.title.english || ''}</p>
                             <div class="comic-plugin-tags">
                                <span class="comic-plugin-tag score">\${media.averageScore ? media.averageScore + '%' : 'N/A'}</span>
                                <span class="comic-plugin-tag">\${media.status || ''}</span>
                                     <span class="comic-plugin-tag">\${media.startDate.year || ''}</span>
                            </div>
                        </div>
                    </div>\`,
            };

            // ---------------------------------------------------------------------------
            // 5. CONTROLLER LOGIC
            // ---------------------------------------------------------------------------
            
            async function loadAndReadChapter(chapterUrl, chapterIndex) {
                const source = State.sourceRegistry.get(State.currentSourceId);
                if (!source) return console.error("No active source.");

                State.isLoading = true;
                State.page = "reader";
                renderUI();
                try {
                    const content = await source.getChapterContent(chapterUrl);
                    const numericIndex = parseInt(chapterIndex, 10);
                    
                    State.currentChapterContent = content;
                    State.currentChapterIndex = numericIndex;
                    if (State.currentComic && State.currentChapters[numericIndex]) {
                        StorageService.saveChapter(
                            State.currentComic.id, 
                            State.currentSourceId, 
                            chapterUrl, 
                            State.currentChapters[numericIndex].title, 
                            numericIndex
                        );
                        
                        // Check if this is the last chapter and remove from library if finished
                        const isLastChapter = numericIndex === State.currentChapters.length - 1;
                        const isFinishedComic = State.currentComic.status === 'FINISHED';
                        
                        if (isLastChapter && isFinishedComic) {
                            // Remove from library when last chapter is read for finished comics
                            StorageService.removeFromLibrary(State.currentComic.id);
                            console.log(\`[comic-plugin] Removed finished comic \${State.currentComic.title.romaji} from library.\`);
                            
                            // Show notification
                            setTimeout(() => {
                                const notification = document.createElement('div');
                                notification.className = 'comic-plugin-notification';
                                notification.textContent = \`Completed \${State.currentComic.title.romaji} - Removed from library\`;
                                notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#2a2a2a;color:#fff;padding:12px 16px;border-radius:8px;border-left:4px solid #4CAF50;z-index:99999;';
                                document.body.appendChild(notification);
                                setTimeout(() => notification.remove(), 3000);
                            }, 500);
                        }
                    }

                    State.isLoading = false;
                    renderUI();
                    document.getElementById(CONFIG.ids.wrapper).scrollTop = 0;
                } catch (err) {
                    console.error("Error loading chapter:", err);
                    State.isLoading = false;
                    State.page = "chapters";
                    renderUI();
                }
            }

            async function loadChaptersForActiveSource() {
                const source = State.sourceRegistry.get(State.currentSourceId);
                const matchData = State.matches.get(State.currentSourceId);
                
                if (!source || !matchData) {
                    State.currentChapters = [];
                    return [];
                }

                if (matchData.chapters) {
                    State.currentChapters = matchData.chapters;
                    return matchData.chapters;
                }

                console.log(\`[comic-plugin] Fetching chapters for \${source.name}\`);
                const chapters = await source.getChapters(matchData.match.url);
                State.matches.get(State.currentSourceId).chapters = chapters;
                State.currentChapters = chapters;
                return chapters;
            }

            function handleComicSelection(id) {
                State.currentComic = { id: id };
                State.currentSourceId = null;
                State.currentChapters = [];
                State.matches.clear();
                State.page = "details";
                renderUI();
            }

            // Load library data with comic details
            async function loadLibrary() {
                const library = StorageService.getLibrary();
                if (library.length === 0) {
                    State.libraryComics = [];
                    State.libraryLoaded = true;
                    return [];
                }

                try {
                    // Fetch details for each comic in library
                    const promises = library.map(async (libItem) => {
                        try {
                            const media = await CachedAnilistQueries.getAnilistLightComicDetails(libItem.anilistId);
                            if (media) {
                                return {
                                    ...libItem,
                                    id: media.id,
                                    title: media.title,
                                    coverImage: media.coverImage,
                                    chapters: media.chapters, // Total chapters from Anilist
                                    status: media.status
                                };
                            }
                        } catch (e) {
                            console.error(\`Failed to fetch comic \${libItem.anilistId}:\`, e);
                        }
                        return null;
                    });

                    const results = await Promise.allSettled(promises);
                    State.libraryComics = results
                        .filter(r => r.status === 'fulfilled' && r.value !== null)
                        .map(r => r.value);

                    State.libraryLoaded = true;
                    return State.libraryComics;
                } catch (e) {
                    console.error("[comic-plugin] Library load error:", e);
                    State.libraryComics = [];
                    State.libraryLoaded = true;
                    return [];
                }
            }

            // Continue reading from library
            async function continueFromLibrary(anilistId, sourceId) {
                State.isLoading = true;
                renderUI();
                
                try {
                    // Get comic details
                    const media = await CachedAnilistQueries.getAnilistLightComicDetails(anilistId);
                    if (!media) {
                        throw new Error("Failed to load comic details");
                    }
                    
                    State.currentComic = media;
                    State.currentSourceId = sourceId;
                    
                    // Try to auto-match
                    const promises = [];
                    State.sourceRegistry.forEach(src => promises.push(src.autoMatch(media.title.romaji, media.title.english)));
                    const results = await Promise.allSettled(promises);
                    
                    State.matches.clear();
                    const sourceIds = [...State.sourceRegistry.keys()];
                    
                    results.forEach((res, idx) => {
                        if (res.status === 'fulfilled' && res.value) {
                            const sid = sourceIds[idx];
                            State.matches.set(sid, { ...res.value, chapters: null });
                            if (sid === sourceId) {
                                State.currentSourceId = sid;
                            }
                        }
                    });
                    
                    // Load chapters
                    await loadChaptersForActiveSource();
                    
                    // Get last read position
                    const lastRead = StorageService.getLastRead(anilistId, sourceId);
                    if (lastRead && lastRead.chapterUrl && State.currentChapters[lastRead.chapterIndex]) {
                        await loadAndReadChapter(lastRead.chapterUrl, lastRead.chapterIndex);
                    } else if (State.currentChapters.length > 0) {
                        // If no last read found, start from first chapter
                        await loadAndReadChapter(State.currentChapters[0].url, 0);
                    } else {
                        State.page = "details";
                        State.isLoading = false;
                        renderUI();
                    }
                } catch (err) {
                    console.error("[comic-plugin] Continue from library error:", err);
                    State.isLoading = false;
                    State.page = "details";
                    renderUI();
                }
            }

            // Remove from library
            function removeFromLibrary(anilistId) {
                if (confirm("Remove this comic from your library? Your reading progress will also be removed.")) {
                    StorageService.removeFromLibrary(anilistId);
                    State.libraryLoaded = false;
                    if (State.page === "library") {
                        renderUI();
                    }
                }
            }

            // TASK 4: Library pagination functions
            function getPaginatedLibraryItems() {
                const startIndex = (State.libraryPage - 1) * State.libraryPageSize;
                const endIndex = startIndex + State.libraryPageSize;
                return State.libraryComics.slice(startIndex, endIndex);
            }

            function updateLibraryPagination() {
                State.libraryTotalPages = Math.ceil(State.libraryComics.length / State.libraryPageSize);
                if (State.libraryPage > State.libraryTotalPages && State.libraryTotalPages > 0) {
                    State.libraryPage = State.libraryTotalPages;
                }
            }

            // TASK 4: Library view mode toggle
            function toggleLibraryViewMode() {
                State.libraryViewMode = State.libraryViewMode === 'list' ? 'cards' : 'list';
                localStorage.setItem('comic_plugin_library_view', State.libraryViewMode);
                renderUI();
            }

            // New Helper: Image Modal
            function showImageModal(src) {
                const modal = document.createElement('div');
                modal.className = 'comic-plugin-image-modal';
                
                const img = document.createElement('img');
                img.src = src;
                
                modal.appendChild(img);
                document.body.appendChild(modal);

                // Close function
                const close = () => {
                    modal.classList.remove('visible');
                    // Remove local ESC listener
                    document.removeEventListener('keydown', handleLocalEsc);
                    setTimeout(() => modal.remove(), 250); 
                };

                // Local ESC Listener (Closes only image, stops propagation so Global ESC doesn't fire)
                const handleLocalEsc = (e) => {
                    if (e.key === 'Escape' || e.code === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation(); 
                        close();
                    }
                };
                document.addEventListener('keydown', handleLocalEsc);

                // Close on click
                modal.onclick = close;

                // Trigger reflow to enable transition
                requestAnimationFrame(() => modal.classList.add('visible'));
            }

            // Global ESC Handler for Main UI
            function handleGlobalEsc(e) {
                if (e.key === 'Escape' || e.code === 'Escape') {
                    // Note: If image modal is open, its own listener calls stopPropagation, 
                    // so this function won't even run. We don't need to check for the modal here.
                    e.preventDefault();
                    console.log("[comic-plugin] Global ESC detected. Closing UI.");
                    cleanup();
                }
            }

            // ---------------------------------------------------------------------------
            // 6. RENDERERS
            // ---------------------------------------------------------------------------

            function renderUI() {
                const wrapper = document.getElementById(CONFIG.ids.wrapper);
                if (!wrapper) return;

                document.querySelectorAll('.comic-plugin-tab').forEach(t => t.classList.remove('active'));
                document.getElementById(\`comic-plugin-tab-\${State.activeTab}\`)?.classList.add('active');

                wrapper.innerHTML = "";
                if (State.isLoading) {
                    wrapper.innerHTML = \`<div class="comic-plugin-loader"></div>\`;
                    return;
                }

                if (State.page !== "discover" && State.page !== "search" && State.page !== "library") {
                    const backBtn = document.createElement("button");
                    backBtn.className = "comic-plugin-back-btn";
                    backBtn.textContent = "‹ Back";
                    backBtn.onclick = () => {
                        if (State.page === "reader") State.page = "chapters";
                        else if (State.page === "chapters") State.page = "details";
                        else if (State.page === "manual-match") State.page = "details";
                        else if (State.page === "details") State.page = State.activeTab;
                        renderUI();
                    };
                    wrapper.appendChild(backBtn);
                }

                const content = document.createElement("div");
                content.className = "comic-plugin-page-content";
                wrapper.appendChild(content);

                switch (State.page) {
                    case "discover": renderDiscoverPage(content); break;
                    case "search": renderSearchPage(content); break;
                    case "library": renderLibraryPage(content); break;
                    case "details": renderDetailsPage(content); break;
                    case "manual-match": renderManualMatchPage(content); break;
                    case "chapters": renderChapterListPage(content); break;
                    case "reader": renderReaderPage(content); break;
                }
            }

            // --- Page: Discover ---
            async function renderDiscoverPage(wrapper) {
                wrapper.innerHTML = \`<div class="comic-plugin-loader"></div>\`;
                const media = await CachedAnilistQueries.getTrendingLightComics();
                wrapper.innerHTML = "";

                if (!media?.length) {
                    wrapper.innerHTML = "<p>Could not load trending comics.</p>";
                    return;
                }

                const hero = media[0];
                const bannerImg = hero.bannerImage || hero.coverImage.extraLarge;
                wrapper.innerHTML += \`
                    <div class="comic-plugin-hero" style="background-image: linear-gradient(to top, #121212 10%, rgba(18, 18, 18, 0)), url('\${bannerImg}')">
                        <div class="comic-plugin-hero-content">
                            <h1 class="comic-plugin-hero-title">\${hero.title.romaji}</h1>
                             <p class="comic-plugin-hero-score">\${hero.averageScore ? hero.averageScore + '%' : ''} Liked</p>
                            <button class="comic-plugin-button" data-id="\${hero.id}">View Details</button>
                        </div>
                    </div>
                    <h2 class="comic-plugin-section-title">Trending Comics</h2>\`;

                let gridHtml = '<div class="comic-plugin-grid">';
                media.forEach(item => { gridHtml += Templates.posterCard(item); });
                gridHtml += '</div>';
                wrapper.innerHTML += gridHtml;

                wrapper.querySelectorAll('.comic-plugin-poster-card, .comic-plugin-button').forEach(el => {
                    el.onclick = () => handleComicSelection(el.getAttribute('data-id'));
                });
            }

            // --- Page: Search ---
            function renderSearchPage(wrapper) {
                wrapper.innerHTML += \`
                    <h1 class="comic-plugin-title">Search</h1>
                    <div class="comic-plugin-input-container">
                        <input id="\${CONFIG.ids.searchInput}" class="comic-plugin-input" placeholder="e.g., Classroom of the Elite" />
                        <button id="comic-plugin-search-btn" class="comic-plugin-button">Search</button>
                    </div>
                    <div class="comic-plugin-filter-container">
                         <select id="comic-plugin-sort-select" class="comic-plugin-select">
                            <option value="TRENDING_DESC">Sort by Trending</option>
                            <option value="POPULARITY_DESC">Sort by Popularity</option>
                             <option value="SCORE_DESC">Sort by Score</option>
                        </select>
                        <select id="comic-plugin-genre-select" class="comic-plugin-select">
                            <option value="">All Genres</option>
                            \${CONFIG.genres.map(g => \`<option value="\${g}">\${g}</option>\`).join('')}
                        </select>
                    </div>
                    <div id="comic-plugin-search-results" class="comic-plugin-grid"></div>\`;
                const elements = {
                    input: wrapper.querySelector("#" + CONFIG.ids.searchInput),
                    btn: wrapper.querySelector("#comic-plugin-search-btn"),
                    results: wrapper.querySelector("#comic-plugin-search-results"),
                    sort: wrapper.querySelector("#comic-plugin-sort-select"),
                    genre: wrapper.querySelector("#comic-plugin-genre-select")
                };
                
                // TASK 3: Fix for centered loading spinner
                async function performSearch(prefill = false) {
                    const query = elements.input.value;
                    const sort = elements.sort.value;
                    const genre = elements.genre.value || null;

                    elements.results.innerHTML = \`<div class="comic-plugin-loader"></div>\`;
                    
                    let media;
                    
                    // TASK 4: Fix infinite loading bug when no query is provided
                    if (prefill || (!query.trim() && !genre)) {
                        // Show trending when no query and no genre
                        media = await CachedAnilistQueries.getTrendingLightComics();
                    } else {
                        media = await CachedAnilistQueries.searchAnilistLightComics(query, sort, genre);
                    }

                    elements.results.innerHTML = (!media?.length) ?
                        "<p>No results.</p>" : 
                        media.map(m => Templates.posterCard(m)).join('');
                    elements.results.querySelectorAll('.comic-plugin-poster-card').forEach(el => {
                        el.onclick = () => handleComicSelection(el.getAttribute('data-id'));
                    });
                }

                elements.btn.onclick = () => performSearch(false);
                elements.input.onkeyup = (e) => { if (e.key === 'Enter') performSearch(false); };
                elements.sort.onchange = () => performSearch(true);
                elements.genre.onchange = () => performSearch(true);
                performSearch(true);
            }

            // --- Page: Library ---
            async function renderLibraryPage(wrapper) {
                if (!State.libraryLoaded) {
                    wrapper.innerHTML = \`<div class="comic-plugin-loader"></div>\`;
                    await loadLibrary();
                    updateLibraryPagination();
                }
                
                wrapper.innerHTML = "";
                
                if (State.libraryComics.length === 0) {
                    wrapper.innerHTML = \`
                        <div class="comic-plugin-empty-state">
                            <h2 class="comic-plugin-empty-title">Nothing here yet.. OwO</h2>
                            <p class="comic-plugin-empty-text">Start reading some comics and they'll appear here!</p>
                        </div>
                    \`;
                    return;
                }
                
                // TASK 4: Library header with view toggle and pagination
                wrapper.innerHTML += \`
                    <div class="comic-plugin-library-header">
                        <div>
                            <h1 class="comic-plugin-title">My Library</h1>
                            <p class="comic-plugin-subtitle">\${State.libraryComics.length} comics</p>
                        </div>
                        <div class="comic-plugin-library-controls">
                            <button class="comic-plugin-button icon-only secondary" id="comic-plugin-library-view-toggle" title="Toggle view">
                                \${State.libraryViewMode === 'list' ? Templates.icon('grid') : Templates.icon('list')}
                            </button>
                            <div class="comic-plugin-library-pagination">
                                <button class="comic-plugin-button icon-only" id="comic-plugin-library-prev" \${State.libraryPage <= 1 ? 'disabled' : ''}>‹</button>
                                <span class="comic-plugin-library-page-info">Page \${State.libraryPage} of \${State.libraryTotalPages}</span>
                                <button class="comic-plugin-button icon-only" id="comic-plugin-library-next" \${State.libraryPage >= State.libraryTotalPages ? 'disabled' : ''}>›</button>
                            </div>
                        </div>
                    </div>
                \`;
                
                // Library content container
                const contentContainer = document.createElement('div');
                contentContainer.id = 'comic-plugin-library-content';
                contentContainer.className = \`comic-plugin-library-content \${State.libraryViewMode === 'cards' ? 'grid-view' : 'list-view'}\`;
                wrapper.appendChild(contentContainer);
                
                // Get current page items
                const currentItems = getPaginatedLibraryItems();
                
                // Render items based on view mode
                if (State.libraryViewMode === 'list') {
                    currentItems.forEach(item => {
                        contentContainer.innerHTML += Templates.libraryCardList(item);
                    });
                } else {
                    currentItems.forEach(item => {
                        contentContainer.innerHTML += Templates.libraryCardGrid(item);
                    });
                }
                
                // Add event listeners
                const viewToggle = wrapper.querySelector('#comic-plugin-library-view-toggle');
                const prevBtn = wrapper.querySelector('#comic-plugin-library-prev');
                const nextBtn = wrapper.querySelector('#comic-plugin-library-next');
                
                if (viewToggle) {
                    viewToggle.onclick = toggleLibraryViewMode;
                }
                
                if (prevBtn) {
                    prevBtn.onclick = () => {
                        if (State.libraryPage > 1) {
                            State.libraryPage--;
                            renderUI();
                        }
                    };
                }
                
                if (nextBtn) {
                    nextBtn.onclick = () => {
                        if (State.libraryPage < State.libraryTotalPages) {
                            State.libraryPage++;
                            renderUI();
                        }
                    };
                }
                
                // Add event listeners for library items
                const addLibraryItemListeners = () => {
                    // Continue buttons
                    contentContainer.querySelectorAll('.continue-btn').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const anilistId = parseInt(btn.getAttribute('data-id'));
                            const sourceId = btn.getAttribute('data-source');
                            continueFromLibrary(anilistId, sourceId);
                        };
                    });
                    
                    // Remove buttons
                    contentContainer.querySelectorAll('.remove-btn').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const anilistId = parseInt(btn.getAttribute('data-id'));
                            removeFromLibrary(anilistId);
                        };
                    });
                    
                    // Make entire card clickable to view details
                    contentContainer.querySelectorAll('.comic-plugin-library-card-list, .comic-plugin-library-card-grid').forEach(card => {
                        card.onclick = (e) => {
                            // Don't trigger if clicking on buttons
                            if (e.target.closest('button')) return;
                            const anilistId = parseInt(card.getAttribute('data-id'));
                            handleComicSelection(anilistId);
                        };
                    });
                };
                
                // Wait for DOM to update
                setTimeout(addLibraryItemListeners, 0);
            }

            // --- Page: Details ---
            async function renderDetailsPage(wrapper) {
                if (!State.currentComic?.id) return handleComicSelection(null);
                wrapper.innerHTML = \`<div class="comic-plugin-loader"></div>\`;
                const media = await CachedAnilistQueries.getAnilistLightComicDetails(State.currentComic.id);
                wrapper.innerHTML = "";

                if (!media) { wrapper.innerHTML = "<p>Error loading details.</p>"; return; }
                State.currentComic = media;
                const getTags = (tags) => (tags || []).map(t => 
                    \`<span class="comic-plugin-tag \${t.isMediaSpoiler ? 'comic-plugin-spoiler-tag' : ''}" data-spoiler="\${t.isMediaSpoiler}">\${t.name}</span>\`
                ).join('') || '<p class="muted">No tags.</p>';

                const getLinks = (links) => {
                    if (!links || links.length === 0) return '<p class="muted">No links.</p>';
                    return \`<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        \${links.map(l => \`
                        <a href="\${l.url}" target="_blank" class="comic-plugin-ext-link-btn" style="margin:0;">
                            <span class="comic-plugin-ext-icon">\${Templates.icon(l.site.toLowerCase().includes('twitter') ? 'twitter' : 'link')}</span>
                            \${l.site}
                        </a>\`).join('')}
                    </div>\`;
                };

                const bannerStyle = \`position:relative;width:100%;min-height:300px;overflow:hidden;background-color:#121212;margin:-1.5rem -1.5rem 0 -1.5rem;max-width:1000px;left:53%;transform:translateX(-50%);margin-top:-4.5rem;border-radius:8px;z-index:0;pointer-events:none;\`;
                const bannerBg = \`position:absolute;inset:0;background:linear-gradient(to top,#121212 15%,rgba(18,18,18,0)) no-repeat,url('\${media.bannerImage || media.coverImage.extraLarge}') center 10%/cover no-repeat;z-index:0;\`;
                
                // Add pointer-events:none to the banner container to stop it from catching clicks intended for elements below or above it in stack
                wrapper.innerHTML = \`
                    <div style="\${bannerStyle}"><div style="\${bannerBg}"></div></div>
                    \${Templates.detailsHeader(media)}
                    <div class="comic-plugin-details-body">
                        <div class="comic-plugin-details-main">
                             <div class="comic-plugin-details-description">
                                <h3>About</h3>
                                <p>\${media.description ? media.description.replace(/<br>/g, ' ') : 'No description.'}</p>
                            </div>
                            \${media.recommendations.nodes.length > 0 ?
                                '<h2 class="comic-plugin-section-title">Recommendations</h2><div class="comic-plugin-grid">' + media.recommendations.nodes.map(r => r.mediaRecommendation ? Templates.posterCard(r.mediaRecommendation) : '').join('') + '</div>' : ''}
                        </div>
                        <div class="comic-plugin-details-sidebar">
                            <div id="comic-plugin-chapter-button-container"></div>
                            <div class="comic-plugin-details-sidebar-section">
                                <h3>External Links</h3>
                                \${getLinks(media.externalLinks)}
                            </div>
                            <div class="comic-plugin-details-sidebar-section">
                                <h3>Genres</h3>
                                <div class="comic-plugin-tags">\${media.genres.map(g => \`<span class="comic-plugin-tag">\${g}</span>\`).join('')}</div>
                            </div>
                            <div class="comic-plugin-details-sidebar-section">
                                <div class="comic-plugin-section-header">
                                    <h3>Tags</h3>
                                    <button id="comic-plugin-spoiler-toggle" class="comic-plugin-spoiler-toggle" style="cursor: pointer;">Show Spoilers</button>
                                </div>
                                <div class="comic-plugin-tags" id="comic-plugin-tags-container">
                                    \${getTags(media.tags)}
                                </div>
                            </div>
                        </div>
                    </div>\`;
                
                // Add Click Listener to Cover Image
                const coverImg = wrapper.querySelector('.comic-plugin-details-cover');
                if (coverImg) {
                    coverImg.title = 'Click to enlarge';
                    coverImg.onclick = (e) => {
                        e.stopPropagation();
                        showImageModal(media.coverImage.extraLarge || media.coverImage.large);
                    };
                }

                const spoilerToggle = wrapper.querySelector('#comic-plugin-spoiler-toggle');
                const tagsContainer = wrapper.querySelector('#comic-plugin-tags-container');
                
                if (spoilerToggle && tagsContainer) {
                    let showSpoilers = false;
                    spoilerToggle.onclick = (e) => {
                        e.preventDefault();
                        showSpoilers = !showSpoilers;
                        if (showSpoilers) {
                            tagsContainer.classList.add('show-spoilers');
                            spoilerToggle.textContent = 'Hide Spoilers';
                        } else {
                            tagsContainer.classList.remove('show-spoilers');
                            spoilerToggle.textContent = 'Show Spoilers';
                        }
                    };
                }

                wrapper.querySelectorAll('.comic-plugin-poster-card').forEach(el => {
                    if (el.getAttribute('data-id') !== media.id) {
                        el.onclick = () => handleComicSelection(el.getAttribute('data-id'));
                    }
                });

                const btnContainer = wrapper.querySelector('#comic-plugin-chapter-button-container');
                const autoMatchEl = document.createElement('div');
                autoMatchEl.id = CONFIG.ids.autoMatchContainer;
                autoMatchEl.innerHTML = \`<div class="comic-plugin-loader small"></div>\`;
                btnContainer.appendChild(autoMatchEl);

                const promises = [];
                State.sourceRegistry.forEach(src => promises.push(src.autoMatch(media.title.romaji, media.title.english)));
                const results = await Promise.allSettled(promises);
                
                State.matches.clear();
                let bestMatch = null;
                const sourceIds = [...State.sourceRegistry.keys()];

                results.forEach((res, idx) => {
                    if (res.status === 'fulfilled' && res.value) {
                        const sid = sourceIds[idx];
                        State.matches.set(sid, { ...res.value, chapters: null });
                        if (!bestMatch || res.value.similarity > bestMatch.similarity) {
                            bestMatch = { ...res.value, sourceId: sid };
                        }
                    }
                });
                if (bestMatch) {
                    State.currentSourceId = bestMatch.sourceId;
                    loadChaptersForActiveSource().then(() => renderChapterButtons(autoMatchEl));
                } else {
                    autoMatchEl.innerHTML = \`<p class="comic-plugin-error-text">No matches found.</p>\`;
                }

                const manBtn = document.createElement('button');
                manBtn.className = 'comic-plugin-button secondary';
                manBtn.textContent = 'Manual Search';
                manBtn.onclick = () => { State.page = "manual-match"; renderUI(); };
                btnContainer.appendChild(manBtn);
            }

            function renderChapterButtons(container) {
                const lastRead = StorageService.getLastRead(State.currentComic.id, State.currentSourceId);
                const readBtnHtml = lastRead && lastRead.chapterUrl
                    ? \`<button class="comic-plugin-button" id="comic-plugin-continue-btn">Continue: \${lastRead.chapterTitle}</button>\`
                    : \`<button class="comic-plugin-button" id="comic-plugin-start-btn">Start Reading (Ch 1)</button>\`;
                let selectorHtml = '';
                // Always show source selector, include local-epub even if no matches
                const allSources = [...State.sourceRegistry.keys()];
                if (allSources.length > 0) {
                    // Combine matched sources with local-epub if not present
                    const sourcesToShow = new Set([...State.matches.keys()]);
                    sourcesToShow.add('local-epub');
                    
                    selectorHtml = \`<div class="comic-plugin-filter-container" style="margin-bottom:0.5rem;"><label>Source:</label><select id="comic-plugin-source-select" class="comic-plugin-select">\${[...sourcesToShow].map(sid => {
                        const source = State.sourceRegistry.get(sid);
                        if (!source) return '';
                        const matchScore = State.matches.get(sid)?.similarity.toFixed(2);
                        const scoreText = matchScore ? \` (\${matchScore})\` : '';
                        return \`<option value="\${sid}" \${sid === State.currentSourceId ? 'selected' : ''}>\${source.name}\${scoreText}</option>\`;
                    }).join('')}</select></div>\`;
                }

                container.innerHTML = \`\${selectorHtml}\${readBtnHtml}<button class="comic-plugin-button secondary" id="comic-plugin-view-all-btn">View All Chapters (\${State.currentChapters.length})</button>\`;
                container.querySelector('#comic-plugin-continue-btn')?.addEventListener('click', () => loadAndReadChapter(lastRead.chapterUrl, lastRead.chapterIndex));
                container.querySelector('#comic-plugin-start-btn')?.addEventListener('click', () => { if (State.currentChapters.length) loadAndReadChapter(State.currentChapters[0].url, 0); });
                container.querySelector('#comic-plugin-view-all-btn').onclick = () => { State.page = "chapters"; renderUI(); };
                
                const select = container.querySelector('#comic-plugin-source-select');
                if (select) {
                    select.onchange = async (e) => {
                        State.currentSourceId = e.target.value;
                        
                        // Show file picker for local EPUB source
                        if (e.target.value === 'local-epub') {
                            if (!window.LocalEpubAPI) {
                                container.innerHTML = \`<div class="comic-plugin-error">Local EPUB API not available</div>\`;
                                return;
                            }
                            
                            container.innerHTML = \`
                                <div class="comic-plugin-file-picker">
                                    <input type="file" id="comic-plugin-epub-input" accept=".epub" style="display: none;">
                                    <button class="comic-plugin-button" id="comic-plugin-select-epub-btn">Select EPUB File</button>
                                    <div id="comic-plugin-epub-loading" class="comic-plugin-loader small" style="display: none;"></div>
                                    <div id="comic-plugin-epub-error" class="comic-plugin-error" style="display: none;"></div>
                                </div>
                            \`;
                            
                            const fileInput = container.querySelector('#comic-plugin-epub-input');
                            const selectBtn = container.querySelector('#comic-plugin-select-epub-btn');
                            const loading = container.querySelector('#comic-plugin-epub-loading');
                            const error = container.querySelector('#comic-plugin-epub-error');
                            
                            selectBtn.onclick = () => fileInput.click();
                            
                            fileInput.onchange = async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                
                                loading.style.display = 'block';
                                error.style.display = 'none';
                                
                                try {
                                    const result = await window.LocalEpubAPI.loadEpub(file);
                                    State.currentComic = {
                                        id: result.id,
                                        title: { romaji: result.title, english: result.title }
                                    };
                                    
                                    // Directly load chapters for local EPUB
                                    const source = State.sourceRegistry.get('local-epub');
                                    if (source) {
                                        State.currentChapters = await source.getChapters(result.id);
                                        console.log('[comic-plugin] Loaded', State.currentChapters.length, 'chapters from local EPUB');
                                    }
                                    
                                    renderChapterButtons(container);
                                } catch (err) {
                                    error.textContent = 'Failed to load EPUB: ' + err.message;
                                    error.style.display = 'block';
                                    loading.style.display = 'none';
                                }
                            };
                            
                            return;
                        }
                        
                        container.innerHTML = \`<div class="comic-plugin-loader small"></div>\`;
                        await loadChaptersForActiveSource();
                        renderChapterButtons(container);
                    };
                }
            }

            // --- Page: Manual Match ---
            function renderManualMatchPage(wrapper) {
                if (!State.currentComic) { State.page = "discover"; renderUI(); return; }
                
                wrapper.innerHTML += \`
                    <h1 class="comic-plugin-title">Manual Match</h1>
                    <div class="comic-plugin-input-container">
                        <input id="\${CONFIG.ids.searchInput}" class="comic-plugin-input" value="\${(State.currentComic.title.romaji || '').replace(/"/g, '&quot;')}"/>
                        <button id="comic-plugin-manual-search-btn" class="comic-plugin-button">Search</button>
                    </div>
                    <div id="comic-plugin-manual-results" class="comic-plugin-manual-list"></div>\`;

                const elements = {
                    input: wrapper.querySelector('#' + CONFIG.ids.searchInput),
                    btn: wrapper.querySelector('#comic-plugin-manual-search-btn'),
                    results: wrapper.querySelector('#comic-plugin-manual-results')
                };

                async function search() {
                    const query = elements.input.value;
                    if (!query || !query.trim()) return;
                    elements.results.innerHTML = \`<div class="comic-plugin-loader small"></div>\`;

                    const promises = [];
                    State.sourceRegistry.forEach((src, id) => {
                        promises.push(src.manualSearch(query).then(res => ({ id, name: src.name, res })));
                    });
                    const outcomes = await Promise.allSettled(promises);
                    elements.results.innerHTML = "";
                    let count = 0;
                    outcomes.forEach(o => {
                        if (o.status === 'rejected') return;
                        const { id, name, res } = o.value;
                        count += res.length;
                        res.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'comic-plugin-result-card';
                            div.innerHTML = \`
                                <span class="comic-plugin-provider-tag">\${name}</span>
                                <img src="\${item.image}" class="comic-plugin-result-img" onerror="this.src='https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'">
                                <div class="comic-plugin-result-stack">
                                    <p class="comic-plugin-result-title">\${item.title}</p>
                                    <p class="comic-plugin-result-chapter">\${item.latestChapter || 'Unknown'}</p>
                                </div>
                                <button class="comic-plugin-view-btn select-btn">Select</button>\`;
                            div.querySelector('.select-btn').onclick = async () => {
                                State.isLoading = true;
                                renderUI();
                                const chaps = await State.sourceRegistry.get(id).getChapters(item.url);
                                State.currentSourceId = id;
                                State.currentChapters = chaps;
                                State.matches.clear();
                                State.matches.set(id, { match: { url: item.url, title: item.title }, similarity: 1.0, chapters: chaps });
                                State.isLoading = false;
                                State.page = chaps.length ? "chapters" : "manual-match";
                                renderUI();
                            };
                            elements.results.appendChild(div);
                        });
                    });
                    if (count === 0) elements.results.innerHTML = "<p>No results found.</p>";
                }

                elements.btn.onclick = search;
                elements.input.onkeyup = (e) => { if (e.key === 'Enter') search(); };
                search();
            }

            // --- Page: Chapters ---
            async function renderChapterListPage(wrapper) {
                if (!State.currentComic) { State.page = "discover"; renderUI(); return; }
                if (!State.currentChapters.length) {
                    State.isLoading = true;
                    renderUI();
                    await loadChaptersForActiveSource();
                    State.isLoading = false; renderUI();
                    return;
                }

                const lastRead = StorageService.getLastRead(State.currentComic.id, State.currentSourceId);
                let listHtml = State.currentChapters.map((ch, idx) => {
                    const isLast = lastRead && lastRead.chapterIndex === idx;
                    return \`
                        <div class="comic-plugin-chapter-item \${isLast ? 'last-read' : ''}">
                            <p class="comic-plugin-chapter-title" title="\${ch.title}">\${isLast ? '<span>★</span>' : ''} \${ch.title}</p>
                            <button class="comic-plugin-view-btn read-btn" data-url="\${ch.url}" data-index="\${idx}">Read</button>
                        </div>\`;
                }).join('');
                wrapper.innerHTML += \`
                    <h2 class="comic-plugin-title">\${State.currentComic.title.romaji}</h2>
                    <p class="comic-plugin-subtitle">Chapters (\${State.sourceRegistry.get(State.currentSourceId).name})</p>
                    <div class="comic-plugin-chapter-list">\${listHtml || '<p>No chapters.</p>'}</div>\`;

                wrapper.querySelectorAll(".read-btn").forEach(btn => {
                    btn.onclick = () => loadAndReadChapter(btn.getAttribute("data-url"), btn.getAttribute("data-index"));
                });
            }

            // --- Page: Reader ---
            function renderReaderPage(wrapper) {
                if (!State.currentComic || !State.currentChapterContent) { State.page = "chapters"; renderUI(); return; }

                // 1. Header
                const header = document.createElement('div');
                header.className = 'comic-plugin-reader-header';

                const createBtn = (txt, disabled, fn) => {
                    const b = document.createElement('button');
                    b.className = 'comic-plugin-button' + (disabled ? ' disabled' : '');
                    b.textContent = txt;
                    b.disabled = disabled;
                    b.onclick = fn;
                    return b;
                };

                // Settings Button
                const settingsBtn = document.createElement('button');
                settingsBtn.className = 'comic-plugin-button icon-only';
                settingsBtn.innerHTML = Templates.icon('settings');
                settingsBtn.title = "Reader Settings";
                settingsBtn.onclick = () => {
                    State.showSettings = !State.showSettings;
                    const panel = document.getElementById('comic-plugin-settings-panel');
                    if (panel) panel.style.display = State.showSettings ? 'block' : 'none';
                };

                const prev = createBtn('‹ Prev', State.currentChapterIndex <= 0, () => {
                   const idx = State.currentChapterIndex - 1;
                   loadAndReadChapter(State.currentChapters[idx].url, idx);
                });
                const next = createBtn('Next ›', State.currentChapterIndex >= State.currentChapters.length - 1, () => {
                   const idx = State.currentChapterIndex + 1;
                   loadAndReadChapter(State.currentChapters[idx].url, idx);
                });
                const select = document.createElement('select');
                select.className = 'comic-plugin-select';
                State.currentChapters.forEach((ch, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = ch.title;
                    if (i === State.currentChapterIndex) opt.selected = true;
                    select.appendChild(opt);
                });
                select.onchange = (e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (idx !== State.currentChapterIndex) loadAndReadChapter(State.currentChapters[idx].url, idx);
                };

                header.append(prev, select, next, settingsBtn);
                wrapper.appendChild(header);

                // 2. Settings Panel
                const currentSettings = StorageService.getSettings();
                const settingsPanel = document.createElement('div');
                settingsPanel.id = 'comic-plugin-settings-panel';
                settingsPanel.className = 'comic-plugin-settings-panel';
                settingsPanel.style.display = State.showSettings ? 'block' : 'none';

                const createSettingRow = (label, input) => {
                    const row = document.createElement('div');
                    row.className = 'comic-plugin-setting-row';
                    const lbl = document.createElement('label');
                    lbl.textContent = label;
                    row.appendChild(lbl);
                    row.appendChild(input);
                    return row;
                };

                // Apply function
                const applySettings = (s) => {
                    const c = document.querySelector('.comic-plugin-reader-content');
                    if(!c) return;
                    
                    // Theme Map
                    const themes = {
                        dark: { bg: '#121212', text: '#e0e0e0' },
                        light: { bg: '#f5f5f5', text: '#121212' },
                        sepia: { bg: '#f4ecd8', text: '#5b4636' }
                    };
                    const theme = themes[s.theme] || themes.dark;
                    
                    c.style.backgroundColor = theme.bg;
                    c.style.color = theme.text;
                    c.style.fontSize = s.fontSize + 'px';
                    c.style.lineHeight = s.lineHeight;
                    c.style.fontFamily = s.fontFamily;
                    c.style.maxWidth = s.maxWidth + 'px';
                    
                    StorageService.saveSettings(s);
                };

                // Controls
                // Theme
                const themeSelect = document.createElement('select');
                themeSelect.className = 'comic-plugin-select small';
                ['dark', 'light', 'sepia'].forEach(t => {
                    const o = document.createElement('option');
                    o.value = t; o.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                    if (t === currentSettings.theme) o.selected = true;
                    themeSelect.appendChild(o);
                });
                themeSelect.onchange = (e) => { currentSettings.theme = e.target.value; applySettings(currentSettings); };
                
                // Font Size
                const fsInput = document.createElement('input');
                fsInput.type = 'range'; fsInput.min = "12"; fsInput.max = "32"; fsInput.value = currentSettings.fontSize;
                fsInput.oninput = (e) => { currentSettings.fontSize = e.target.value; applySettings(currentSettings); };

                // Line Height
                const lhInput = document.createElement('input');
                lhInput.type = 'range'; lhInput.min = "1.0"; lhInput.max = "2.5"; lhInput.step = "0.1"; lhInput.value = currentSettings.lineHeight;
                lhInput.oninput = (e) => { currentSettings.lineHeight = e.target.value; applySettings(currentSettings); };

                // Font Family
                const ffSelect = document.createElement('select');
                ffSelect.className = 'comic-plugin-select small';
                const fonts = { 'Sans Serif': 'sans-serif', 'Serif': 'serif', 'Monospace': 'monospace' };
                Object.entries(fonts).forEach(([k, v]) => {
                    const o = document.createElement('option');
                    o.value = v; o.textContent = k;
                    if (v === currentSettings.fontFamily) o.selected = true;
                    ffSelect.appendChild(o);
                });
                ffSelect.onchange = (e) => { currentSettings.fontFamily = e.target.value; applySettings(currentSettings); };

                // Max Width
                const mwInput = document.createElement('input');
                mwInput.type = 'range'; mwInput.min = "400"; mwInput.max = "1200"; mwInput.step = "50"; mwInput.value = currentSettings.maxWidth;
                mwInput.oninput = (e) => { currentSettings.maxWidth = e.target.value; applySettings(currentSettings); };

                settingsPanel.appendChild(createSettingRow('Theme', themeSelect));
                settingsPanel.appendChild(createSettingRow('Font Size', fsInput));
                settingsPanel.appendChild(createSettingRow('Line Height', lhInput));
                settingsPanel.appendChild(createSettingRow('Font Family', ffSelect));
                settingsPanel.appendChild(createSettingRow('Page Width', mwInput));
                
                wrapper.appendChild(settingsPanel);

                // 3. Content
                const container = document.createElement('div');
                container.className = 'comic-plugin-reader-container';
                const contentDiv = document.createElement('div');
                contentDiv.className = 'comic-plugin-reader-content';
                contentDiv.innerHTML = State.currentChapterContent;
                container.appendChild(contentDiv);
                wrapper.appendChild(container);

                // Apply initial settings
                setTimeout(() => applySettings(currentSettings), 0);
            }

            // ---------------------------------------------------------------------------
            // 7. INITIALIZATION & LIFECYCLE
            // ---------------------------------------------------------------------------

            function loadAsset(url, id, type, logName) {
                return fetch(url).then(res => {
                    if (!res.ok) throw new Error(\`Status \${res.status}\`);
                    return res.text();
                }).then(txt => {
                    const el = document.createElement(type);
                    el.id = id;
                    el.textContent = txt;
                    if (type === 'style') {
                        // All CSS is now in the external file, no need to add extra
                        // Just set the fetched CSS content
                    }
                    document.head.appendChild(el);
                    console.log(\`[comic-plugin] Loaded \${logName}\`);
                });
            }

            async function start() {
                const layout = document.querySelector(CONFIG.selectors.appLayout);
                if (layout) layout.style.display = "none";

                try {
                    // Clear expired cache entries on startup
                    CacheService.clearExpired();
                    
                    await Promise.all([
                        loadAsset(CONFIG.assets.css, CONFIG.ids.style, 'style', 'CSS'),
                        loadAsset(CONFIG.assets.queries, CONFIG.ids.scriptQuery, 'script', 'Queries'),
                        loadAsset(CONFIG.assets.scraperExtra, 'comic-plugin-scrapers-comicextra', 'script', 'ComicExtra')
                    ]);
                    const backdrop = document.createElement("div");
                    backdrop.id = CONFIG.ids.backdrop;
                    backdrop.innerHTML = Templates.modalStructure();
                    document.body.appendChild(backdrop);

                    document.getElementById('comic-plugin-tab-discover').onclick = () => { State.activeTab = "discover"; State.page = "discover"; renderUI(); };
                    document.getElementById('comic-plugin-tab-library').onclick = () => { State.activeTab = "library"; State.page = "library"; renderUI(); };
                    document.getElementById('comic-plugin-tab-search').onclick = () => { State.activeTab = "search"; State.page = "search"; renderUI(); };
                    document.getElementById(CONFIG.ids.closeBtn).onclick = cleanup;

                    // REGISTER GLOBAL ESC (Use Bubbling on window to catch after stopPropagation)
                    window.addEventListener('keydown', handleGlobalEsc);

                    renderUI(); 
                } catch (e) {
                    console.error("[comic-plugin] Init failed", e);
                    cleanup();
                }
            }

            function cleanup() {
                const layout = document.querySelector(CONFIG.selectors.appLayout);
                if (layout) layout.style.display = "flex";

                // REMOVE GLOBAL ESC
                window.removeEventListener('keydown', handleGlobalEsc);

                [CONFIG.ids.backdrop, CONFIG.ids.style, CONFIG.ids.scriptQuery, 'comic-plugin-scrapers-comicextra']
                    .forEach(id => document.getElementById(id)?.remove());
                document.querySelector(\`script[data-comic-plugin-id="\${CONFIG.scriptId}"]\`)?.remove();
                console.log("[comic-plugin] Cleaned up.");
            }

            await start();
        })();`;
        }

        // ---------------------------------------------------------------------------
        // 2. UI REGISTRATION & TRAY
        // ---------------------------------------------------------------------------
        const tray = ctx.newTray({
            tooltipText: "Comic Reader",
            iconUrl: "https://raw.githubusercontent.com/BiniFn/WeebHub-Providers/refs/heads/main/public/comic.png",
            withContent: false,
        });
        tray.onClick(async () => {
            console.log("[comic-plugin] Tray clicked.");
            try {
                if (await ctx.dom.queryOne("#comic-plugin-backdrop")) {
                    console.log("[comic-plugin] Already open.");
                    return;
                }
                const body = await ctx.dom.queryOne("body");
                if (!body) return console.error("[comic-plugin] No body found!");

                const scriptId = `comic-plugin-script-${Date.now()}`;
                const script = await ctx.dom.createElement("script");
                script.setAttribute("data-comic-plugin-id", scriptId);
                script.setText(getInjectedScriptString(scriptId));
                body.append(script);
                console.log(`[comic-plugin] Injected script #${scriptId}`);
            } catch (err) {
                console.error("[comic-plugin] Tray Error:", err);
            }
        });
    });
}
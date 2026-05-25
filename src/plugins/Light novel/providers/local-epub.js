(function() {
    // Check if script is already loaded
    if (window.LocalEpubSource) {
        return;
    }

    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
        console.error('[novel-plugin] JSZip is not loaded. Cannot use Local EPUB source.');
        return;
    }

    // IndexedDB setup
    const DB_NAME = 'novel-plugin-epub-store';
    const DB_VERSION = 1;
    const STORE_NAME = 'epub-files';

    let db = null;

    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    objectStore.createIndex('title', 'title', { unique: false });
                }
            };
        });
    }

    // Store EPUB in IndexedDB
    function storeEpub(epubData) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(epubData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get EPUB from IndexedDB
    function getEpub(id) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Parse EPUB file
    async function parseEpub(fileData) {
        try {
            console.log('[novel-plugin] Starting EPUB parsing...');
            const zip = await JSZip.loadAsync(fileData);
            console.log('[novel-plugin] EPUB loaded, files:', Object.keys(zip.files).length);
            
            // Find and parse container.xml
            const containerXml = await zip.file('META-INF/container.xml')?.async('text');
            if (!containerXml) {
                throw new Error('Invalid EPUB: Missing META-INF/container.xml');
            }
            console.log('[novel-plugin] container.xml found');
            
            // Extract OPF file path from container.xml
            const parser = new DOMParser();
            const containerDoc = parser.parseFromString(containerXml, 'text/xml');
            const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
            if (!opfPath) {
                throw new Error('Invalid EPUB: Could not find OPF file path');
            }
            console.log('[novel-plugin] OPF path:', opfPath);
            
            // Parse OPF file
            const opfXml = await zip.file(opfPath)?.async('text');
            if (!opfXml) {
                throw new Error('Invalid EPUB: Could not find OPF file');
            }
            console.log('[novel-plugin] OPF file loaded');
            
            const opfDoc = parser.parseFromString(opfXml, 'text/xml');
            
            // Extract metadata
            const metadata = opfDoc.querySelector('metadata');
            const title = metadata?.querySelector('title')?.textContent || 'Unknown Title';
            const author = metadata?.querySelector('creator')?.textContent || 'Unknown Author';
            console.log('[novel-plugin] Title:', title, 'Author:', author);
            
            // Extract spine (reading order)
            const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref')).map(item => item.getAttribute('idref'));
            console.log('[novel-plugin] Spine items:', spineItems.length);
            
            // Extract manifest (file paths)
            const manifest = {};
            opfDoc.querySelectorAll('manifest item').forEach(item => {
                manifest[item.getAttribute('id')] = {
                    href: item.getAttribute('href'),
                    mediaType: item.getAttribute('media-type')
                };
            });
            console.log('[novel-plugin] Manifest items:', Object.keys(manifest).length);
            
            // Build chapter list from spine
            const chapters = [];
            const allZipFiles = Object.keys(zip.files);
            
            for (let i = 0; i < spineItems.length; i++) {
                const itemId = spineItems[i];
                const item = manifest[itemId];
                if (item) {
                    console.log(`[novel-plugin] Processing spine item ${i}: ${itemId}, mediaType: ${item.mediaType}`);
                    // Accept both xhtml+xml and html+xml media types
                    if (item.mediaType === 'application/xhtml+xml' || 
                        item.mediaType === 'application/x-html+xml' ||
                        item.mediaType === 'text/html') {
                        const href = item.href;
                        // Resolve relative path to OPF file
                        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
                        const fullPath = opfDir + href;
                        
                        // Only add if the file actually exists in the ZIP
                        if (allZipFiles.includes(fullPath)) {
                            chapters.push({
                                title: `Chapter ${chapters.length + 1}`,
                                url: fullPath,
                                index: chapters.length
                            });
                        } else {
                            console.warn(`[novel-plugin] Skipping non-existent file: ${fullPath}`);
                        }
                    }
                } else {
                    console.warn(`[novel-plugin] Spine item ${itemId} not found in manifest`);
                }
            }
            
            console.log('[novel-plugin] Total chapters found:', chapters.length);
            
            if (chapters.length === 0) {
                throw new Error('No chapters found in EPUB. The EPUB may use a different structure.');
            }
            
            return {
                title,
                author,
                chapters,
                zip,
                opfDir: opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
            };
        } catch (error) {
            console.error('[novel-plugin] EPUB parsing error:', error);
            throw error;
        }
    }

    // Get chapter content from EPUB
    async function getChapterContentFromEpub(epubData, chapterUrl) {
        try {
            console.log('[novel-plugin] Getting chapter content for:', chapterUrl);
            const zip = await JSZip.loadAsync(epubData.fileData);
            
            // Log all files in ZIP
            const allFiles = Object.keys(zip.files);
            console.log('[novel-plugin] All files in ZIP:', allFiles.slice(0, 20), '...');
            console.log('[novel-plugin] Total files in ZIP:', allFiles.length);
            
            // Log available HTML files
            const htmlFiles = allFiles.filter(f => f.includes('.xhtml') || f.includes('.html'));
            console.log('[novel-plugin] Available HTML files:', htmlFiles.slice(0, 15), '...');
            console.log('[novel-plugin] Total HTML files:', htmlFiles.length);
            
            console.log('[novel-plugin] Looking for file:', chapterUrl);
            let contentXml = await zip.file(chapterUrl)?.async('text');
            
            if (!contentXml) {
                console.error('[novel-plugin] Could not find file:', chapterUrl);
                // Try to find a matching file by filename only
                const fileName = chapterUrl.split('/').pop();
                console.log('[novel-plugin] Trying to find file by name:', fileName);
                const matchingFile = htmlFiles.find(f => f.endsWith(fileName));
                if (matchingFile) {
                    console.log('[novel-plugin] Found matching file:', matchingFile);
                    contentXml = await zip.file(matchingFile)?.async('text');
                    if (contentXml) {
                        return processChapterContent(contentXml, zip, matchingFile);
                    }
                }
                
                // If still not found, try to find by partial match
                const partialMatch = htmlFiles.find(f => f.includes(fileName.replace('.xhtml', '')));
                if (partialMatch) {
                    console.log('[novel-plugin] Found partial match:', partialMatch);
                    contentXml = await zip.file(partialMatch)?.async('text');
                    if (contentXml) {
                        return processChapterContent(contentXml, zip, partialMatch);
                    }
                }
                
                throw new Error('Could not find chapter content. Looking for: ' + chapterUrl);
            }
            
            return processChapterContent(contentXml, zip, chapterUrl);
        } catch (error) {
            console.error('[novel-plugin] Chapter content extraction error:', error);
            throw error;
        }
    }

    async function processChapterContent(contentXml, zip, chapterUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentXml, 'text/html');
        const body = doc.querySelector('body');
        
        if (!body) {
            throw new Error('Could not find body content');
        }
        
        // Get the chapter directory for resolving image paths
        const chapterDir = chapterUrl.substring(0, chapterUrl.lastIndexOf('/') + 1);
        console.log('[novel-plugin] Chapter directory:', chapterDir);
        
        // Process images
        const images = body.querySelectorAll('img');
        for (const img of images) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                // Resolve relative path
                let imagePath = src;
                if (!src.startsWith('/')) {
                    // Normalize path (resolve ../)
                    const parts = (chapterDir + src).split('/');
                    const resolvedParts = [];
                    for (const part of parts) {
                        if (part === '..') {
                            resolvedParts.pop();
                        } else if (part && part !== '.') {
                            resolvedParts.push(part);
                        }
                    }
                    imagePath = resolvedParts.join('/');
                }
                
                console.log('[novel-plugin] Loading image:', imagePath);
                try {
                    const imageData = await zip.file(imagePath)?.async('base64');
                    if (imageData) {
                        const mimeType = getMimeType(src);
                        img.setAttribute('src', `data:${mimeType};base64,${imageData}`);
                        console.log('[novel-plugin] Image loaded successfully');
                    } else {
                        console.warn('[novel-plugin] Image file not found in ZIP:', imagePath);
                        img.remove(); // Remove broken image
                    }
                } catch (e) {
                    console.warn('[novel-plugin] Could not load image:', imagePath, e);
                    img.remove(); // Remove broken image
                }
            }
        }
        
        return body.innerHTML;
    }

    function getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }

    // Current EPUB data (in memory)
    let currentEpubData = null;

    // Initialize database
    initDB().catch(err => console.error('[novel-plugin] IndexedDB initialization failed:', err));

    // --- Interface Implementation ---

    async function autoMatch(romajiTitle, englishTitle) {
        // Not applicable for local files
        return null;
    }

    async function manualSearch(query) {
        // Not applicable for local files
        return [];
    }

    async function getChapters(novelUrl) {
        try {
            // novelUrl is the EPUB ID
            if (currentEpubData && currentEpubData.id === novelUrl) {
                return currentEpubData.chapters;
            }
            
            // Try to load from IndexedDB
            const epubData = await getEpub(novelUrl);
            if (!epubData) {
                throw new Error('EPUB not found');
            }
            
            currentEpubData = epubData;
            return epubData.chapters;
        } catch (error) {
            console.error('[novel-plugin] Local EPUB getChapters error:', error);
            return [];
        }
    }

    async function getChapterContent(chapterUrl) {
        try {
            if (!currentEpubData) {
                throw new Error('No EPUB loaded');
            }
            
            return await getChapterContentFromEpub(currentEpubData, chapterUrl);
        } catch (error) {
            console.error('[novel-plugin] Local EPUB getChapterContent error:', error);
            return '<p>Error loading chapter content.</p>';
        }
    }

    // Public API for loading EPUB files
    window.LocalEpubAPI = {
        async loadEpub(file) {
            try {
                const fileData = await file.arrayBuffer();
                const epubData = await parseEpub(fileData);
                
                const id = 'local-' + Date.now();
                // Don't store full fileData in IndexedDB to avoid corruption
                const epubRecord = {
                    id,
                    title: epubData.title,
                    author: epubData.author,
                    chapters: epubData.chapters,
                    lastReadTime: Date.now()
                };
                
                await storeEpub(epubRecord);
                // Keep the ZIP in memory for the current session
                currentEpubData = {
                    ...epubRecord,
                    fileData: fileData,
                    zip: epubData.zip,
                    opfDir: epubData.opfDir
                };
                
                return { id, title: epubData.title };
            } catch (error) {
                console.error('[novel-plugin] Local EPUB load error:', error);
                throw error;
            }
        },
        
        async loadFromLibrary(id) {
            throw new Error('Library loading not yet implemented. Please re-upload the EPUB file.');
        },
        
        async getLibraryItems() {
            try {
                if (!db) {
                    await initDB();
                }
                
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.getAll();
                    
                    request.onsuccess = () => {
                        const items = request.result.map(item => ({
                            id: item.id,
                            title: item.title,
                            author: item.author,
                            cover: null,
                            latestChapter: item.chapters[item.chapters.length - 1]?.title || 'No chapters',
                            source: 'local-epub'
                        }));
                        resolve(items);
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('[novel-plugin] Local EPUB get library error:', error);
                return [];
            }
        }
    };

    // --- Create and Register The Source ---

    const localEpubSource = {
        id: "local-epub",
        name: "Local Files",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.novelPluginRegistry) {
        window.novelPluginRegistry.registerSource(localEpubSource);
        console.log('[novel-plugin] LocalEpubSource registered.');
    } else {
        console.error('[novel-plugin] LocalEpubSource: Registry not found!');
    }

})();

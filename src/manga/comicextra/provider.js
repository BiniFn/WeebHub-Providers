/**
 * WeebHub Extension for ComicExtra
 * Implements MangaProvider interface for 'https://comicextra.org'.
 */
class Provider {

    constructor() {
        this.api = 'https://comicextra.org';
    }

    api = ''; 

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    async search(opts) {
        const queryParam = opts.query;
        // Search endpoint uses ?key=query
        const url = `${this.api}/comic-search?key=${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            });

            if (!response.ok) return [];
            
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let mangas = [];

            doc('.cartoon-box').each((index, element) => {
                const linkElement = element.find('h3 a').first();
                const imageElement = element.find('img').first();

                if (!linkElement || !imageElement) return;

                const title = linkElement.text().trim();
                const mangaUrl = linkElement.attrs()['href'];
                // ID is the last part of the URL (e.g., https://comicextra.org/comic/batman -> batman)
                const mangaId = mangaUrl.split('/').pop();
                const image = imageElement.attrs()['src'];

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: image,
                });
            });

            return mangas;
        }
        catch (e) {
            return [];
        }
    }

    async findChapters(mangaId) {
        const url = `${this.api}/comic/${mangaId}`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];

            // Chapters are usually in a table with id 'list'
            doc('#list tr').each((index, element) => {
                const linkElement = element.find('a').first();
                if (!linkElement || !linkElement.attrs) return;

                const fullUrl = linkElement.attrs()['href'];
                const titleWithDate = linkElement.text().trim();
                // Extract chapter id from the URL
                const chapterIdMatch = fullUrl.match(/comicextra\.org\/(.+)/);
                if (!chapterIdMatch) return;
                const chapterId = chapterIdMatch[1]; // e.g. batman/chapter-1

                // Attempt to parse chapter number
                const titleParts = titleWithDate.split(/Issue|Chapter/i);
                let chapterNumber = '0';
                if (titleParts.length > 1) {
                    const chapMatch = titleParts[1].match(/(\d+(\.\d+)?)/);
                    if (chapMatch) chapterNumber = chapMatch[0];
                }

                chapters.push({
                    id: chapterId,
                    url: fullUrl,
                    title: titleWithDate,
                    chapter: chapterNumber,
                    index: 0,
                });
            });

            // Sort chapters chronologically
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            chapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        }
        catch (e) {
            return [];
        }
    }

    async findChapterPages(chapterId) {
        // Append /full to get all images on one page usually works for comicextra
        const url = `${this.api}/${chapterId}/full`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let pages = [];

            doc('.chapter-container img').each((index, element) => {
                const imgUrl = element.attrs()['src'];

                if (imgUrl) {
                    pages.push({
                        url: imgUrl,
                        index: index,
                        headers: {},
                    });
                }
            });

            return pages;
        }
        catch (e) {
            return [];
        }
    }
}

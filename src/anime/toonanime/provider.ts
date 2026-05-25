//#region type
type ToonAnimeEpisodesDetails = {
    type: string;
    data:
    {
        pageMetaTags: {
            title: string;
            description: string;
            openGraph: {
                title: string;
                image: string;
                description: string;
                type: string;
                site_name: string;
            };
            keywords: (string | string[])[];
            robots: string;
        };
        post: {
            status: boolean;
            data: {
                id: number;
                title: string;
                status: string;
                duration: string;
                score: string;
                vote_plus: number;
                vote_minus: number;
                total_vote: number;
                image_url: string;
                cover_url: string; // use this if normalized
                anilistid: number;
                year: string;
                related_saison: any[];
                season: string;
                romaji: string;
                userPreferredTitle: string;
                native: string;
                synonyms: string[];
                mal_id: number;
                isAdult: boolean;
                url: string;
                totalEpisodes: string;
                rating: string;
                synopsis: string;
                episodeslist: EpisodesList[];
                currentEpisode: string;
                rank: string;
                popularity: string;
                categorie: string;
                categorie_url: string;
                trailer_url: string;
                source: string;
                nextAiringEpisode: {
                    airingAt: number;
                    timeUntilAiring: number;
                    episode: number;
                };
                hashtag: string | null;
                broadcast: string | null;
                created_at: string;
                updated_at: string;
                studios: { id: number; studio: string }[];
                genres: string[];
            };
            characters: {
                id: number;
                name: string;
                image: string;
                role: string;
            }[];
            recommendations: {
                id: number;
                title: string;
                totalEpisodes: string;
                categories: string;
                image: string;
                url: string;
            }[];
        };
    };
    uses: {
        params: string[];
    };
};

type EpisodesList = {
    id: number;
    image: string | null;
    title: string;
    number: number;
    description: string;
    data: {
        [key: string]: {
            server_id: string;
            server_type: string;
            server_number: string;
            server_name: string;
            server_url: string;
            timestamps: any[];
            quality: string;
            server_source_type: string;
        };
    };
};

type ToonAnimeSearchResult = {
    status: boolean,
    data: ToonData[],
    hasNext: boolean
    hasPrev: boolean
    total: number,
    page: number,
    adminMessage: string[]
};

type ToonData = {
    id: number,
    title: string,
    romaji: string,
    cat_url: string,
    native: string,
    synonyms: string[],
    mal_id: number,
    status: string,
    isAdult: boolean,
    url: string,
    synopsis: string,
    image: string,
    categorie: string,
    categorie_url: string,
    createdate: string,
    editedate: string,
    popularity: string,
    score: string,
    quality: string | null,
    total_episodes: string,
    current_episode: string,
    year: string,
    duration: string,
    updated_at: string,
    created_at: string
};
//#endregion

enum ToonAnimeServer {
    SIBNET = "sibnet",
    VIDCDN = "VidCDN",
    CDN1 = "CDN 1",
    VIDM = "vidm"
}

const DecodeHtml = s => s.replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

class Provider {

    //#region Fetch
    async FetchServerHandler(url: string, _server: string): Promise<EpisodeServer> {
        const server: ToonAnimeServer = _server as ToonAnimeServer;
        switch (server) {
            case ToonAnimeServer.SIBNET:
                return await this.FetchUrlSibnet(url);
            case ToonAnimeServer.VIDCDN:
                return await this.FetchUrlVidCDN(url);
            case ToonAnimeServer.CDN1:
                return await this.FetchUrlCDN1(url);
            case ToonAnimeServer.VIDM:
                return await this.FetchUrlVidM(url);
            default:
                return <EpisodeServer>{
                    server: _server,
                    headers: {},
                    videoSources: []
                };
        }
    }

    async FetchUrlSibnet(url: string): Promise<EpisodeServer> {
        const req = await fetch(url);
        const html = await req.text();
        const $ = LoadDoc(html);

        const videos: VideoSource[] = [];
        const headers = {
            Host: "video.sibnet.ru",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
            Accept: "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
            "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
            Range: "bytes=0-",
            "Sec-GPC": "1",
            Connection: "keep-alive",
            Referer: url,
            Cookie: "__ddg1_=;__ddg2_=;",
            "Sec-Fetch-Dest": "video",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "same-origin",
            AcceptEncoding: "identity",
            Priority: "u=0"
        }

        const ScriptItems = $(`script[type="text/javascript"]`);
        for (let i = 0; i < ScriptItems.length(); i++) {
            const ScriptContent = ScriptItems.eq(i).html();
            if (ScriptContent) {
                const PlayerContent = DecodeHtml(ScriptContent).split("player.src([")[1]?.split("]),")[0];
                if (PlayerContent) {
                    const videoUrl = PlayerContent.split(",")[0]?.split(":")[1]?.trim().replace(/['"]/g, "");

                    if (videoUrl) {
                        // CANNOT FIND A WAY TO GET VIDEO QUALITY
                        videos.push({
                            url: `https://video.sibnet.ru${videoUrl}`,
                            type: "mp4",
                            quality: "(sibnet) 720p",
                            subtitles: []
                        });
                    }
                }
            }
        }

        return <EpisodeServer>{
            server: ToonAnimeServer.SIBNET,
            headers: headers,
            videoSources: videos
        };
    }

    async FetchUrlVidCDN(url?: string): Promise<EpisodeServer> {
        return <EpisodeServer>{
            server: ToonAnimeServer.VIDCDN,
            headers: {
                Referer: url,
            },
            videoSources: []
        };
    }

    async FetchUrlCDN1(url?: string): Promise<EpisodeServer> {
        return <EpisodeServer>{
            server: ToonAnimeServer.CDN1,
            headers: {
                Referer: url,
            },
            videoSources: []
        };
    }

    async FetchUrlVidM(url: string): Promise<EpisodeServer> {
        const req = await fetch(url);
        const html = await req.text();
        const $ = LoadDoc(html);

        const Scripts = $("script[type='text/javascript']");
        const videos: VideoSource[] = [];

        for (let i = 0; i < Scripts.length(); i++) {
            const ScriptContent = Scripts.eq(i).html();
            if (ScriptContent) {
                const PlayerContent = DecodeHtml(ScriptContent).split("player.setup(")[1]?.split(");")[0];
                if (PlayerContent) {
                    const fileSources = PlayerContent.split('"file":"')[1]?.split('"')[0];
                    const req2 = await fetch(fileSources);
                    const m3u8 = await req2.text();

                    let qual = "";
                    let m = "";

                    m3u8.split("\n").forEach(line => {
                        if (line.startsWith("#EXT-X-STREAM-INF")) {
                            qual = line.split("RESOLUTION=")[1]?.split(",")[0] || "unknown";
                            const width = parseInt(qual.split("x")[0]) || 0;

                            if (width >= 1920) {
                                qual = "1080p";
                            } else if (width >= 1280) {
                                qual = "720p";
                            } else if (width >= 640) {
                                qual = "480p";
                            } else if (width >= 320) {
                                qual = "360p";
                            } else {
                                qual = "unknown";
                            }
                        }
                        else if (line.startsWith("http")) {
                            m = line;
                        }

                        if (m && qual) {
                            videos.push({
                                url: m,
                                type: "m3u8",
                                quality: `(${ToonAnimeServer.VIDM}) ${qual}`,
                                subtitles: []
                            })
                            m = "";
                            qual = "";
                        }
                    });
                    break;
                }
            }
        }
        return <EpisodeServer>{
            server: ToonAnimeServer.VIDM,
            headers: {
                Referer: url,
            },
            videoSources: videos,
        };
    }
    //#endregion

    private readonly SEARCH_URL = "https://api2.toonanime.biz/filter?";
    private readonly BASE_URL = "https://www.toonanime.biz/";

    getSettings(): Settings {
        return {
            episodeServers: [ToonAnimeServer.SIBNET, ToonAnimeServer.VIDCDN, ToonAnimeServer.CDN1, ToonAnimeServer.VIDM],
            supportsDub: true,
        };
    }

    async search(opts: SearchOptions): Promise<SearchResult[]> {
        const params = new URLSearchParams({
            keyword: opts.query,
            cat: opts.dub ? "Anime VF" : "Anime VOSTFR",
            status: "all",
            genre: "",
            order: "default",
            year: "all",
            limit: "21"
        });
        const url = this.SEARCH_URL + params.toString();

        const req = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
            }
        });

        if (!req.ok) {
            throw new Error(`Request failed with status ${req.status}`);
        }

        const data = (await req.json()) as ToonAnimeSearchResult;
        const results: SearchResult[] = [];

        data.data.forEach(element => {
            if (opts.dub) {
                // FIND DUB VERSION
                results.push({
                    id: `${element.categorie_url}/${element.url}{${element.current_episode}}`,
                    title: element.title,
                    url: element.url,
                    subOrDub: "dub"
                });
            }
            else {
                // FIND SUB VERSION
                results.push({
                    id: `${element.categorie_url}/${element.url}{${element.current_episode}}`,
                    title: element.title,
                    url: element.url,
                    subOrDub: "sub"
                });
            }
        });
        return results;
    }

    async findEpisodes(id: string): Promise<EpisodeDetails[]> {
        // THIS IS DUMB LMAO
        const number = id.split("{")[1]?.split("}")[0];
        id = id.split("{")[0];

        const episodes: EpisodeDetails[] = [];
        // fuck it, fucking global variable doesnt work static too... tried everything i know
        const html = await fetch(this.BASE_URL + id).then(res => res.text());

        for (let i = 1; i <= (number ? parseInt(number) : 1); i++) {
            episodes.push({
                id: id,
                number: i,
                url: html,
            });
        }
        return episodes;
    }

    async findEpisodeServer(episode: EpisodeDetails, _server: string): Promise<EpisodeServer> {
        async function GetServerUrl(server: string, html: string, ep: number): Promise<string | undefined> {
            const $ = LoadDoc(html);
            const ScriptItems = $("script");

            for (let i = 0; i < ScriptItems.length(); i++) {
                const htmlScript = ScriptItems.eq(i).html();
                if (!htmlScript || !htmlScript.includes("const data = [")) continue;

                const startIdx = htmlScript.indexOf("const data = ");
                if (startIdx === -1) continue;

                const afterStart = htmlScript.slice(startIdx + 13);
                const endIdx = afterStart.indexOf("];");
                const rawData = afterStart.slice(0, endIdx !== -1 ? endIdx + 1 : undefined);

                let details: ToonAnimeEpisodesDetails[];
                try {
                    details = JSON.parse(DecodeHtml(rawData));
                } catch {
                    continue;
                }

                for (const { data } of details) {
                    const episodes = data?.post?.data?.episodeslist;
                    if (!episodes) continue;

                    const episodeEntry = episodes.find(e => e.number === ep);
                    if (!episodeEntry) continue;

                    for (const serverData of Object.values(episodeEntry.data)) {
                        if (serverData.server_name.toLowerCase() === server.toLowerCase()) {
                            return serverData.server_url;
                        }
                    }
                }
            }

            return undefined;
        }
        const url = await GetServerUrl(_server, episode.url, episode.number);
        if (!url) {
            return <EpisodeServer>{
                server: _server,
                headers: {},
                videoSources: []
            }
        }
        return await this.FetchServerHandler(url, _server);
    }
}
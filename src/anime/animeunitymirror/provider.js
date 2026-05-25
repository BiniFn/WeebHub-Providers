/// <reference path="./online-streaming-provider.d.ts" />
class Provider {
  constructor() {
    this.base = "https://animeunity.cool";
  }

  getSettings() {
    return {
      episodeServers: ["AnimeUnity"],
      supportsDub: false,
    };
  }

  async search(query) {
    const res = await fetch(`${this.base}/?s=${encodeURIComponent(query.query)}`);
    const html = await res.text();

    const results = [];

    // Extract each <article class="bs"> block
    const articleRegex = /<article[^>]+class="bs"[^>]*>([\s\S]*?)<\/article>/g;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(html)) !== null) {
      const block = articleMatch[1];

      // href and title can be in single or double quotes, attribute order may vary
      const hrefMatch = block.match(/href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/);
      if (!hrefMatch) continue;

      const url = hrefMatch[1];
      const title = hrefMatch[2];

      const slugMatch = url.match(/\/anime\/([^/?#]+)\/?/);
      if (!slugMatch) continue;

      const id = slugMatch[1];
      results.push({
        id,
        title,
        url,
        subOrDub: "sub",
      });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    const res = await fetch(`${this.base}/anime/${id}/`);
    const html = await res.text();

    const episodes = [];

    // Match each <li data-index="N"> block
    const liRegex = /<li[^>]+data-index="\d+"[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;

    while ((liMatch = liRegex.exec(html)) !== null) {
      const block = liMatch[1];

      const hrefMatch = block.match(/href=["']([^"']+)["']/);
      const numMatch = block.match(/<div[^>]+class="epl-num"[^>]*>(\d+)<\/div>/);
      const titleMatch = block.match(/<div[^>]+class="epl-title"[^>]*>([^<]*)<\/div>/);

      if (!hrefMatch || !numMatch) continue;

      const url = hrefMatch[1];
      const number = parseInt(numMatch[1], 10);
      const title = titleMatch ? titleMatch[1].trim() : `Episode ${number}`;

      const slugMatch = url.match(/\/([^/?#]+)\/?$/);
      const epId = slugMatch ? slugMatch[1] : url;

      episodes.push({
        id: epId,
        title,
        number,
        url,
      });
    }

    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, _server) {
    const episodeUrl = episode.url.startsWith("http")
      ? episode.url
      : `${this.base}${episode.url.startsWith("/") ? "" : "/"}${episode.url}`;

    const res = await fetch(episodeUrl, {
      headers: {
        Referer: this.base,
      },
    });
    const html = await res.text();

    // Match any <source> tag regardless of type, capture both src and type
    const sourceMatch =
      html.match(/<source[^>]+src=["']([^"']+)["'][^>]*type=["']([^"']+)["']/i) ||
      html.match(/<source[^>]+type=["']([^"']+)["'][^>]*src=["']([^"']+)["']/i);

    if (!sourceMatch) throw new Error("Video source not found");

    // Attribute order differs between the two regex branches — normalise
    let srcAttr, mimeType;
    if (/^https?:\/\/|^\//.test(sourceMatch[1])) {
      // First branch: src first, type second
      srcAttr = sourceMatch[1];
      mimeType = sourceMatch[2];
    } else {
      // Second branch: type first, src second
      mimeType = sourceMatch[1];
      srcAttr = sourceMatch[2];
    }

    // Resolve relative paths
    if (srcAttr.startsWith("/")) {
      srcAttr = `${this.base}${srcAttr}`;
    }

    // Normalize /proxy?url= → /proxy/?url=
    srcAttr = srcAttr.replace(/\/proxy\?url=/, "/proxy/?url=");

    // Determine stream type from MIME type
    const isHls =
      /mpegURL|mpegurl|x-mpegURL|vnd\.apple\.mpegurl/i.test(mimeType) ||
      srcAttr.includes(".m3u8");
    const streamType = isHls ? "m3u8" : "mp4";

    return {
      server: "AnimeUnity",
      headers: {
        Referer: `${this.base}/`,
        Origin: this.base,
      },
      videoSources: [
        {
          url: srcAttr,
          quality: "auto",
          type: streamType,
          subtitles: [],
        },
      ],
    };
  }
}

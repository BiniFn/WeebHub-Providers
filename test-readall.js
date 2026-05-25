const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
async function test() {
  const html = await fetch(proxyUrl('https://readallcomics.com/?story=kick+ass&s=&do=search&subaction=search')).then(r=>r.text());
  const results = [];
  
  // Custom regex to extract from readallcomics.com
  const regex = /<img.*?src="([^"]+)".*?alt="([^"]+)".*?<a href="([^"]+)"/gi;
  let match;
  while((match = regex.exec(html)) !== null) {
     results.push({img: match[1], title: match[2], url: match[3]});
  }
  
  if (results.length === 0) {
     // alternate regex
     const regex2 = /<div class="pin">.*?<a href="([^"]+)".*?<img src="([^"]+)" alt="([^"]+)"/gi;
     while((match = regex2.exec(html)) !== null) {
        results.push({url: match[1], img: match[2], title: match[3]});
     }
  }

  // list-story format
  if (results.length === 0) {
      const items = html.split('<ul class="list-story">')[1]?.split('</ul>')[0];
      if (items) {
          const itemRegex = /<img src="([^"]+)".*?<a href="([^"]+)" title="([^"]+)">/gi;
          while((match = itemRegex.exec(items)) !== null) {
             results.push({img: match[1], url: match[2], title: match[3]});
          }
      }
  }

  console.log(results.slice(0, 3));
}
test();

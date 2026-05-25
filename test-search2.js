const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
fetch(proxyUrl('https://comicextra.org/comic-search?key=kick+ass'))
  .then(res => res.text())
  .then(html => console.log(html.substring(0, 500)))
  .catch(console.error);

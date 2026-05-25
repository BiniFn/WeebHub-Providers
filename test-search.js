const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
fetch(proxyUrl('https://batcave.biz/search?q=kick+ass'))
  .then(res => res.text())
  .then(html => console.log(html.substring(0, 500)))
  .catch(console.error);

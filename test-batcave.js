const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
fetch(proxyUrl('https://batcave.biz'))
  .then(res => res.text())
  .then(html => console.log(html.substring(0, 1000)))
  .catch(console.error);

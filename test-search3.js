const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
fetch(proxyUrl('https://readallcomics.com/?story=kick+ass&s=&do=search&subaction=search'))
  .then(res => res.text())
  .then(html => console.log(html.substring(0, 500)))
  .catch(console.error);

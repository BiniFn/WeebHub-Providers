const fs = require('fs');
async function test() {
  const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
  const html = await fetch(proxyUrl('https://readallcomics.com/?story=kick+ass&s=&do=search&subaction=search')).then(r=>r.text());
  fs.writeFileSync('readall.html', html);
  console.log("Saved readall.html");
}
test();

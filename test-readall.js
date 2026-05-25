const proxyUrl = url => `http://localhost:43211/api/v1/proxy?url=${encodeURIComponent(url)}`;
async function test() {
  const searchHtml = await fetch(proxyUrl('https://readallcomics.com/?story=kick+ass&s=&do=search&subaction=search')).then(r=>r.text());
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const dom = new JSDOM(searchHtml);
  const results = [];
  dom.window.document.querySelectorAll('ul.list-story li').forEach(el => {
    const a = el.querySelector('a');
    const img = el.querySelector('img');
    if(a && img) {
       results.push({
         title: a.getAttribute('title') || a.textContent.trim(),
         url: a.getAttribute('href'),
         image: img.getAttribute('src')
       });
    }
  });
  console.log(results);
}
test();

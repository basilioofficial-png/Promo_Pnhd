// Run with Node.js and Playwright installed: node tests/artwork.smoke.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  try {
    const target = file === root ? path.join(root, 'index.html') : file;
    const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff':'font/woff'};
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    res.end(await fs.readFile(target));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The feature must work with external requests disabled.
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    async function fixture(colors, type = 'image/png') {
      return Buffer.from(await page.evaluate(({colors, type}) => {
        const c = document.createElement('canvas'); c.width = 240; c.height = 120;
        const ctx = c.getContext('2d');
        colors.forEach((color, i) => {if(color) {ctx.fillStyle=color;ctx.fillRect(i * 240 / colors.length,0,240 / colors.length,120);}});
        return c.toDataURL(type).split(',')[1];
      }, {colors, type}), 'base64');
    }
    async function upload(buffer, name = 'logo.png', mimeType = 'image/png') {
      await page.locator('#artwork-file').setInputFiles({name,mimeType,buffer});
      await page.waitForFunction(() => !document.getElementById('artwork-status').hasAttribute('aria-busy'));
    }
    const redBlack = await fixture(['#ff0000','#000000',null]);
    await upload(redBlack, '<logo>.png');
    assert.equal(await page.evaluate(() => artwork.count),2);
    assert.equal(await page.locator('#artwork-name').textContent(),'<logo>.png');
    assert.equal(await page.locator('#artwork-file').evaluate(e=>e.files[0].name),'<logo>.png');
    assert.equal(await page.evaluate(() => state.inks),1,'estimate must not change price before confirmation');
    await page.locator('#artwork-apply').click();
    assert.equal(await page.evaluate(() => state.inks),2);
    assert.equal(await page.evaluate(() => quote(state).total),491400);
    await page.locator('#review').click();
    assert((await page.locator('#order-summary').textContent()).includes('<logo>.png'));
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    assert.equal(download.suggestedFilename(),'PNHD-configuration.txt');
    const text = await fs.readFile(await download.path(),'utf8');
    assert(text.includes('Оценка цветов: 2'));assert(text.includes('Файл нужно передать отдельно'));
    await page.locator('#order-dialog .close').click();
    await upload(await fixture(['#ff0000','#ffffff']));
    assert.equal(await page.evaluate(() => artwork.count),2);
    await page.locator('#artwork-ignore-white').check();
    assert.equal(await page.evaluate(() => artwork.count),1);
    await page.locator('#artwork-remove').click();assert.equal(await page.evaluate(() => artwork),null);
    await upload(await fixture([null]));assert.equal(await page.evaluate(() => artwork.count),0);
    assert(await page.locator('#artwork-apply').isHidden());
    const many = Array.from({length:12},(_,i)=>`hsl(${i*30},100%,50%)`);
    await upload(await fixture(many));assert((await page.evaluate(() => artwork.count))>8);
    assert(await page.locator('#artwork-apply').isDisabled());
    const three = await fixture(['red','blue','black']);await upload(three);
    await page.locator('.print-settings').evaluate(e => e.open=true);
    await page.locator('#format').selectOption({label:'Ручник 47 × 65см'});
    assert(await page.locator('#artwork-apply').isDisabled());
    await page.locator('#format').selectOption({index:0});assert(await page.locator('#artwork-apply').isEnabled());
    await page.locator('#artwork-apply').click();assert.equal(await page.evaluate(()=>state.inks),3);
    await upload(await fixture(['red','black'],'image/jpeg'),'logo.jpg','image/jpeg');
    assert.equal(await page.evaluate(()=>artwork.count),2,'JPEG artifacts must not add ink colors');
    await upload(await fixture(['red','black'],'image/webp'),'logo.webp','image/webp');
    assert.equal(await page.evaluate(()=>artwork.count),2);
    await upload(Buffer.from('broken png'));assert(await page.locator('#artwork-status').evaluate(e=>e.classList.contains('error')));
    assert.equal(await page.evaluate(()=>artwork),null);
    await upload(Buffer.alloc(20*1024*1024+1),'large.png');assert((await page.locator('#artwork-status').textContent()).includes('20 МБ'));
    await upload(Buffer.from('%PDF-1.4'),'print.pdf','application/pdf');assert((await page.locator('#artwork-status').textContent()).includes('PDF'));
    // A slow earlier decode must not overwrite the most recently selected file.
    await page.evaluate(() => {const decode=window.createImageBitmap;window.createImageBitmap=async file=>{if(file.name==='slow.png')await new Promise(r=>setTimeout(r,300));return decode(file);};});
    await page.locator('#artwork-file').setInputFiles({name:'slow.png',mimeType:'image/png',buffer:redBlack});
    await upload(three,'latest.png');await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>artwork.name),'latest.png');assert.equal(await page.evaluate(()=>artwork.count),3);
    for(const width of [320,390,1440]) {
      await page.setViewportSize({width,height:900});
      assert(await page.locator('#artwork-file').isVisible());
      assert(await page.locator('.artwork').evaluate(e=>e.scrollWidth<=e.clientWidth));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: PNG/JPEG/WebP, transparency, white background, palette limits, quote/export, corrupt/oversize/unsupported files, replacement race, 3 screen widths; no JS errors.');
  } finally {await browser?.close();server.close();}
})().catch(error => {console.error(error);process.exitCode=1;server.close();});

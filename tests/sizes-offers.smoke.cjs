// Run with Node.js and Playwright installed: node tests/sizes-offers.smoke.cjs
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
    const rows = [
      ['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'],
      ['XS','S','M','L','XL','2XL','3XL'],
      ['XXS','XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'],
      ['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'],
      ['S','M','L','XL','2XL','3XL','4XL'],
      ['XS–S','M–L','XL–2XL'],['XS–S','M–L','XL–2XL'],
      ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
      ['XS','S','M','L','XL','2XL','3XL'],
      ['XS–S','M–L','XL–2XL'],
      ['XS–S','M–L','XL–2XL','3XL–4XL'],
      ['XS–S','M–L','XL–2XL','3XL–4XL'],
      ['XS–S','M–L','XL–2XL','3XL–4XL']
    ];
    assert((await page.locator('h1').textContent()).includes('Футболки с нанесением'));
    assert((await page.locator('#hero-price').textContent()).includes('464,40'));
    assert.equal(await page.evaluate(()=>quote(state).total),464400);
    assert(await page.locator('#plus').isDisabled());
    for(let i=0;i<rows.length;i++) {
      await page.locator('#model').selectOption(String(i));
      assert.deepEqual(await page.locator('[data-size]').evaluateAll(xs=>xs.map(x=>x.dataset.size)),rows[i]);
      assert.deepEqual(await page.locator('[data-size]').evaluateAll(xs=>xs.map(x=>Number(x.max))),rows[i].map(()=>100));
      await page.locator('#quantity').fill(String(rows[i].length*100));
      assert(await page.locator('#review').isEnabled());
      assert((await page.locator('[data-size]').evaluateAll(xs=>xs.map(x=>Number(x.value)))).every(x=>x===100));
      await page.locator('#quantity').fill(String(rows[i].length*100+1));
      assert(await page.locator('#review').isDisabled());assert.equal(await page.locator('#total').textContent(),'—');
      await page.locator('#quantity').fill('50');
      assert.equal(await page.locator('[data-size]').evaluateAll(xs=>xs.reduce((sum,x)=>sum+Number(x.value),0)),50);
      assert(await page.locator('#review').isEnabled());
    }
    await page.locator('#model').selectOption('0');
    await page.locator('#swatches button[title="Белый"]').click();
    await page.locator('#quantity').fill('0');
    const xs=page.locator('[data-size="XS"]'), small=page.locator('[data-size="S"]');
    await xs.fill('10');assert(await page.locator('#review').isDisabled());
    await small.fill('40');assert.equal(await page.locator('#quantity').inputValue(),'50');
    assert.equal(await page.evaluate(()=>quote(state).total),37000);
    await xs.fill('101');assert(await page.locator('#review').isDisabled());assert.equal(await xs.getAttribute('aria-invalid'),'true');
    assert((await page.locator('#quantity-error').textContent()).includes('доступно 100'));
    await xs.fill('-1');assert(await page.locator('#review').isDisabled());
    await xs.fill('10.5');assert(await page.locator('#review').isDisabled());
    await xs.fill('10');assert(await page.locator('#review').isEnabled());
    await page.locator('#model').selectOption('5');
    assert.equal(await page.locator('#quantity').inputValue(),'50');
    assert(await page.locator('.presets button').filter({hasText:/^500$/}).isDisabled());
    await page.locator('[data-size="XS–S"]').fill('25');
    const otherModel=await page.locator('#quantity').inputValue();
    await page.locator('#model').selectOption('0');
    assert.equal(await xs.inputValue(),'10');assert.equal(await small.inputValue(),'40');
    await page.locator('#model').selectOption('5');assert.equal(await page.locator('#quantity').inputValue(),otherModel);
    await page.locator('#model').selectOption('0');
    await page.locator('#swatches button').first().click();
    assert.equal(await xs.inputValue(),'10');assert.equal(await page.evaluate(()=>quote(state).total),38920);
    await page.locator('#review').click();
    assert((await page.locator('#order-summary').textContent()).includes('Размеры: XS: 10 шт., S: 40 шт.'));
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
    const saved=await fs.readFile(await download.path(),'utf8');assert(saved.includes('Размеры: XS: 10 шт., S: 40 шт.'));
    await page.locator('#order-dialog .close').click();
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.locator('#hero').evaluate(e=>e.scrollWidth<=e.clientWidth));
      assert(await page.locator('#size-grid').evaluate(e=>e.scrollWidth<=e.clientWidth));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(width===1440) await page.locator('#hero').screenshot({path:'/tmp/pnhd-promo-hero-desktop.png'});
      if(width===390) {
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:'/tmp/pnhd-promo-hero-mobile.png'});
        await page.locator('#size-grid').screenshot({path:'/tmp/pnhd-sizes-mobile.png'});
      }
    }
    await page.locator('#size-clear').click();
    assert.equal(await page.locator('#quantity').inputValue(),'0');
    assert((await page.locator('[data-size]').evaluateAll(xs=>xs.map(x=>Number(x.value)))).every(x=>x===0));
    assert(await page.locator('#review').isDisabled());
    for(const [offer,heading] of Object.entries({price:'Футболки с нанесением',batch:'Мерч от 50 изделий',deadline:'Изготовление от 5 дней',team:'с вашим логотипом',quality:'13 моделей одежды',unknown:'Футболки с нанесением',['__proto__']:'Футболки с нанесением'})) {
      await page.goto(`http://127.0.0.1:${server.address().port}/?offer=${offer}`);
      assert((await page.locator('h1').textContent()).includes(heading));
      assert((await page.locator('#hero-description').textContent()).includes('1000 шт.'));
      assert.equal(await page.evaluate(()=>quote(state).total),464400);
      assert.equal(await page.locator('#hero-price').count(),1);
      assert(await page.locator('#hero-price').isVisible());
      for(const width of [320,414,760,1024,1440]) {
        await page.setViewportSize({width,height:900});
        assert(await page.locator('#hero').evaluate(e=>e.scrollWidth<=e.clientWidth),`offer ${offer} overflows at ${width}`);
        assert(await page.locator('.hero-primary').isVisible());
      }
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: all 13 size ranges, per-size stock, total distribution and limits, size validation, per-model selections, color pricing, exported sizes, 4 layouts and 5 offers; no JS errors.');
  } finally {await browser?.close();server.close();}
})().catch(error => {console.error(error);process.exitCode=1;server.close();});

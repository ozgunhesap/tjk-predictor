import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function test() {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.tjk.org', { waitUntil: 'domcontentloaded' });
    
    console.log("Creating and submitting form via Evaluate...");
    await page.evaluate(() => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/TR/YarisSever/Info/Sehir/GunlukYarisProgrami';
        
        const sehirId = document.createElement('input');
        sehirId.type = 'hidden';
        sehirId.name = 'SehirId';
        sehirId.value = '3';
        
        const tarih = document.createElement('input');
        tarih.type = 'hidden';
        tarih.name = 'QueryParameter_Tarih';
        tarih.value = '21/02/2026';
        
        const era = document.createElement('input');
        era.type = 'hidden';
        era.name = 'Era';
        era.value = 'today';
        
        form.appendChild(sehirId);
        form.appendChild(tarih);
        form.appendChild(era);
        
        document.body.appendChild(form);
        form.submit();
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    await page.screenshot({ path: 'tjk_post_submit.png' });
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    console.log("Races tabs found:", $('ul[class*="races-tabs"]').length);
    console.log("Links found:", $('ul[class*="races-tabs"] > li > h3.race-no > a').length);
    
    await browser.close();
}
test().catch(console.error);

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function test() {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({
        headless: true
    });
    
    const page = await browser.newPage();
    console.log("Navigating to home page...");
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.tjk.org', { waitUntil: 'networkidle2' });
    
    console.log("Waiting for and clicking KVKK Consent...");
    try {
        await page.waitForSelector('text/Tümünü Kabul Et', { timeout: 3000 });
        const button = await page.$('text/Tümünü Kabul Et');
        if (button) await button.click();
        await new Promise(r => setTimeout(r, 1000));
    } catch(e) {
        console.log("KVKK Accept button not found.");
    }
    
    console.log("Navigating to program page...");
    await page.goto('https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=3&QueryParameter_Tarih=21/02/2026&Era=today', { waitUntil: 'networkidle2' });
    
    await page.screenshot({ path: 'tjk_istanbul_page.png' });
    console.log("Saved screenshot to tjk_istanbul_page.png");
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    console.log("Races tabs found:", $('ul[class*="races-tabs"]').length);
    console.log("Links found:", $('ul[class*="races-tabs"] > li > h3.race-no > a').length);
    
    await browser.close();
}
test().catch(console.error);

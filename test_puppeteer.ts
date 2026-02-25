import puppeteer from 'puppeteer';

async function test() {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({
        headless: true
    });
    
    const page = await browser.newPage();
    console.log("Navigating...");
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=3&QueryParameter_Tarih=21/02/2026&Era=today', { waitUntil: 'networkidle2' });
    
    // Screenshot it
    await page.screenshot({ path: 'tjk_page.png' });
    console.log("Saved screenshot to tjk_page.png");
    
    await browser.close();
}
test().catch(console.error);

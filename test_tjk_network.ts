import puppeteer from 'puppeteer';

async function test() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('SatisFormu') || request.url().includes('jpg') || request.url().includes('png') || request.url().includes('css')) {
            request.abort();
        } else {
            request.continue();
        }
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('GunlukYarisProgrami') || url.includes('Sehir')) {
            console.log("Response from:", url, "Status:", response.status());
            if (response.status() === 200) {
                try {
                    const text = await response.text();
                    console.log("Length of response:", text.length, "includes 223288?", text.includes('223288'));
                } catch(e) {}
            }
        }
    });

    console.log("Navigating...");
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami', { waitUntil: 'networkidle2' });
    
    // simulate clicking a city tab
    console.log("Clicking city Istanbul...");
    try {
        await page.click('a[data-sehir-id="3"]');
        await new Promise(r => setTimeout(r, 3000));
    } catch(e) { console.log("Could not click city"); }

    await browser.close();
}
test();

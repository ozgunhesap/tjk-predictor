const axios = require('axios');
const cheerio = require('cheerio');

async function testHistory() {
    try {
        const urlP = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=1&SehirAdi=%C4%B0stanbul&QueryParameter_Tarih=22/02/2026&Era=today';
        const { data: pData } = await axios.get(urlP, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $p = cheerio.load(pData);
        const horseIdMatch = $p('a[href*="QueryParameter_AtId="]').first().attr('href').match(/AtId=(\d+)/);
        const horseId = horseIdMatch[1];

        const url = `https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${horseId}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' } });
        const safeData = `<table>${data}</table>`;
        const $ = cheerio.load(safeData);

        const headers = [];
        $('th').each((i, el) => {
            const h = $(el).text().trim().replace(/\s+/g, ' ');
            if (h && h !== '...' && headers.indexOf(h) === -1) {
                headers.push(h);
            }
        });

        console.log("Unique Headers:");
        headers.forEach((h, i) => console.log(`${i}: ${h}`));

    } catch (e) {
        console.error(e.message);
    }
}
testHistory();

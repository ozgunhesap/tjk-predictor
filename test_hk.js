const axios = require('axios');
const cheerio = require('cheerio');

async function checkCols() {
    try {
        const url = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=1&SehirAdi=%C4%B0stanbul&QueryParameter_Tarih=22/02/2026&Era=today';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const $ = cheerio.load(data);
        const tds = $('table.tablesorter tbody tr').first().find('td');
        tds.each((i, el) => {
            console.log(`Column ${i}: ${$(el).text().trim().replace(/\\n/g, '')}`);
        });

        // Try getting past race columns for Pace logic
        const performHref = $('a[href*="QueryParameter_KosuId"]').first().attr('href');
        console.log("Found past race link:", performHref);
    } catch (e) {
        console.error(e.message);
    }
}
checkCols();

const axios = require('axios');
const cheerio = require('cheerio');

async function testResults() {
    try {
        const url = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari?SehirId=1&SehirAdi=%C4%B0stanbul&QueryParameter_Tarih=21/02/2026';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const $ = cheerio.load(data);
        $('table.sonuclar-tablosu').each((i, table) => {
            console.log("Table " + i + " classes:", $(table).attr('class'));
            const text = $(table).find('tr').first().text().replace(/\s+/g, ' ');
            console.log("Table " + i + " First Row:", text);
            const secondRow = $(table).find('tr').eq(1).text().replace(/\s+/g, ' ');
            console.log("Table " + i + " Second Row:", secondRow);
        });

    } catch (e) {
        console.error(e.message);
    }
}
testResults();

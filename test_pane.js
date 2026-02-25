const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=2&SehirAdi=%C4%B0zmir&QueryParameter_Tarih=19/02/2026&Era=today', { headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' } }).then(r => {
    const $ = cheerio.load(r.data);
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const match = bodyText.match(/([0-9]{3,4})\s*(Kum|Çim|Sentetik)/ig);
    console.log('Matches found on whole page:', match);
});

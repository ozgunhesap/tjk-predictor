import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=3&QueryParameter_Tarih=21/02/2026&Era=today';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    console.log("Found links:", $('ul[class*="races-tabs"] > li > h3.race-no > a').length);
    $('ul[class*="races-tabs"] > li > h3.race-no > a').each((_, el) => {
        console.log("Link:", $(el).attr('href'), $(el).text().trim().replace(/\n+/g, ' '));
    });
}
test();

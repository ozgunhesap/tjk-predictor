import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('sg_cond2.html', 'utf8');
const $ = cheerio.load(data);
$('td.pist').each((i, td) => {
    console.log("Pist td:", $(td).text().trim());
});
$('div').each((i, div) => {
   if($(div).attr('class')?.includes('pist') || $(div).attr('id')?.includes('pist')) {
       console.log("Pist div:", $(div).text().trim());
   }
});

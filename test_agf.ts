import * as cheerio from 'cheerio';
import * as fs from 'fs';
import axios from 'axios';

axios.get("https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=2&SehirAdi=%C4%B0zmir&QueryParameter_Tarih=22%2F02%2F2026&Era=today", {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
})
.then(res => {
    const $ = cheerio.load(res.data);
    // Find the first race table
    const firstTable = $('table.tablesorter').first();
    console.log("Headers:");
    firstTable.find('th').each((i, th) => console.log(`TH ${i}: ` + $(th).text().trim()));
    
    console.log("\nFirst Row:");
    firstTable.find('tbody tr').first().find('td').each((i, td) => console.log(`TD ${i}: ` + $(td).text().trim()));
});

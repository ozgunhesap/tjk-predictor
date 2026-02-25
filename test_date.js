const parseDateStr = (dStr) => {
    if (!dStr) return 0;
    const pts = dStr.split(/[\/\.]/);
    if (pts.length === 3) {
        return new Date(parseInt(pts[2]), parseInt(pts[1]) - 1, parseInt(pts[0])).getTime();
    }
    return 0;
};

const target = "19/02/2026";
const targetMs = parseDateStr(target);

const historyDates = ["21.02.2026", "20.02.2026", "19.02.2026", "18.02.2026", "05.01.2026"];

console.log("Target MS:", targetMs);
for (const hd of historyDates) {
    const hMs = parseDateStr(hd);
    console.log(`${hd} (${hMs}) >= ${target} ?`, hMs >= targetMs);
}

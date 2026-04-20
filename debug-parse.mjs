import fs from 'fs';

const sql = fs.readFileSync(new URL('./seed.sql', import.meta.url), 'utf8');

function splitRows(str) {
  const rows = [];
  let depth = 0, start = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(' && depth === 0) { depth = 1; start = i; }
    else if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) { rows.push(str.slice(start, i + 1)); }
    }
  }
  return rows;
}

function parseRow(rowStr) {
  const inner = rowStr.slice(1, -1);
  const values = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "'") {
      let j = i + 1, val = '';
      while (j < inner.length) {
        if (inner[j] === '\\' && inner[j+1] === "'") { val += "'"; j += 2; }
        else if (inner[j] === "'" && inner[j+1] === "'") { val += "'"; j += 2; }
        else if (inner[j] === "'") { j++; break; }
        else { val += inner[j++]; }
      }
      values.push(val);
      i = j;
      if (inner[i] === ',') i++;
    } else {
      const end = inner.indexOf(',', i);
      const raw = end === -1 ? inner.slice(i) : inner.slice(i, end);
      values.push(raw === 'NULL' ? null : isNaN(raw) ? raw : Number(raw));
      i = end === -1 ? inner.length : end + 1;
    }
  }
  return values;
}

const re = /INSERT INTO `resources` VALUES ([^;]+);/g;
let m = re.exec(sql);
const rows = splitRows(m[1]);
console.log('Total rows:', rows.length);

const counts = {};
for (const r of rows) {
  const v = parseRow(r);
  const sid = v[1];
  counts[sid] = (counts[sid]||0)+1;
}
console.log('By subject_id:', counts);

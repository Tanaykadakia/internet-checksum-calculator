// Run with: node tests/test.js   (uses the same script.js as the website)
const c = require("./script.js");
let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + " -> " + info); }
}
const b = (s) => parseInt(s, 2);

// Independent reference (RFC 1071 style): sum in a big total, fold carries, invert
function reference(words) {
  let total = 0;
  for (const w of words) total += b(w);
  while (total >> 16) total = (total & 0xFFFF) + (total >> 16);
  return (~total) & 0xFFFF;
}

// 1. one valid word
let r = c.generateChecksum(["1010101010101010"]);
check("T1 single word checksum", c.toBinary16(r.checksum) === "0101010101010101", c.toBinary16(r.checksum));
check("T1 hex", c.toHex16(r.checksum) === "5555", c.toHex16(r.checksum));

// 2. multiple words (no carry): 0001 + 0002 + 0003 = 0006 -> FFF9
r = c.generateChecksum(["0000000000000001", "0000000000000010", "0000000000000011"]);
check("T2 multiple words, no carry", c.toBinary16(r.finalSum) === "0000000000000110" && c.toBinary16(r.checksum) === "1111111111111001" && r.steps.every(s => s.carries === 0), c.toHex16(r.finalSum) + " " + c.toHex16(r.checksum));

// 3. end-around carry: FFFF + 0001 = 10000 -> 0000 + 1 = 0001
let a = c.onesComplementAdd(0xFFFF, 0x0001);
check("T3 end-around carry FFFF+0001", a.result === 1 && a.carries === 1 && a.rawSum === 0x10000, JSON.stringify(a));
a = c.onesComplementAdd(0xFFFF, 0xFFFF);
check("T3 FFFF+FFFF = FFFF", a.result === 0xFFFF && a.carries === 1, JSON.stringify(a));
// the project's sample words
const sample = ["1010101010101010", "1100110011001100", "0000111100001111"];
r = c.generateChecksum(sample);
// hand check: AAAA+CCCC = 17776 -> 7776+1 = 7777 ; 7777+0F0F = 8686 ; ~8686 = 7979
check("T3 sample words sum", c.toHex16(r.finalSum) === "8686", c.toHex16(r.finalSum));
check("T3 sample words checksum", c.toHex16(r.checksum) === "7979", c.toHex16(r.checksum));
check("T3 carry recorded in step 1", r.steps[0].carries === 1 && r.steps[1].carries === 0, JSON.stringify(r.steps.map(s=>s.carries)));

// 4/5/6. validation
check("T4 'hello' rejected", c.validateWord("hello") !== "", "");
check("T4 non-binary digit rejected", c.validateWord("1010101010101012") !== "", "");
check("T5 short rejected", c.validateWord("101010").includes("short"), c.validateWord("101010"));
check("T6 long rejected", c.validateWord("10101010101010101").includes("long"), c.validateWord("10101010101010101"));
check("T6 empty rejected", c.validateWord("") !== "", "");
check("valid word accepted", c.validateWord("1010101010101010") === "", "");

// 7. verification valid
let v = c.verifyChecksum(sample, c.toBinary16(r.checksum));
check("T7 verify valid", v.valid === true && v.finalSum === 0xFFFF, c.toHex16(v.finalSum));

// 8. one bit flipped in data
const bad = ["1010101010101011", sample[1], sample[2]];
v = c.verifyChecksum(bad, c.toBinary16(r.checksum));
check("T8 verify after 1-bit change is invalid", v.valid === false, c.toHex16(v.finalSum));
// one bit flipped in checksum
v = c.verifyChecksum(sample, "0111100101111000");
check("T8b flipped checksum bit invalid", v.valid === false, "");

// onesComplement
check("ones complement of 0000 is FFFF", c.onesComplement(0) === 0xFFFF, "");
check("ones complement of FFFF is 0000", c.onesComplement(0xFFFF) === 0, "");

// randomized cross-check against reference + verify roundtrip
let ok = true;
for (let i = 0; i < 20000; i++) {
  const n = 1 + Math.floor(Math.random() * 8);
  const ws = [];
  for (let j = 0; j < n; j++) ws.push(c.toBinary16(Math.floor(Math.random() * 65536)));
  const got = c.generateChecksum(ws).checksum;
  if (got !== reference(ws)) { ok = false; console.log("mismatch", ws); break; }
  if (!c.verifyChecksum(ws, c.toBinary16(got)).valid) { ok = false; console.log("verify fail", ws); break; }
}
check("20000 random cases match reference and verify", ok, "");

// text input (ASCII, 2 chars per word, odd length padded with zero byte)
let tw = c.textToWords("Hi");
check("TX1 'Hi' -> 0100100001101001", tw.words.length === 1 && tw.words[0] === "0100100001101001", JSON.stringify(tw));
tw = c.textToWords("Hello");
check("TX2 'Hello' -> 3 words, last padded", tw.words.join(",") === "0100100001100101,0110110001101100,0110111100000000" && tw.pairs[2].padded === true, JSON.stringify(tw));
r = c.generateChecksum(tw.words);
check("TX3 'Hello' sum 23D2, checksum DC2D", c.toHex16(r.finalSum) === "23D2" && c.toHex16(r.checksum) === "DC2D", c.toHex16(r.finalSum) + " " + c.toHex16(r.checksum));
check("TX4 verify 'Hello' + checksum valid", c.verifyChecksum(tw.words, c.toBinary16(r.checksum)).valid === true, "");
check("TX5 empty text rejected", c.textToWords("").error !== "", "");
check("TX6 non-Latin-1 character rejected", c.textToWords("a\u20AC").error !== "", "");
check("TX7 every produced word is valid", c.textToWords("Internet Checksum!").words.every(w => c.validateWord(w) === ""), "");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

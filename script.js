/* =====================================================
   Internet Checksum Calculator - script.js
   Based on RFC 1071 (16-bit one's complement checksum)

   Part 1-5: the checksum logic (no page code, can be tested in Node)
   Part 6-9: showing the working on the page
   ===================================================== */

/* ---------- 1. Helper functions ---------- */

// Check that a string is exactly 16 characters of 0 and 1.
// Returns an error message, or "" if the word is fine.
function validateWord(word) {
  if (word.length === 0) return "Field is empty.";
  if (!/^[01]+$/.test(word)) return "Only 0 and 1 are allowed.";
  if (word.length < 16) return "Too short: " + word.length + " bits (need exactly 16).";
  if (word.length > 16) return "Too long: " + word.length + " bits (need exactly 16).";
  return "";
}

// Convert a number to a 16-bit binary string (pads with leading zeros).
function toBinary16(num) {
  return num.toString(2).padStart(16, "0");
}

// Convert a number to a 4-digit hex string.
function toHex16(num) {
  return num.toString(16).toUpperCase().padStart(4, "0");
}

// Turns text into 16-bit words. Each character = 8 bits (its character code).
// Two characters make one word (first character = high byte).
// If the number of characters is odd, the last byte is padded with 00000000 (RFC 1071).
// Returns { words: [...], pairs: [{chars, padded}], error }.
function textToWords(text) {
  if (text.length === 0) return { words: [], pairs: [], error: "Type some text first." };
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 255) {
      return { words: [], pairs: [], error: "Only basic characters are supported (letters, digits, symbols). Remove \"" + text[i] + "\"." };
    }
    bytes.push(code);
  }
  const words = [];
  const pairs = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const padded = (i + 1 >= bytes.length);
    const high = bytes[i];
    const low = padded ? 0 : bytes[i + 1];
    words.push(high.toString(2).padStart(8, "0") + low.toString(2).padStart(8, "0"));
    pairs.push({ chars: text.slice(i, i + 2), padded: padded });
  }
  return { words: words, pairs: pairs, error: "" };
}

/* ---------- 2. One's complement addition ---------- */

// Adds two 16-bit numbers using one's complement addition.
// If the result goes beyond 16 bits, the carry is added back
// to the lowest bit (end-around carry).
function onesComplementAdd(a, b) {
  const rawSum = a + b;            // normal addition, can be up to 17 bits
  let result = rawSum;
  let carries = 0;                 // how many times we did end-around carry

  // while there is a bit beyond the 16th bit, wrap it around
  while (result > 0xFFFF) {
    const carry = result >> 16;    // the bits beyond 16 bits (the carry)
    const lower = result & 0xFFFF; // the lower 16 bits
    result = lower + carry;        // add carry back to the lower 16 bits
    carries++;
  }

  return { rawSum: rawSum, result: result, carries: carries };
}

/* ---------- 3. One's complement (flip bits) ---------- */

function onesComplement(num) {
  return (~num) & 0xFFFF;          // flip all 16 bits, keep only 16 bits
}

/* ---------- 4. Checksum generation ---------- */

// words = array of 16-bit binary strings (already validated)
// Returns the list of steps plus the final checksum.
function generateChecksum(words) {
  const numbers = words.map(function (w) { return parseInt(w, 2); });
  const steps = [];
  let sum = numbers[0];

  for (let i = 1; i < numbers.length; i++) {
    const r = onesComplementAdd(sum, numbers[i]);
    steps.push({
      label: (i === 1 ? "Word 1 + Word 2" : "Previous sum + Word " + (i + 1)),
      before: sum,
      added: numbers[i],
      rawSum: r.rawSum,
      result: r.result,
      carries: r.carries
    });
    sum = r.result;
  }

  const checksum = onesComplement(sum);
  return { numbers: numbers, steps: steps, finalSum: sum, checksum: checksum };
}

/* ---------- 5. Checksum verification ---------- */

// words = data words, checksumWord = received checksum (all validated strings)
// Adds everything together; if the answer is 1111111111111111 it is valid.
function verifyChecksum(words, checksumWord) {
  const all = words.concat([checksumWord]);
  const numbers = all.map(function (w) { return parseInt(w, 2); });
  const steps = [];
  let sum = numbers[0];

  for (let i = 1; i < numbers.length; i++) {
    const r = onesComplementAdd(sum, numbers[i]);
    const isChecksum = (i === numbers.length - 1);
    steps.push({
      label: (i === 1 ? "Word 1 + Word 2" : "Previous sum + ") +
             (i === 1 ? "" : (isChecksum ? "Checksum" : "Word " + (i + 1))),
      before: sum,
      added: numbers[i],
      rawSum: r.rawSum,
      result: r.result,
      carries: r.carries
    });
    sum = r.result;
  }

  return { numbers: numbers, steps: steps, finalSum: sum, valid: sum === 0xFFFF };
}

/* ---------- 6. Drawing bits ---------- */

// Draws a 16-bit number as 16 cells in groups of 4.
// Filled cell = 1, outlined cell = 0. highlightLast colours the lowest bit pink
// (used to show the carry that was added back).
function bitsHtml(num, highlightLast, extraClass) {
  const s = toBinary16(num);
  let html = '<span class="bits ' + (extraClass || "") + '" role="img" aria-label="' + s + '">';
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 0) html += '<span class="nib">';
    const carried = (highlightLast && i === 15) ? " carried" : "";
    html += '<i class="bit b' + s[i] + carried + '">' + s[i] + "</i>";
    if (i % 4 === 3) html += "</span>";
  }
  return html + "</span>";
}

// One line of the working: a short label, then the bits.
// named = true uses a wider label column ("Word 1", "Final sum").
function rowHtml(label, num, named, highlightLast) {
  return '<div class="brow' + (named ? " named" : "") + '"><span class="rlab">' + label + "</span>" +
         bitsHtml(num, highlightLast) + "</div>";
}

function stepHeading(number, title) {
  return '<h4 class="stephead"><span class="stepno">' + number + "</span>" + title + "</h4>";
}

// One addition. Shows the carry and the end-around carry only if one happened.
function stepToHtml(s) {
  let html = '<div class="add"><div class="add-title">' + s.label + "</div>";
  html += rowHtml("", s.before);
  html += rowHtml("+", s.added);
  html += '<div class="rule"></div>';

  if (s.carries > 0) {
    // 17-bit result: the first bit is the carry, shown in pink
    const lower = s.rawSum & 0xFFFF;
    html += '<div class="brow"><span class="rlab"><span class="carrycell" title="carry out of bit 16">1</span></span>' +
            bitsHtml(lower) + "</div>";
    html += '<p class="note carry">Carry detected: 1. It is added back to the lower 16 bits.</p>';
    html += '<div class="wrap-label">End-around carry</div>';
    html += rowHtml("", lower);
    html += rowHtml("+", 1, false, true);
    html += '<div class="rule"></div>';
    html += rowHtml("=", s.result);
  } else {
    html += rowHtml("=", s.result);
    html += '<p class="note none">No carry in this addition.</p>';
  }
  return html + "</div>";
}

/* ---------- 7. Showing the results ---------- */

function showCalculation(words, data) {
  let html = "";

  // STEP 1
  html += stepHeading(1, "Input words");
  data.numbers.forEach(function (n, i) { html += rowHtml("Word " + (i + 1), n, true); });

  // STEP 2
  html += stepHeading(2, "One's complement addition");
  if (data.steps.length === 0) {
    html += '<p class="plain">Only one word was entered, so there is nothing to add. The sum is the word itself.</p>';
  } else {
    data.steps.forEach(function (s) { html += stepToHtml(s); });
  }

  // STEP 3
  const totalCarries = data.steps.filter(function (s) { return s.carries > 0; }).length;
  html += stepHeading(3, "End-around carry");
  if (totalCarries > 0) {
    html += '<p class="plain">Carry detected in ' + totalCarries + " addition" + (totalCarries > 1 ? "s" : "") +
            ". Each carry was added back to the lower 16 bits (the pink bit above).</p>";
  } else {
    html += '<p class="plain">No carry occurred, so no end-around carry was needed.</p>';
  }
  html += rowHtml("Final sum", data.finalSum, true);

  // STEP 4
  html += stepHeading(4, "One's complement");
  html += rowHtml("Final sum", data.finalSum, true);
  html += rowHtml("Flipped", data.checksum, true);
  html += '<p class="plain">Every bit of the final sum is flipped: 1 becomes 0 and 0 becomes 1.</p>';

  // STEP 5
  html += stepHeading(5, "Final checksum");
  html += '<div class="final">' + bitsHtml(data.checksum, false, "lg") +
          '<div class="hexline"><span>Hexadecimal</span><b>' + toHex16(data.checksum) + "</b></div></div>";

  document.getElementById("result").innerHTML = html;
}

function showVerification(words, checksumWord, data) {
  let html = "";

  html += stepHeading(1, "Received words and checksum");
  data.numbers.forEach(function (n, i) {
    const isChecksum = (i === data.numbers.length - 1);
    html += rowHtml(isChecksum ? "Checksum" : "Word " + (i + 1), n, true);
  });

  html += stepHeading(2, "Add everything (one's complement)");
  if (data.steps.length === 0) {
    html += '<p class="plain">Nothing to add.</p>';
  } else {
    data.steps.forEach(function (s) { html += stepToHtml(s); });
  }

  html += stepHeading(3, "Final sum");
  html += '<div class="final">' + bitsHtml(data.finalSum, false, "lg") + "</div>";

  if (data.valid) {
    html += '<div class="verdict valid">&#10003; Checksum Valid</div>';
    html += '<p class="plain">The sum is all 1s (1111111111111111), so no error was detected.</p>';
  } else {
    html += '<div class="verdict invalid">&#10007; Checksum Invalid</div>';
    html += '<p class="plain">The sum is not all 1s, so the data or the checksum changed. Error detected.</p>';
  }

  document.getElementById("verifyResult").innerHTML = html;
}

/* ---------- 8. Input fields ---------- */

// Builds one labelled input with a live bit counter and an optional remove button.
function buildField(labelText, value, onRemove) {
  const row = document.createElement("div");
  row.className = "wrow";

  const head = document.createElement("div");
  head.className = "whead";
  const label = document.createElement("span");
  label.className = "wlabel";
  label.textContent = labelText;
  const count = document.createElement("span");
  count.className = "count";
  head.appendChild(label);
  head.appendChild(count);

  const field = document.createElement("div");
  field.className = "wfield";
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 40;           // a little extra so "too long" can be shown as an error
  input.placeholder = "16 bits, e.g. 1010101010101010";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = value || "";
  field.appendChild(input);

  let removeBtn = null;
  if (onRemove) {
    removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", onRemove);
    field.appendChild(removeBtn);
  }

  const msg = document.createElement("div");
  msg.className = "msg";

  row.appendChild(head);
  row.appendChild(field);
  row.appendChild(msg);

  // live counter: 0/16, turns green at a valid 16 bits, red if wrong
  function updateCount() {
    const v = input.value.trim();
    count.textContent = v.length + "/16";
    count.className = "count" + (v.length === 0 ? "" : (validateWord(v) === "" ? " ok" : (v.length > 16 || !/^[01]*$/.test(v) ? " bad" : "")));
  }
  input.addEventListener("input", function () {
    updateCount();
    row.classList.remove("has-error");   // clear the old error while typing
    msg.textContent = "";
  });
  updateCount();

  return { row: row, input: input, label: label, msg: msg, removeBtn: removeBtn };
}

function addWordRow(listId, value) {
  const list = document.getElementById(listId);
  const f = buildField("Word", value, null);
  // remove button needs the row, so it is created after the field exists
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "remove";
  btn.textContent = "×";
  btn.addEventListener("click", function () {
    if (list.children.length > 1) {      // always keep at least one word
      list.removeChild(f.row);
      renumberRows(listId);
    }
  });
  f.row.querySelector(".wfield").appendChild(btn);
  list.appendChild(f.row);
  renumberRows(listId);
}

// Names the rows "Word 1", "Word 2"... and disables remove when only one is left.
function renumberRows(listId) {
  const rows = document.getElementById(listId).children;
  for (let i = 0; i < rows.length; i++) {
    rows[i].querySelector(".wlabel").textContent = "Word " + (i + 1);
    const btn = rows[i].querySelector(".remove");
    btn.disabled = (rows.length === 1);
    btn.setAttribute("aria-label", "Remove word " + (i + 1));
  }
}

// Reads and validates all inputs in a list. Shows a message under each wrong one.
function readWords(listId) {
  const rows = document.getElementById(listId).children;
  const words = [];
  let hasError = false;

  for (let i = 0; i < rows.length; i++) {
    const input = rows[i].querySelector("input");
    const msg = rows[i].querySelector(".msg");
    const value = input.value.trim();
    const problem = validateWord(value);
    rows[i].classList.toggle("has-error", problem !== "");
    msg.textContent = problem;
    if (problem !== "") hasError = true;
    words.push(value);
  }
  return { words: words, hasError: hasError };
}

/* ---------- 9. Button actions ---------- */

const EMPTY_RESULT = '<p class="empty">Enter your words and press Calculate checksum. Every step of the working appears here.</p>';
const EMPTY_VERIFY = '<p class="empty">Press Verify checksum to see the sum and the result. Tip: use your last calculation, then change one bit and verify again.</p>';

let lastCalc = null;      // remembers the last good calculation for the Verify section
let checksumField = null; // the checksum input in the Verify section

function showSummary(id, text) {
  const box = document.getElementById(id);
  box.textContent = text;
  box.style.display = text ? "block" : "none";
}

function onCalculate() {
  const r = readWords("wordList");

  if (r.hasError) {
    showSummary("error", "Fix the highlighted words, then calculate again.");
    document.getElementById("result").innerHTML = EMPTY_RESULT;
    return;
  }
  showSummary("error", "");
  const data = generateChecksum(r.words);
  lastCalc = { words: r.words, checksum: toBinary16(data.checksum) };
  showCalculation(r.words, data);
}

function onClear() {
  document.getElementById("textInput").value = "";
  document.getElementById("textMsg").textContent = "";
  document.getElementById("textInfo").innerHTML = "";
  document.getElementById("wordList").innerHTML = "";
  addWordRow("wordList");
  addWordRow("wordList");
  showSummary("error", "");
  document.getElementById("result").innerHTML = EMPTY_RESULT;
}

function onVerify() {
  const r = readWords("verifyWordList");
  const cValue = checksumField.input.value.trim();
  const cProblem = validateWord(cValue);
  checksumField.row.classList.toggle("has-error", cProblem !== "");
  checksumField.msg.textContent = cProblem;

  if (r.hasError || cProblem !== "") {
    showSummary("verifyError", "Fix the highlighted fields, then verify again.");
    document.getElementById("verifyResult").innerHTML = EMPTY_VERIFY;
    return;
  }
  showSummary("verifyError", "");
  showVerification(r.words, cValue, verifyChecksum(r.words, cValue));
}

function resetVerifyInputs(words, checksum) {
  document.getElementById("verifyWordList").innerHTML = "";
  words.forEach(function (w) { addWordRow("verifyWordList", w); });
  checksumField.input.value = checksum;
  checksumField.input.dispatchEvent(new Event("input"));
  checksumField.row.classList.remove("has-error");
  checksumField.msg.textContent = "";
  showSummary("verifyError", "");
}

function onVerifyClear() {
  resetVerifyInputs(["", ""], "");
  document.getElementById("verifyResult").innerHTML = EMPTY_VERIFY;
}

function onVerifyFill() {
  if (!lastCalc) {
    showSummary("verifyError", "There is no calculation yet. Calculate a checksum above first.");
    return;
  }
  resetVerifyInputs(lastCalc.words, lastCalc.checksum);
  document.getElementById("verifyResult").innerHTML = EMPTY_VERIFY;
}

// Text box: converts text into word rows, then calculates straight away.
function onTextConvert() {
  const input = document.getElementById("textInput");
  const msg = document.getElementById("textMsg");
  const info = document.getElementById("textInfo");
  const r = textToWords(input.value);

  info.innerHTML = "";
  msg.textContent = r.error;
  if (r.error !== "") return;

  document.getElementById("wordList").innerHTML = "";
  r.words.forEach(function (w) { addWordRow("wordList", w); });

  // small table: characters -> bits (built with textContent so any character is safe)
  const box = document.createElement("div");
  box.className = "tinfo";
  r.pairs.forEach(function (p, i) {
    const line = document.createElement("div");
    line.className = "tpair";
    const name = document.createElement("b");
    name.textContent = JSON.stringify(p.chars);
    const bits = document.createElement("span");
    bits.textContent = r.words[i].slice(0, 8) + " " + r.words[i].slice(8);
    line.appendChild(name);
    line.appendChild(bits);
    if (p.padded) {
      const pad = document.createElement("span");
      pad.className = "pad";
      pad.textContent = "(second byte padded with 00000000)";
      line.appendChild(pad);
    }
    box.appendChild(line);
  });
  info.appendChild(box);

  onCalculate();
}

/* ---------- Letters to bits explainer ---------- */

// Fills the small conversion table: character -> ASCII number -> 8 bits,
// then each pair of characters -> one 16-bit word.
function renderExplain() {
  const text = document.getElementById("explainInput").value;
  const msg = document.getElementById("explainMsg");
  const table = document.getElementById("explainTable");
  const r = textToWords(text);
  table.innerHTML = "";
  msg.textContent = r.error;
  if (r.error !== "") return;

  function addRow(cells, className) {
    const tr = document.createElement("tr");
    if (className) tr.className = className;
    cells.forEach(function (cell) {
      const td = document.createElement(cell.th ? "th" : "td");
      td.textContent = cell.text;
      if (cell.cls) td.className = cell.cls;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  }

  addRow([{ text: "Letter", th: true }, { text: "ASCII number", th: true }, { text: "8 bits", th: true }]);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    addRow([
      { text: text[i] === " " ? "(space)" : text[i], cls: "ch" },
      { text: String(code) },
      { text: code.toString(2).padStart(8, "0") }
    ]);
  }
  addRow([{ text: "Pairs", th: true }, { text: "", th: true }, { text: "16-bit word", th: true }]);
  r.pairs.forEach(function (p, i) {
    const w = r.words[i];
    const label = JSON.stringify(p.chars) + (p.padded ? " + padding" : "");
    addRow([
      { text: label, cls: p.padded ? "pad" : "" },
      { text: "" },
      { text: w.slice(0, 8) + " " + w.slice(8) }
    ], "word");
  });
}

// Sends the text from the explainer to the calculator and shows the result.
function onExplainUse() {
  const text = document.getElementById("explainInput").value;
  if (textToWords(text).error !== "") return;
  document.getElementById("textInput").value = text;
  onTextConvert();
  document.getElementById("calculate").scrollIntoView({ behavior: "smooth" });
}

/* ---------- 10. Hero bit strip (one-time flip animation) ---------- */

function initHero() {
  const word = "1010101010101010";
  const complement = word.split("").map(function (b) { return b === "1" ? "0" : "1"; }).join("");
  const strip = document.getElementById("heroStrip");
  const holder = document.getElementById("heroBits");
  const caption = document.getElementById("heroCaption");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  holder.innerHTML = bitsHtml(parseInt(word, 2), false).replace(/^<span[^>]*>/, "").replace(/<\/span>$/, "");
  let showing = word;
  let busy = false;

  function flip() {
    if (busy) return;
    busy = true;
    const target = (showing === word) ? complement : word;
    const cells = holder.querySelectorAll(".bit");

    cells.forEach(function (cell, i) {
      const delay = reduceMotion ? 0 : i * 60;
      setTimeout(function () {
        if (!reduceMotion) cell.classList.add("flipping");
        setTimeout(function () {                 // swap the bit halfway through the flip
          cell.textContent = target[i];
          cell.className = "bit b" + target[i] + (reduceMotion ? "" : " flipping");
        }, reduceMotion ? 0 : 180);
      }, delay);
    });

    const total = reduceMotion ? 10 : 15 * 60 + 400;
    setTimeout(function () {
      showing = target;
      holder.setAttribute("aria-label", target);
      caption.textContent = (target === complement)
        ? "One's complement 0101010101010101. Every bit flipped. Click to flip back."
        : "Word 1010101010101010. Click the bits to flip them.";
      cells.forEach(function (c) { c.classList.remove("flipping"); });
      busy = false;
    }, total);
  }

  strip.addEventListener("click", flip);
  if (!reduceMotion) setTimeout(flip, 1000);   // plays once on page load
}

/* ---------- 11. Start-up ---------- */

// Only run page code when a browser page exists
// (this lets the same file be tested in Node without changes).
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    addWordRow("wordList", "1010101010101010");
    addWordRow("wordList", "1100110011001100");
    addWordRow("wordList", "0000111100001111");
    addWordRow("verifyWordList");
    addWordRow("verifyWordList");

    checksumField = buildField("Checksum", "", null);
    document.getElementById("checksumField").appendChild(checksumField.row);

    document.getElementById("addWordBtn").addEventListener("click", function () { addWordRow("wordList"); });
    document.getElementById("calcBtn").addEventListener("click", onCalculate);
    document.getElementById("clearBtn").addEventListener("click", onClear);
    document.getElementById("textBtn").addEventListener("click", onTextConvert);
    document.getElementById("textInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") onTextConvert();
    });
    document.getElementById("verifyAddBtn").addEventListener("click", function () { addWordRow("verifyWordList"); });
    document.getElementById("verifyFillBtn").addEventListener("click", onVerifyFill);
    document.getElementById("verifyBtn").addEventListener("click", onVerify);
    document.getElementById("verifyClearBtn").addEventListener("click", onVerifyClear);

    document.getElementById("explainInput").addEventListener("input", renderExplain);
    document.getElementById("explainUseBtn").addEventListener("click", onExplainUse);
    renderExplain();

    initHero();
  });
}

// Export for testing in Node (ignored by the browser)
if (typeof module !== "undefined") {
  module.exports = { textToWords, validateWord, onesComplementAdd, onesComplement, generateChecksum, verifyChecksum, toBinary16, toHex16 };
}

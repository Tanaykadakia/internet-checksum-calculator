# Internet Checksum Calculator

A small website that calculates and verifies the **Internet Checksum** (the 16-bit one's complement checksum from [RFC 1071](https://www.rfc-editor.org/rfc/rfc1071)) and shows every step of the working. Built as a Data Communication and Networking (DCN) mini project with plain HTML, CSS and JavaScript. No frameworks, no backend, no database.

![Home page](screenshots/home.png)

## What it does

- Takes one or more 16-bit binary words, or plain text that it converts to 16-bit words
- Adds them using one's complement addition, with end-around carry
- Flips the final sum to get the checksum, shown in binary and hexadecimal
- Shows the calculation step by step, including the carry
- Has a separate **Verify** section: if the words plus the checksum add up to `1111111111111111`, the checksum is valid
- Checks the input and explains what is wrong (not 16 bits, not only 0 and 1)

![Addition with end-around carry](screenshots/working-addition.png)
![Final checksum](screenshots/working-checksum.png)

## How the checksum works

1. Split the data into 16-bit words.
2. Add all the words. If the sum goes past 16 bits, take the carry and add it back to the lowest bit (end-around carry).
3. Flip every bit of the final sum. That is the checksum.
4. To verify, add all the words and the checksum the same way. The answer should be all 1s.

Example: `AAAA + CCCC + 0F0F` gives sum `8686`, so the checksum is `7979`. Adding `8686 + 7979` gives `FFFF`, so it verifies.

| Valid | One bit changed |
|---|---|
| ![Valid](screenshots/verify-valid.png) | ![Invalid](screenshots/verify-invalid.png) |

## How to run it

No install needed. Download the project and open `index.html` in a browser. Keep the three files in the same folder.

```
Internet-Checksum-Calculator/
├── index.html
├── style.css
├── script.js
└── tests/test.js
```

## Tests

The checksum logic in `script.js` can be tested with Node (no packages needed):

```
node tests/test.js
```

The tests cover one word, many words, end-around carry, wrong input, verification, text input, and 20,000 random inputs compared against a separate calculation.

## Limitations

This is a checksum calculation and demonstration tool. It is **not** a TCP/UDP packet analyzer: it does not send, capture or analyze real packets. The Internet Checksum can detect many errors but not all (for example, swapping two 16-bit words gives the same sum), and it cannot correct errors.

## Future ideas

- Hexadecimal input
- TCP/UDP pseudo-header example
- Comparison with parity and CRC

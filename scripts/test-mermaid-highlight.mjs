import assert from "node:assert/strict";

import { highlightMermaidCode } from "../src/mermaid-highlight.js";

runTest("flowchart labels do not corrupt generated HTML", () => {
  const html = highlightMermaidCode(`flowchart TD
    A[Collect ideas] --> B{Need export?}
    B -->|SVG| C[Save vector output]`);

  assert.match(html, /<span class="token-declaration">flowchart<\/span>/);
  assert.match(
    html,
    /<span class="token-pipe">\|<\/span><span class="token-label">SVG<\/span><span class="token-pipe">\|<\/span>/
  );
  assert.doesNotMatch(html, /<span <span/u);
  assert.doesNotMatch(html, /token-keyword">class<\/span>=/u);
});

runTest("style lines highlight keywords, properties, colors, and numeric values", () => {
  const html = highlightMermaidCode(`flowchart LR
    classDef accent fill:#f9f,stroke:#333,stroke-width:2px`);

  assert.match(html, /<span class="token-keyword">classDef<\/span>/);
  assert.match(html, /<span class="token-identifier">accent<\/span>/);
  assert.match(html, /<span class="token-property">fill<\/span>/);
  assert.match(html, /<span class="token-property">stroke-width<\/span>/);
  assert.match(html, /<span class="token-color">#f9f<\/span>/);
  assert.match(html, /<span class="token-number">2px<\/span>/);
});

runTest("node body text stays plain even when it contains Mermaid keywords", () => {
  const html = highlightMermaidCode(`flowchart TD
    A([Round text with classDef word])`);

  assert.match(
    html,
    /<span class="token-identifier">A<\/span><span class="token-punctuation">\(<\/span><span class="token-punctuation">\[<\/span>Round text with classDef word<span class="token-punctuation">\]<\/span><span class="token-punctuation">\)<\/span>/
  );
  assert.doesNotMatch(html, /Round text with <span class="token-keyword">classDef<\/span>/u);
});

runTest("sequence diagrams highlight participants and control keywords", () => {
  const html = highlightMermaidCode(`sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: "Hello"
    note right of Bob: plain note text
    activate Bob
    deactivate Bob`);

  assert.match(html, /<span class="token-declaration">sequenceDiagram<\/span>/);
  assert.match(html, /<span class="token-keyword">participant<\/span> <span class="token-identifier">Alice<\/span>/);
  assert.match(html, /<span class="token-arrow">-&gt;&gt;<\/span>/);
  assert.match(html, /<span class="token-keyword">note<\/span>/);
  assert.match(html, /<span class="token-keyword">right<\/span>/);
  assert.match(html, /<span class="token-keyword">activate<\/span>/);
  assert.match(html, /<span class="token-keyword">deactivate<\/span>/);
  assert.match(html, /<span class="token-string">"Hello"<\/span>/);
  assert.match(html, /<span class="token-punctuation">:<\/span> plain note text/);
  assert.doesNotMatch(html, /plain <span class="token-keyword">note<\/span> text/u);
});

runTest("newer diagram declarations receive dedicated highlighting", () => {
  const html = highlightMermaidCode(`architecture-beta
    service api(database)[Payments API]`);

  assert.match(html, /<span class="token-declaration">architecture-beta<\/span>/);
  assert.match(html, /<span class="token-keyword">service<\/span>/);
  assert.match(html, /<span class="token-identifier">api<\/span>/);
});

runTest("init directives remain intact and highlighted as a single directive token", () => {
  const html = highlightMermaidCode(`%%{init: {'theme': 'dark'}}%%
flowchart LR`);

  assert.match(html, /^<span class="token-directive">%%\{init: \{'theme': 'dark'\}\}%%<\/span>/u);
});

runTest("er diagrams keep relationship operators intact", () => {
  const html = highlightMermaidCode(`erDiagram
    CUSTOMER ||--o{ ORDER : places`);

  assert.match(html, /<span class="token-declaration">erDiagram<\/span>/);
  assert.match(html, /<span class="token-identifier">CUSTOMER<\/span>/);
  assert.match(html, /<span class="token-arrow">\|\|--o\{<\/span>/);
  assert.match(html, /<span class="token-punctuation">:<\/span> places/);
});

console.log("Mermaid highlighting tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

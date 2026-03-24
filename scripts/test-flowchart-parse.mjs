import assert from "node:assert/strict";

import { layoutFlowchart } from "../src/ppt/flowchart/layout.js";
import { parseFlowchartSource } from "../src/ppt/flowchart/parse.js";

runTest("text labels inside dashed arrows are parsed as edge labels", () => {
  const parsed = parseFlowchartSource(`flowchart LR
A[进入云商店下单] --> A1{是否为白名单商品<br>/免费商品/云主机商品}
A1 --是--> A2[不做授信限制,正常下单]
A1 --否--> B{是否经销商子客户}`);

  assert.equal(parsed.nodes.find((node) => node.id === "A1")?.text, "是否为白名单商品\n/免费商品/云主机商品");
  assert.equal(parsed.edges[1]?.label, "是");
  assert.equal(parsed.edges[2]?.label, "否");
});

runTest("quoted node bodies and html breaks are normalized", () => {
  const parsed = parseFlowchartSource(`flowchart LR
W["可下单<br>月结支付（余额）<br>(若已绑卡也可信用卡)"]`);

  assert.equal(
    parsed.nodes[0]?.text,
    "可下单\n月结支付（余额）\n(若已绑卡也可信用卡)"
  );
});

runTest("multi-line edge labels produce expanded layout boxes", () => {
  const parsed = parseFlowchartSource(`flowchart LR
A -->|可开通<br>信用卡支付| B`);
  parsed.source = "flowchart LR\nA -->|可开通<br>信用卡支付| B";
  const diagram = layoutFlowchart(parsed);
  const label = diagram.edges[0]?.label;

  assert.equal(label?.text, "可开通\n信用卡支付");
  assert.ok(label?.height > 20, `expected multiline edge label height > 20, got ${label?.height}`);
});

runTest("source lines are tracked for node references and edges", () => {
  const parsed = parseFlowchartSource(`flowchart LR
A[Start]
A --> B
B --> A`);

  assert.deepEqual(parsed.nodes.find((node) => node.id === "A")?.sourceLines, [2, 3, 4]);
  assert.equal(parsed.edges[0]?.lineStart, 3);
  assert.equal(parsed.edges[1]?.lineStart, 4);
});

console.log("Flowchart parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

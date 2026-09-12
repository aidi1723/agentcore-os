import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (content, needle, label) => {
  if (!content.includes(needle)) {
    throw new Error(`${label}: missing ${needle}`);
  }
};

const assertInOrder = (content, terms, label) => {
  let cursor = -1;
  for (const term of terms) {
    const index = content.indexOf(term);
    if (index === -1) throw new Error(`${label}: missing ${term}`);
    if (index <= cursor) throw new Error(`${label}: ${term} is out of order`);
    cursor = index;
  }
};

const layout = read("src/app/layout.tsx");
const page = read("src/app/page.tsx");
const robots = read("src/app/robots.ts");
const sitemap = read("src/app/sitemap.ts");
const keywordBlock = layout.match(/const seoKeywords = \[([\s\S]*?)\];/)?.[1] ?? "";

assertIncludes(
  layout,
  "智能体企业定制_企业定制智能体与 AI Agent 解决方案 - AgentCore OS",
  "metadata title",
);
assertIncludes(
  layout,
  "AgentCore OS 提供智能体企业定制、企业定制智能体、企业 AI Agent 定制开发与私有化部署服务",
  "metadata description",
);
assertIncludes(layout, "https://www.agentcoreos.com", "canonical metadata");
assertIncludes(layout, "application/ld+json", "structured data script");
assertIncludes(layout, "FAQPage", "FAQ structured data");
assertIncludes(layout, "SoftwareApplication", "software structured data");
assertIncludes(layout, '<html lang="zh-CN">', "html language");
assertInOrder(
  keywordBlock,
  [
    "智能体企业定制",
    "企业智能体定制",
    "企业定制智能体",
    "企业定制 Agent",
    "AI 智能体企业定制",
    "企业 AI Agent 定制",
    "企业智能体解决方案",
    "企业智能体私有化部署",
  ],
  "metadata keyword order",
);

assertIncludes(page, "面向企业的智能体定制服务", "homepage SEO section heading");
assertIncludes(page, "智能体企业定制", "homepage primary keyword");
assertIncludes(page, "企业定制 Agent", "homepage Agent keyword");
assertIncludes(page, "企业智能体私有化部署", "homepage deployment keyword");

assertIncludes(robots, "sitemap: `${SITE_URL}/sitemap.xml`", "robots sitemap");
assertIncludes(sitemap, "https://www.agentcoreos.com", "sitemap site URL");

console.log("AgentCore SEO checks passed");

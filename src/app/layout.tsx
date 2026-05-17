import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://www.agentcoreos.com";
const siteTitle = "智能体企业定制_企业定制智能体与 AI Agent 解决方案 - AgentCore OS";
const siteDescription =
  "AgentCore OS 提供智能体企业定制、企业定制智能体、企业 AI Agent 定制开发与私有化部署服务，面向客服、销售、知识库、运营、招聘等业务场景，帮助企业构建专属智能体和自动化工作流。";
const seoKeywords = [
  "智能体企业定制",
  "企业智能体定制",
  "企业定制智能体",
  "企业定制 Agent",
  "AI 智能体企业定制",
  "企业 AI Agent 定制",
  "企业智能体解决方案",
  "企业智能体私有化部署",
  "智能体企业定制开发",
  "企业智能体定制开发公司",
  "企业 AI 智能体定制开发",
  "企业专属智能体定制",
  "企业内部智能体定制",
  "企业本地部署智能体",
  "行业智能体企业定制",
  "企业客服智能体定制",
  "企业销售智能体定制",
  "企业知识库智能体定制",
  "企业运营智能体定制",
  "企业招聘智能体定制",
  "企业 AI 工作流自动化",
  "企业流程自动化智能体",
  "多智能体工作流平台",
  "企业数字员工定制",
  "企业自动化 Agent 定制",
  "智能体企业定制多少钱",
  "企业智能体定制费用",
  "企业智能体怎么定制",
  "企业 AI Agent 定制流程",
  "企业智能体定制方案",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle,
  description: siteDescription,
  keywords: seoKeywords,
  icons: {
    icon: "/agentcore-logo.png",
    shortcut: "/agentcore-logo.png",
    apple: "/agentcore-logo.png",
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: "AgentCore OS",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/agentcore-logo.png",
        width: 512,
        height: 512,
        alt: "AgentCore OS 企业智能体定制平台",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/agentcore-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AgentCore OS",
    url: SITE_URL,
    logo: `${SITE_URL}/agentcore-logo.png`,
    description: siteDescription,
    knowsAbout: seoKeywords.slice(0, 12),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AgentCore OS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "面向企业智能体定制、业务工作流自动化和私有化部署的企业级 AI Agent 操作系统。",
    offers: {
      "@type": "Offer",
      category: "企业智能体定制服务",
      availability: "https://schema.org/InStock",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "AgentCore OS 适合哪些企业智能体定制场景？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AgentCore OS 可用于客服智能体、销售智能体、企业知识库智能体、运营智能体、招聘智能体和跨部门工作流自动化等企业定制智能体场景。",
        },
      },
      {
        "@type": "Question",
        name: "是否支持企业智能体私有化部署？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AgentCore OS 支持围绕企业数据、权限、知识库和业务流程进行定制，并可按项目需求规划本地部署、私有化部署或混合部署方案。",
        },
      },
      {
        "@type": "Question",
        name: "企业 AI Agent 定制流程通常包括哪些步骤？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "通常先梳理业务场景和数据边界，再设计智能体角色、工具权限、工作流和验收标准，随后完成开发、测试、部署和持续优化。",
        },
      },
    ],
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}

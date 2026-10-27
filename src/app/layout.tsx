import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TWB", template: "%s · TWB" },
  description: "Together.We.Build — 10인 이내 팀을 위한 가벼운 비동기 협업툴",
};
export const viewport: Viewport = { themeColor: "#5b5bf0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata = {
  title: "AgentVerse — Deploy AI Agents. Earn Per Call.",
  description: "Build, deploy, and monetize AI agents. Run composable pipelines across live market data. Earn USDC per API call on Base.",
  openGraph: {
    title: "AgentVerse",
    description: "The AI agent marketplace. Deploy agents, build pipelines, earn per call.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

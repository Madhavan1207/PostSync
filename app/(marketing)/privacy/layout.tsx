import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Postelligence Privacy Policy detailing how we handle user data and social media API integrations.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

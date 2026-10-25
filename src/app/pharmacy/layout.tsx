import type { Metadata } from "next";
import { patientContent } from "@/content/server";
import { ProviderViewProvider } from "@/store/provider-context";

export const metadata: Metadata = { title: "ClinIQ · Pharmacy" };

// The pharmacy view (Stage 3): bring routed patients in and help the
// pharmacist run the assessment they're paid for. The pharmacy is the paying
// customer. In the demo it is the fictional demo pharmacy's screen.
export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  const content = patientContent();
  return (
    <ProviderViewProvider content={content} providerId={content.demoProviderIds.pharmacy} basePath="/pharmacy">
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-bg">
        Demo only, not medical advice. Patient answers stay in this browser.
      </div>
      {children}
    </ProviderViewProvider>
  );
}

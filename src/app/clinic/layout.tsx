import type { Metadata } from "next";
import { patientContent } from "@/content/server";
import { ProviderViewProvider } from "@/store/provider-context";

export const metadata: Metadata = { title: "ClinIQ · Clinic" };

// The clinic view (Stage 2): desktop, for the front desk and physicians.
// In the demo there is no sign-in; it is the fictional demo clinic's screen.
export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  const content = patientContent();
  return (
    <ProviderViewProvider content={content} providerId={content.demoProviderIds.clinic} basePath="/clinic">
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-bg">
        Demo only, not medical advice. Patient answers stay in this browser.
      </div>
      {children}
    </ProviderViewProvider>
  );
}

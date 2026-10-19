import { patientContent } from "@/content/server";
import { IntakeProvider } from "@/store/intake-context";

// The patient view: mobile, no account. Content is read and validated on the
// server; a bad condition file fails here rather than routing anyone.
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const content = patientContent();
  return (
    <IntakeProvider content={content}>
      {content.locationsOverride ? (
        <div className="bg-warn-tint px-4 py-1 text-center text-xs text-warn">
          Test location data: {content.locationsOverride}
        </div>
      ) : null}
      {children}
    </IntakeProvider>
  );
}

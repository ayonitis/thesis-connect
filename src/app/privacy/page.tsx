import { permanentRedirect } from "next/navigation";

export default function LegacyInformationPage() {
  permanentRedirect("/guidelines-privacy#privacy");
}

import { InformationPage } from "@/components/layout/information-page";

const linkClass = "rounded-sm font-medium text-[#1D4ED8] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2";

export default function GuidelinesPrivacyPage() {
  return (
    <InformationPage title="Guidelines & Privacy">
      <p>These guidelines explain how to participate in Thesis Connect and how profile, room, and review information is displayed.</p>

      <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-2 border-y border-[#E0E2E6] py-3">
        <a className={linkClass} href="#community-guidelines">Community Guidelines</a>
        <a className={linkClass} href="#privacy">Privacy</a>
      </nav>

      <section id="community-guidelines" aria-labelledby="community-title" className="scroll-mt-6">
        <h2 id="community-title" className="text-xl font-semibold text-[#191C21]">Community Guidelines</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Communicate respectfully. Harassment, threats, discrimination, and personal attacks are prohibited.</li>
          <li>Base faculty reviews on your own experience. Keep feedback specific, constructive, and relevant to thesis supervision.</li>
          <li>Use room applications, faculty suggestions, and reviews honestly. Avoid spam, misleading claims, and impersonation.</li>
          <li>Respect student and faculty privacy. Keep private contact details, student IDs, and sensitive personal information out of public fields.</li>
          <li>Use the platform for thesis-related collaboration and academic feedback.</li>
        </ul>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-6 border-t border-[#E0E2E6] pt-6">
        <h2 id="privacy-title" className="text-xl font-semibold text-[#191C21]">Privacy</h2>
        <dl className="mt-3 space-y-4">
          <div><dt className="font-semibold text-[#191C21]">Student profiles</dt><dd>Profiles include your name and department, plus your student ID, CGPA, current semester, and optional BRAC University response. Student ID, CGPA, semester, and the optional response are stored separately from public listings. Public room summaries can show the host’s display name, department, and room details.</dd></div>
          <div><dt className="font-semibold text-[#191C21]">Room applications</dt><dd>Application details and contact links stay out of public room listings. The room host can view the details you submit through the application.</dd></div>
          <div><dt className="font-semibold text-[#191C21]">Accounts and faculty information</dt><dd>Supabase Auth handles sign-in and email confirmation. Account email stays out of public student listings. Faculty profiles may show official contact and academic information from the university directory.</dd></div>
          <div><dt className="font-semibold text-[#191C21]">Reviews and forum</dt><dd>Eligible signed-in students see published reviews under the label “Anonymous Student.” Your review remains linked to your account so you can manage it, and administrators can moderate its visibility. Forum posting is currently unavailable.</dd></div>
          <div><dt className="font-semibold text-[#191C21]">Privacy questions</dt><dd>Email <a className={linkClass} href="mailto:ayon3015@gmail.com">ayon3015@gmail.com</a> with questions about how information is handled.</dd></div>
        </dl>
      </section>
    </InformationPage>
  );
}

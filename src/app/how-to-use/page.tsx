import Link from "next/link";
import { InformationPage } from "@/components/layout/information-page";
import { FACULTY_REVIEW_RATINGS } from "@/lib/faculty-review-ratings";

const linkClass = "rounded-sm font-medium text-[#1D4ED8] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2";

export default function HowToUsePage() {
  return (
    <InformationPage title="How to Use Thesis Connect">
      <p>New to Thesis Connect? Start here to explore supervisors, learn from student reviews, and find potential thesis partners.</p>

      <ol className="list-decimal space-y-5 pl-6 marker:font-semibold marker:text-[#1D4ED8]">
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Sign in with your university account</h2>
          <p className="mt-1"><Link className={linkClass} href="/sign-in">Sign in</Link> with Google or with an email and password. Student access requires a confirmed BRAC University email ending in <strong>@g.bracu.ac.bd</strong>. If you register by email, confirm your address using the link sent to your inbox. If your profile is incomplete, you’ll be prompted to finish it.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Complete your profile</h2>
          <p className="mt-1">Enter your name, student ID, department, CGPA, and current semester to set up student features such as room applications and faculty reviews. You can also add one thing you like about BRAC University. Edit your information later from <Link className={linkClass} href="/profile">Profile</Link>.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Explore faculty and supervisors</h2>
          <p className="mt-1">Open the <Link className={linkClass} href="/faculty">faculty directory</Link>. Search by name, department, or summary, or filter by department. Open a profile to see details such as academic designation and research interests where listed.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Read faculty reviews</h2>
          <p className="mt-1">Signed-in eligible students can read published reviews on faculty profiles. Current and legacy ratings use different criteria and are summarized separately. Use reviews alongside research interests and other information when comparing supervisors.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Share your own experience</h2>
          <p className="mt-1">Open the review form from a faculty profile. Eligible students with complete profiles can submit one review per faculty member when submissions are available. Rate each criterion from 1 to 10 and explain your scores with specific, respectful feedback.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {FACULTY_REVIEW_RATINGS.map(([key, label]) => <li key={key}>{label}</li>)}
          </ul>
          <p className="mt-2">You can edit or delete your own review. Legacy ratings stay fixed when you edit their descriptions. Administrators can hide or republish reviews.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Find thesis partners</h2>
          <p className="mt-1">Browse <Link className={linkClass} href="/partners">partner rooms</Link> for topics and teammate requirements. Apply to join a suitable room or create one for your thesis idea.</p>
        </li>
        <li className="border-t border-[#E0E2E6] pt-4">
          <h2 className="text-lg font-semibold text-[#191C21]">Make the most of Thesis Connect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Keep your profile accurate.</li>
            <li>Explore multiple supervisors and read more than one review.</li>
            <li>Follow the <Link className={linkClass} href="/guidelines-privacy">community guidelines</Link> when sharing feedback.</li>
          </ul>
        </li>
      </ol>
    </InformationPage>
  );
}

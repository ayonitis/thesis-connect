import { InformationPage } from "@/components/layout/information-page";

export default function AboutPage() {
  return (
    <InformationPage title="About Thesis Connect">
      <p>Thesis Connect was created by Arshad Ahmed, a BRAC University student, to help students find thesis partners, learn about supervisors, and share what they have learned.</p>

      <section aria-labelledby="about-platform">
        <h2 id="about-platform" className="text-xl font-semibold text-[#191C21]">What is Thesis Connect?</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Explore faculty profiles and available academic information.</li>
          <li>Read student reviews to learn about different supervision experiences.</li>
          <li>Find thesis partners by browsing rooms and applying to join.</li>
        </ul>
      </section>

      <section aria-labelledby="about-contact" className="border-t border-[#E0E2E6] pt-6">
        <h2 id="about-contact" className="text-xl font-semibold text-[#191C21]">Have a question, suggestion, or request?</h2>
        <p className="mt-2">We’d love to hear your questions, feedback, and ideas for improving Thesis Connect.</p>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <li><a className="rounded-sm text-[#1D4ED8] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" href="mailto:ayon3015@gmail.com">ayon3015@gmail.com</a></li>
          <li><a className="rounded-sm text-[#1D4ED8] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" href="https://github.com/ayonitis" target="_blank" rel="noopener noreferrer">Arshad Ahmed on GitHub <span className="sr-only">(opens in a new tab)</span></a></li>
        </ul>
      </section>
    </InformationPage>
  );
}

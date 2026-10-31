import type { FacultyRecord } from "@/lib/types";

export const MOCK_FACULTY: FacultyRecord[] = [
  {
    slug: "dr-mira-sen",
    name: "Dr. Mira Sen",
    initials: "MS",
    department: "CSE",
    researchInterests: [
      "Human-centered AI",
      "Explainable machine learning",
      "Educational data systems",
    ],
    summaryNote:
      "Mock summary: students often describe structured milestones and detailed technical feedback.",
    isMock: true,
    reviews: [
      {
        id: "rev-1",
        reviewerLabel: "Anonymous Student",
        clarity: 8,
        responsiveness: 7,
        fairness: 8,
        workload: 6,
        description:
          "Mock review: clear weekly targets and practical suggestions on scope control.",
        createdAt: "2026-08-20T00:00:00.000Z",
        isMock: true,
      },
      {
        id: "rev-2",
        reviewerLabel: "Anonymous Student",
        clarity: 9,
        responsiveness: 8,
        fairness: 9,
        workload: 7,
        description:
          "Mock review: very transparent on expectations, but progress meetings are rigorous.",
        createdAt: "2026-08-05T00:00:00.000Z",
        isMock: true,
      },
    ],
  },
  {
    slug: "prof-adnan-kabir",
    name: "Prof. Adnan Kabir",
    initials: "AK",
    department: "EEE",
    researchInterests: [
      "Power electronics",
      "Energy optimization",
      "Embedded control systems",
    ],
    summaryNote:
      "Mock summary: students mention practical lab-oriented guidance and consistent office-hour support.",
    isMock: true,
    reviews: [
      {
        id: "rev-3",
        reviewerLabel: "Anonymous Student",
      clarity: 7,
        responsiveness: 9,
        fairness: 8,
        workload: 7,
        description:
          "Mock review: quick responses and useful design feedback for implementation issues.",
        createdAt: "2026-08-11T00:00:00.000Z",
        isMock: true,
      },
    ],
  },
  {
    slug: "dr-ruba-haque",
    name: "Dr. Ruba Haque",
    initials: "RH",
    department: "BBS",
    researchInterests: [
      "Innovation management",
      "Digital transformation",
      "Behavioral decision systems",
    ],
    summaryNote:
      "Mock summary: students describe high emphasis on writing quality and evidence-backed arguments.",
    isMock: true,
    reviews: [
      {
        id: "rev-4",
        reviewerLabel: "Anonymous Student",
        clarity: 8,
        responsiveness: 6,
        fairness: 7,
        workload: 8,
        description:
          "Mock review: very detail-oriented feedback, especially for literature review sections.",
        createdAt: "2026-08-02T00:00:00.000Z",
        isMock: true,
      },
    ],
  },
];

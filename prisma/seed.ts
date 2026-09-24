import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Transcribed from "TOR 6131 - Objectways Hiring.xlsx". One engagement per
// tab. Required/filled counts come from each tab's header block, except the
// CR04 Lakshmi / Christos US Data Engineer role, where the tab says 2/2 but
// the "Summary of Open Roles" tab lists 2 still open — the summary is used.
//
// The workbook rarely records when a resume was sent, so `sent` is the date
// in the candidate's name cell when present (e.g. "Deepak Bhayal (06/23)"),
// otherwise a week before the first interview date, otherwise an estimate
// from row order. Dates are 2026; month/day order follows each tab (the
// Subhash tab is MM/DD, the CR04 tabs are DD/MM).

type Row = {
  name: string;
  pos: string;
  sent: string;
  stage: string;
  screening?: string;
  interviewer?: string;
  interviewAt?: string;
  feedback?: string;
  onboarding?: string;
};

type EngagementSeed = {
  code: string;
  name: string;
  boeingPoc: string;
  positions: { key: string; title: string; location: string; required: number; filled: number; hiringManager?: string; openedAt: string }[];
  rows: Row[];
};

const NOT_AVAILABLE = "Interview hasn't happened, candidate not available";

const ENGAGEMENTS: EngagementSeed[] = [
  {
    code: "TOR-6131",
    name: "TOR 6131 · Subhash",
    boeingPoc: "Subhash",
    positions: [
      { key: "us-devops", title: "DevOps Engineer", location: "US", required: 1, filled: 1, hiringManager: "Shahrukh", openedAt: "2026-06-01" },
      { key: "us-de", title: "Data Engineer", location: "US", required: 1, filled: 1, hiringManager: "Anoop", openedAt: "2026-06-01" },
      { key: "in-devops", title: "DevOps Engineer", location: "India", required: 1, filled: 0, hiringManager: "Shahrukh", openedAt: "2026-06-01" },
      { key: "in-de", title: "Sr. Data Engineer", location: "India", required: 1, filled: 0, hiringManager: "Anoop", openedAt: "2026-06-01" },
      { key: "us-palantir", title: "Palantir Engineer", location: "US", required: 1, filled: 0, hiringManager: "Deepti", openedAt: "2026-07-15" },
      { key: "us-goldengate", title: "GoldenGate Engineer", location: "US", required: 1, filled: 1, hiringManager: "Anoop", openedAt: "2026-06-01" },
    ],
    rows: [
      { name: "Anushka", pos: "in-devops", sent: "2026-06-05", stage: "withdrawn", interviewer: "Shahrukh", feedback: "Relevant DevOps skills but less experience on AWS. Can be reconsidered if no other suitable candidate is found.", onboarding: "Not available" },
      { name: "Sathish Dhanaraj", pos: "in-devops", sent: "2026-06-05", stage: "withdrawn", screening: "Has all the required skills in resume", interviewer: "Shahrukh", onboarding: NOT_AVAILABLE },
      { name: "Anushree Rao A", pos: "in-devops", sent: "2026-06-05", stage: "withdrawn", screening: "Has all the required skills in resume", interviewer: "Shahrukh", onboarding: NOT_AVAILABLE },
      { name: "Amith S Devaramane", pos: "in-devops", sent: "2026-07-22", stage: "interview_rejected", screening: "Interview conducted on 07/29", interviewer: "Shahrukh", interviewAt: "2026-07-29", feedback: "Rejected" },
      { name: "Mukesh Kumar", pos: "in-devops", sent: "2026-07-13", stage: "withdrawn", screening: "Interview conducted on 07/20", interviewer: "Shahrukh", interviewAt: "2026-07-20", feedback: "On hold", onboarding: "Interview happened, candidate not available" },
      { name: "Rajesh Reddy", pos: "in-devops", sent: "2026-06-08", stage: "screen_rejected", screening: "Has less experience on AWS", interviewer: "Shahrukh" },
      { name: "Om Pandey", pos: "in-de", sent: "2026-06-08", stage: "interview_rejected", screening: "Interview conducted", interviewer: "Anoop", feedback: "Rejected" },
      { name: "Deepak Bhayal", pos: "in-de", sent: "2026-06-23", stage: "screen_rejected", screening: "Junior profile; skills not fully aligned to requirements", interviewer: "Anoop" },
      { name: "Shamanth J.", pos: "in-de", sent: "2026-06-23", stage: "interview_rejected", screening: "Interview conducted on 08/05", interviewer: "Anoop", interviewAt: "2026-08-05", feedback: "Rejected" },
      { name: "Athul Vinod", pos: "in-de", sent: "2026-06-08", stage: "screen_rejected", screening: "Junior profile; skills not fully aligned to requirements", interviewer: "Anoop" },
      { name: "Vigneshwar Umapathy", pos: "in-devops", sent: "2026-06-09", stage: "withdrawn", screening: NOT_AVAILABLE, interviewer: "Shahrukh", onboarding: NOT_AVAILABLE },
      { name: "Sathish Dhanaraj", pos: "in-devops", sent: "2026-06-09", stage: "withdrawn", screening: NOT_AVAILABLE, interviewer: "Shahrukh", onboarding: NOT_AVAILABLE },
      { name: "Nagendra Reddy", pos: "in-devops", sent: "2026-06-23", stage: "screen_rejected", interviewer: "Shahrukh" },
      { name: "Sarat Manchiraju", pos: "us-goldengate", sent: "2026-06-08", stage: "onboarded", screening: "Interview conducted on 06/15", interviewer: "Anoop", interviewAt: "2026-06-15", feedback: "Passed", onboarding: "Yes" },
      { name: "Mason Weaver", pos: "us-devops", sent: "2026-07-01", stage: "submitted", interviewer: "Shahrukh" },
      { name: "Moises Cassidy", pos: "us-devops", sent: "2026-07-01", stage: "screen_rejected", screening: "Profile too senior", interviewer: "Shahrukh" },
      { name: "Valejo (Jo) Johnson", pos: "us-devops", sent: "2026-07-20", stage: "onboarded", screening: "Interview conducted on 07/27", interviewer: "Shahrukh", interviewAt: "2026-07-27", feedback: "Passed", onboarding: "Yes" },
      { name: "Jaya Thakur", pos: "in-de", sent: "2026-07-21", stage: "interview_rejected", screening: "Interview conducted on 07/28", interviewer: "Anoop", interviewAt: "2026-07-28", feedback: "Rejected" },
      { name: "Harshvardhan Bhardwaj", pos: "in-de", sent: "2026-07-24", stage: "screen_rejected", screening: "Did not meet qualifications" },
      { name: "Nazeer Ahamed", pos: "in-de", sent: "2026-07-24", stage: "screen_rejected", screening: "Did not meet qualifications" },
      { name: "Karthikraj Vairam", pos: "in-de", sent: "2026-07-30", stage: "interview_rejected", screening: "Interview conducted on 08/03", interviewAt: "2026-08-03", feedback: "Rejected" },
      { name: "Vikram Gollamandala", pos: "us-de", sent: "2026-07-27", stage: "interview_rejected", screening: "Interview conducted on 08/03", interviewer: "Anoop", interviewAt: "2026-08-03", feedback: "Rejected — did not meet qualifications" },
      { name: "Patrick Nerbun", pos: "us-palantir", sent: "2026-07-28", stage: "interview_rejected", screening: "Interview conducted on 08/04", interviewer: "Deepti", interviewAt: "2026-08-04", feedback: "Rejected — did not meet qualifications" },
      { name: "Mukesh Kumar", pos: "in-devops", sent: "2026-08-04", stage: "withdrawn", screening: "Has all the required skills in resume", interviewer: "Shahrukh", feedback: "Selected", onboarding: "Candidate not available" },
      { name: "Anushka Tiwari", pos: "in-devops", sent: "2026-08-04", stage: "withdrawn", screening: "Has all the required skills in resume", interviewer: "Shahrukh", feedback: "Selected", onboarding: "Candidate not available" },
      { name: "Sparshika Ajmaan Dinesh Kumar", pos: "in-de", sent: "2026-08-06", stage: "screen_rejected", screening: "Junior profile; skills not fully aligned to requirements", interviewer: "Anoop" },
      { name: "Kshitij Javir", pos: "in-de", sent: "2026-08-18", stage: "screen_rejected", screening: "Rejected on 08/24", interviewer: "Anoop" },
      { name: "Tousiya Shaikh", pos: "in-devops", sent: "2026-08-10", stage: "interview_rejected", screening: "Interview conducted on 08/17", interviewer: "Shahrukh", interviewAt: "2026-08-17", feedback: "Rejected" },
      { name: "Vivek Kumar", pos: "in-devops", sent: "2026-08-10", stage: "on_hold", screening: "Interview conducted on 08/17", interviewer: "Shahrukh", interviewAt: "2026-08-17", feedback: "Hold" },
      { name: "Dilip", pos: "in-de", sent: "2026-08-18", stage: "screen_rejected", screening: "Rejected on 08/24", interviewer: "Anoop", feedback: "Rejected" },
      { name: "Arunprakash", pos: "in-de", sent: "2026-08-27", stage: "awaiting_feedback", screening: "Interview conducted on 09/03", interviewer: "Anoop", interviewAt: "2026-09-03" },
      { name: "Yaswanth Yasarapu", pos: "in-devops", sent: "2026-08-25", stage: "interview_rejected", screening: "Interview scheduled on 09/01", interviewer: "Shahrukh", interviewAt: "2026-09-01", feedback: "Rejected" },
      { name: "Adam Galyoon", pos: "us-palantir", sent: "2026-09-01", stage: "awaiting_feedback", screening: "Interview scheduled on 09/08", interviewer: "Deepti", interviewAt: "2026-09-08" },
      { name: "Tom Oppenheim", pos: "us-de", sent: "2026-08-13", stage: "onboarded", screening: "Interview conducted on 08/20", interviewer: "Anoop", interviewAt: "2026-08-20", feedback: "Passed", onboarding: "Yes" },
      { name: "Hulash Kumar", pos: "in-devops", sent: "2026-09-15", stage: "submitted", interviewer: "Shahrukh" },
      { name: "Gopikrishna", pos: "in-devops", sent: "2026-09-15", stage: "submitted", interviewer: "Shahrukh" },
      { name: "Yarragudi Prudvi Raju", pos: "in-devops", sent: "2026-09-17", stage: "submitted", interviewer: "Shahrukh" },
      { name: "Durgesh Pandey", pos: "in-de", sent: "2026-09-17", stage: "submitted", interviewer: "Anoop" },
    ],
  },
  {
    code: "CR04-NAVNEET",
    name: "CR04 · Navneet",
    boeingPoc: "Navneet",
    positions: [
      { key: "fullstack", title: "Full Stack Developer", location: "India", required: 1, filled: 1, hiringManager: "Navneet", openedAt: "2026-08-10" },
      { key: "de", title: "Data Engineer", location: "India", required: 1, filled: 1, hiringManager: "Navneet", openedAt: "2026-08-10" },
    ],
    rows: [
      { name: "Sparshika", pos: "de", sent: "2026-08-14", stage: "interview_rejected", screening: "Interviewed", feedback: "Rejected" },
      { name: "Kshitij Javir", pos: "de", sent: "2026-08-14", stage: "screen_rejected", screening: "Rejected" },
      { name: "Shashank Ranjan", pos: "de", sent: "2026-08-14", stage: "screen_rejected", screening: "Rejected" },
      { name: "Dilip", pos: "de", sent: "2026-08-20", stage: "interview_rejected", screening: "Interview on 27/08", interviewAt: "2026-08-27", feedback: "Rejected" },
      { name: "Arun Prakash", pos: "de", sent: "2026-08-20", stage: "shortlisted", screening: "Waiting for interview slot" },
      { name: "Bhagya Lakshmi", pos: "de", sent: "2026-08-24", stage: "onboarded", screening: "Interview on 31/08", interviewAt: "2026-08-31", feedback: "Selected. 2nd round with Sumithra on 09/09 — selected.", onboarding: "Selected" },
      { name: "Aysha", pos: "de", sent: "2026-08-19", stage: "interview_rejected", screening: "Interview on 26/08", interviewAt: "2026-08-26", feedback: "Rejected" },
    ],
  },
  {
    code: "CR04-LAKSHMI",
    name: "CR04 · Lakshmi / Christos",
    boeingPoc: "Lakshmi / Christos",
    positions: [
      { key: "in-de", title: "Data Engineer", location: "India", required: 4, filled: 2, hiringManager: "Lakshmi", openedAt: "2026-08-17" },
      { key: "us-de", title: "Data Engineer", location: "US", required: 2, filled: 0, hiringManager: "Christos", openedAt: "2026-08-17" },
    ],
    rows: [
      { name: "Jim Sproul", pos: "us-de", sent: "2026-09-03", stage: "awaiting_feedback", screening: "Interview scheduled for 10/09", interviewer: "Praveen", interviewAt: "2026-09-10" },
      { name: "Jing Xu", pos: "us-de", sent: "2026-09-02", stage: "awaiting_feedback", screening: "Interview scheduled for 09/09", interviewer: "Praveen", interviewAt: "2026-09-09" },
      { name: "Sparshika", pos: "in-de", sent: "2026-08-27", stage: "interview_rejected", screening: "Interview scheduled on 03/09", interviewer: "Rajiv", interviewAt: "2026-09-03", feedback: "Technical depth on AWS services did not align", onboarding: "No" },
      { name: "Harshvardhan", pos: "in-de", sent: "2026-08-27", stage: "interview_rejected", screening: "Interview scheduled on 03/09", interviewer: "Rajiv", interviewAt: "2026-09-03", feedback: "Gaps in fundamental data engineering concepts; did not demonstrate confidence", onboarding: "No" },
      { name: "Shyam Kumar P", pos: "in-de", sent: "2026-09-02", stage: "withdrawn", screening: "Interview scheduled on 09/09", interviewer: "Rajiv", interviewAt: "2026-09-09", feedback: "Selected", onboarding: "Received another offer; no longer willing to join Objectways" },
      { name: "Muthu Kumar V", pos: "in-de", sent: "2026-09-02", stage: "onboarded", screening: "Interview scheduled on 09/09", interviewer: "Rajiv", interviewAt: "2026-09-09", feedback: "Selected", onboarding: "Yes" },
      { name: "Pratik Raut", pos: "in-de", sent: "2026-09-08", stage: "interview_rejected", screening: "Interview scheduled for 15/09", interviewer: "Rajiv", interviewAt: "2026-09-15", feedback: "Rejected", onboarding: "No" },
      { name: "M Kaushik", pos: "in-de", sent: "2026-09-14", stage: "selected", screening: "Interview scheduled for 21/09", interviewer: "Rajiv", interviewAt: "2026-09-21", feedback: "Selected" },
      { name: "Dhananjayan", pos: "in-de", sent: "2026-09-14", stage: "interview_rejected", screening: "Interview scheduled for 21/09", interviewer: "Rajiv", interviewAt: "2026-09-21", feedback: "Rejected" },
      { name: "Shashi Kumar", pos: "in-de", sent: "2026-09-16", stage: "screen_rejected", interviewer: "Rajiv" },
      { name: "Vaishnavi", pos: "in-de", sent: "2026-09-16", stage: "screen_rejected", interviewer: "Rajiv" },
      { name: "Anusha", pos: "in-de", sent: "2026-09-16", stage: "screen_rejected", interviewer: "Rajiv" },
    ],
  },
  {
    code: "GOOGLE-SRE",
    name: "Google SRE",
    boeingPoc: "Ken Jallen",
    positions: [
      { key: "sre", title: "Google SRE", location: "US", required: 2, filled: 2, hiringManager: "Ken Jallen / team", openedAt: "2026-07-01" },
    ],
    rows: [
      { name: "Zach Hafeez", pos: "sre", sent: "2026-07-06", stage: "onboarded", interviewer: "Ken Jallen / team", feedback: "Passed", onboarding: "Yes" },
      { name: "Elijah Grady", pos: "sre", sent: "2026-07-06", stage: "interview_rejected", interviewer: "Ken Jallen / team", feedback: "Rejected" },
      { name: "Jamal", pos: "sre", sent: "2026-07-08", stage: "onboarded", screening: "Passed", interviewer: "Ken Jallen / team", feedback: "Passed", onboarding: "Yes" },
    ],
  },
];

const USERS = [
  { email: "ravi@objectways.com", name: "Ravi", role: "admin", company: "Objectways" },
  { email: "recruiting@objectways.com", name: "Objectways Recruiting", role: "recruiter", company: "Objectways" },
  { email: "staffing@boeing.example", name: "Boeing Hiring Team", role: "client", company: "Boeing" },
];

async function main() {
  // `--if-empty` runs on every Railway deploy (see railway.json): it seeds a
  // fresh database once and never touches one that already has data, so
  // recruiters' updates survive redeploys. Without the flag this is a full
  // reset back to the workbook contents.
  if (process.argv.includes("--if-empty") && (await prisma.engagement.count()) > 0) {
    console.log("Staffing data already present; skipping seed.");
    return;
  }

  console.log("Seeding staffing data...");

  await prisma.submission.deleteMany();
  await prisma.position.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({ data: USERS });

  for (const e of ENGAGEMENTS) {
    const engagement = await prisma.engagement.create({
      data: { code: e.code, name: e.name, boeingPoc: e.boeingPoc },
    });
    const positionIds = new Map<string, string>();
    for (const p of e.positions) {
      const created = await prisma.position.create({
        data: {
          engagementId: engagement.id,
          title: p.title,
          location: p.location,
          required: p.required,
          filled: p.filled,
          hiringManager: p.hiringManager,
          openedAt: new Date(p.openedAt),
        },
      });
      positionIds.set(p.key, created.id);
    }
    for (const r of e.rows) {
      const position = e.positions.find((p) => p.key === r.pos)!;
      await prisma.submission.create({
        data: {
          positionId: positionIds.get(r.pos)!,
          candidateName: r.name,
          location: position.location,
          sentAt: new Date(r.sent),
          stage: r.stage,
          screeningNotes: r.screening,
          interviewer: r.interviewer,
          interviewAt: r.interviewAt ? new Date(r.interviewAt) : null,
          feedback: r.feedback,
          onboardingNotes: r.onboarding,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

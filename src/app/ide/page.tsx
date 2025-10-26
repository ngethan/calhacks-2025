import dynamic from "next/dynamic";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AssessmentProvider } from "@/contexts/assessment-context";
import { db } from "@/server/db";
import { assessmentSession } from "@/server/db/schema/assessment-schema";
import { and, eq } from "drizzle-orm";

const App = dynamic(() => import("@/ide/app"));

export default async function IDEPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/api/auth/sign-in");
  }

  // Fetch active assessment directly from database
  const activeAssessment = await db.query.assessmentSession.findFirst({
    where: and(
      eq(assessmentSession.userId, session.user.id),
      eq(assessmentSession.status, "active")
    ),
  });

  return (
    <AssessmentProvider
      userId={session.user.id}
      sessionId={activeAssessment?.id ?? null}
      framework={activeAssessment?.framework ?? null}
    >
      <App />
    </AssessmentProvider>
  );
}

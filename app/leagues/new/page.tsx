import { Suspense } from "react";
import { connection } from "next/server";
import { Panel, PageTitle } from "@/components/ui";
import { LeagueForm } from "./league-form";

// The default year depends on the current date, so it is read at request time.
async function NewLeagueForm() {
  await connection();
  return <LeagueForm defaultYear={new Date().getFullYear()} />;
}

export default function NewLeaguePage() {
  return (
    <>
      <PageTitle title="New league" />
      <Panel title="League settings">
        <Suspense fallback={<p className="p-3 text-muted">Loading form</p>}>
          <NewLeagueForm />
        </Suspense>
      </Panel>
    </>
  );
}

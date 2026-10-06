"use client";

import { useEffect } from "react";
import { Panel, PageTitle, buttonClass } from "@/components/ui";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageTitle title="Something went wrong" />
      <Panel title="Unexpected error">
        <div className="grid justify-items-start gap-3 p-3">
          <p className="text-muted">
            The app could not finish that request. Your league data has not
            been changed. Check that the database file in the local-data folder
            is readable, then try again.
          </p>
          <button type="button" onClick={() => retry()} className={buttonClass.primary}>
            Try again
          </button>
        </div>
      </Panel>
    </>
  );
}

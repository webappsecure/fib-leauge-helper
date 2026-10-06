import Link from "next/link";
import { Panel, PageTitle, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageTitle title="Not found" />
      <Panel title="Nothing here">
        <div className="grid justify-items-start gap-3 p-3">
          <p className="text-muted">
            That page or league does not exist. It may have been removed.
          </p>
          <Link href="/" className={buttonClass.secondary}>
            Back to leagues
          </Link>
        </div>
      </Panel>
    </>
  );
}

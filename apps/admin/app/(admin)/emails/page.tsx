import Link from "next/link";

import { EmptyState, RelativeTime } from "@/components/ui";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TH = "px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const TD = "px-4 py-3.5 text-[14px]";

interface TemplateRow {
  key: string;
  name: string;
  description: string;
  subject: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
}

export default async function EmailsPage() {
  const service = createServiceClient();
  const { data } = await service
    .from("email_templates")
    .select("key,name,description,subject,version,updated_by,updated_at")
    .order("name", { ascending: true });
  const templates = (data ?? []) as TemplateRow[];

  return (
    <div className="data-in mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Emails</h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Transactional templates. Edits publish immediately, the workers render the branded
          layout and send the latest version.
        </p>
      </header>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Run the email_templates migration to seed the transactional templates."
        />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-line bg-surface/60">
              <tr>
                <th className={TH}>Template</th>
                <th className={TH}>Subject</th>
                <th className={TH}>Version</th>
                <th className={TH}>Last edited</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.key} className="border-b border-line/60 last:border-0 hover:bg-surface/50">
                  <td className={TD}>
                    <Link href={`/emails/${t.key}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                    <p className="text-[13px] text-ink-muted">{t.description}</p>
                  </td>
                  <td className={`${TD} text-ink-muted`}>{t.subject}</td>
                  <td className={TD}>v{t.version}</td>
                  <td className={`${TD} text-ink-muted`}>
                    <RelativeTime iso={t.updated_at} />
                    {t.updated_by ? ` · ${t.updated_by}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

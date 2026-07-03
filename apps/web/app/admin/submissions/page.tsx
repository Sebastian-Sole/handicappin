import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { H1, Muted } from "@/components/ui/typography";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin-authz";
import { env } from "@/env";
import { SubmissionsQueueClient } from "./client";

export const metadata = {
  title: "Pending Submissions | Handicappin",
};

/**
 * Admin moderation queue — operator tool, web-only by design
 * (declared in scripts/parity/routes.mjs INTENTIONAL.webOnly).
 *
 * Defense in depth: `adminProcedure` already gates every `admin.*` tRPC
 * call, but this page-level check stops a non-admin (or logged-out)
 * visitor before any admin UI renders or data is fetched. We deliberately
 * render `notFound()` (404) rather than a 403 page — the existence of an
 * admin console shouldn't be observable to non-admins.
 */
const AdminSubmissionsPage = async () => {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  if (!isAdminEmail(data.user?.email, env.ADMIN_EMAILS)) {
    notFound();
  }

  const submissions = await api.admin.listPendingSubmissions();

  return (
    <PageContainer>
      <div className="space-y-xs mb-lg">
        <H1>Pending submissions</H1>
        <Muted>
          Review community-submitted courses and tees awaiting approval.
        </Muted>
      </div>
      <SubmissionsQueueClient initialData={submissions} />
    </PageContainer>
  );
};

export default AdminSubmissionsPage;

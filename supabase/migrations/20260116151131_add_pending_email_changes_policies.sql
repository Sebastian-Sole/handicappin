-- migration: add missing rls policies for pending_email_changes table
-- purpose: enable authenticated users to manage their own email change requests
-- affected tables: pending_email_changes
-- security: ensures users can only access their own email change requests
-- related issue: missing INSERT, UPDATE, DELETE policies broke email change flow

-- policy: allow authenticated users to create their own pending email change requests
-- rationale: users need to be able to initiate email change flow
-- security: WITH CHECK ensures user_id matches authenticated user
create policy "Users can insert their own pending email changes"
on "pending_email_changes"
as permissive for insert
to authenticated
with check ((auth.uid()::uuid = user_id));

-- policy: allow authenticated users to update their own pending email change requests
-- rationale: needed for tracking verification attempts and updating request metadata
-- security: USING and WITH CHECK ensure user can only update their own records
create policy "Users can update their own pending email changes"
on "pending_email_changes"
as permissive for update
to authenticated
using ((auth.uid()::uuid = user_id))
with check ((auth.uid()::uuid = user_id));

-- policy: allow authenticated users to delete their own pending email change requests
-- rationale: users should be able to cancel pending email changes
-- security: USING ensures user can only delete their own records
create policy "Users can delete their own pending email changes"
on "pending_email_changes"
as permissive for delete
to authenticated
using ((auth.uid()::uuid = user_id));

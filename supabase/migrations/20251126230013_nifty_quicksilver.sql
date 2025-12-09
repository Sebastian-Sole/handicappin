ALTER POLICY "Users can update their own profile" ON "profile" TO authenticated USING ((auth.uid()::uuid = id)) WITH CHECK ((
        auth.uid()::uuid = id
        AND plan_selected IS NOT DISTINCT FROM (SELECT plan_selected FROM profile WHERE id = auth.uid())
        AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profile WHERE id = auth.uid())
        AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM profile WHERE id = auth.uid())
        AND cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM profile WHERE id = auth.uid())
        AND billing_version IS NOT DISTINCT FROM (SELECT billing_version FROM profile WHERE id = auth.uid())
      ));
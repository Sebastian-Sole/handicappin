import { createServerComponentClient } from "@/utils/supabase/server";
import { CalculatorsPageClient } from "./client";

export const metadata = {
  title: "Golf Calculators | Handicappin",
  description:
    "WHS-compliant golf calculators for handicap index, score differential, course handicap, and more.",
};

const CalculatorsPage = async () => {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's handicap index if available
  let userHandicapIndex: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profile")
      .select("handicapIndex")
      .eq("id", user.id)
      .single();
    userHandicapIndex = profile?.handicapIndex ?? null;
  }

  return <CalculatorsPageClient userHandicapIndex={userHandicapIndex} />;
};

export default CalculatorsPage;

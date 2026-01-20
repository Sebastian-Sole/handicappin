import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { profile, round, score, emailPreferences, course, teeInfo } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authRouter = createTRPCRouter({
  getProfileFromUserId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("profile")
        .select("*")
        .eq('id', input).single()

      // console.log(profileError)
      if (profileData) {
        console.log(`Profile fetched for user: ${input}`); // Email is no longer in profile - it's in auth.users
      }

      if (profileError) {
        throw new Error(`Error getting profile: ${profileError.message}`);
      }

      return profileData;
    }),
  updateProfile: authedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        // Email removed - it's stored in auth.users only
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Authorization check: users can only update their own profile
      if (input.id !== ctx.user.id) {
        throw new Error("Unauthorized: You can only update your own profile");
      }

      const { data: profileData, error: profileError } = await ctx.supabase
        .from("profile")
        .update({
          name: input.name,
        })
        .eq("id", input.id)
        .select();

      if (profileError) {
        console.log(profileError);
        throw new Error(`Error updating profile: ${profileError.message}`);
      }

      return profileData;
    }),

  // Get email preferences for authenticated user
  getEmailPreferences: authedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", ctx.user.id)
      .single();

    if (error) {
      // If no preferences exist yet, return defaults
      if (error.code === "PGRST116") {
        return {
          id: null,
          user_id: ctx.user.id,
          feature_updates: true,
          created_at: null,
          updated_at: null,
        };
      }

      console.error("Error fetching email preferences:", error);
      throw new Error(`Error fetching email preferences: ${error.message}`);
    }

    return data;
  }),

  // Update or insert email preferences
  updateEmailPreferences: authedProcedure
    .input(
      z.object({
        featureUpdates: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use upsert to handle both insert and update cases
      const { data, error } = await ctx.supabase
        .from("email_preferences")
        .upsert(
          {
            user_id: ctx.user.id,
            feature_updates: input.featureUpdates,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error updating email preferences:", error);
        throw new Error(`Error updating email preferences: ${error.message}`);
      }

      return data;
    }),

  // Get pending email change for authenticated user
  getPendingEmailChange: authedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from("pending_email_changes")
        .select("*")
        .eq("user_id", ctx.user.id)
        .single();

      if (error) {
        // No pending change found
        if (error.code === "PGRST116") {
          return null;
        }

        console.error("Error fetching pending email change:", error);
        throw new Error(`Error fetching pending email change: ${error.message}`);
      }

      return data;
    }),

  // Export all user data for GDPR compliance
  exportUserData: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    try {
      // Fetch profile data
      const profileData = await db.select().from(profile).where(eq(profile.id, userId)).limit(1);

      // Fetch all rounds with course and tee info
      const roundsData = await db
        .select({
          round: round,
          course: course,
          tee: teeInfo,
        })
        .from(round)
        .leftJoin(course, eq(round.courseId, course.id))
        .leftJoin(teeInfo, eq(round.teeId, teeInfo.id))
        .where(eq(round.userId, userId));

      // Fetch all scores
      const scoresData = await db.select().from(score).where(eq(score.userId, userId));

      // Fetch email preferences
      const preferencesData = await db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).limit(1);

      // Check if user has any meaningful data to export
      const hasData = profileData.length > 0 || roundsData.length > 0 || scoresData.length > 0;

      if (!hasData) {
        return {
          hasData: false as const,
          exportedAt: new Date().toISOString(),
        };
      }

      // Construct export object
      const exportData = {
        hasData: true as const,
        exportedAt: new Date().toISOString(),
        profile: profileData[0] ? {
          id: profileData[0].id,
          email: profileData[0].email,
          name: profileData[0].name,
          handicapIndex: profileData[0].handicapIndex,
          initialHandicapIndex: profileData[0].initialHandicapIndex,
          verified: profileData[0].verified,
          createdAt: profileData[0].createdAt,
          planSelected: profileData[0].planSelected,
          planSelectedAt: profileData[0].planSelectedAt,
        } : null,
        rounds: roundsData.map(r => ({
          id: r.round.id,
          playedAt: r.round.teeTime,
          courseName: r.course?.name,
          courseCity: r.course?.city,
          courseCountry: r.course?.country,
          teeName: r.tee?.name,
          teeGender: r.tee?.gender,
          holesPlayed: r.round.holesPlayed,
          totalStrokes: r.round.totalStrokes,
          adjustedGrossScore: r.round.adjustedGrossScore,
          scoreDifferential: r.round.scoreDifferential,
          courseHandicap: r.round.courseHandicap,
          courseRatingUsed: r.round.courseRatingUsed,
          slopeRatingUsed: r.round.slopeRatingUsed,
          notes: r.round.notes,
          createdAt: r.round.createdAt,
        })),
        scores: scoresData.map(s => ({
          id: s.id,
          roundId: s.roundId,
          holeId: s.holeId,
          strokes: s.strokes,
          hcpStrokes: s.hcpStrokes,
        })),
        emailPreferences: preferencesData[0] ? {
          featureUpdates: preferencesData[0].featureUpdates,
        } : null,
        totalRounds: roundsData.length,
      };

      return exportData;
    } catch (error) {
      console.error("Error exporting user data:", error);
      // Return no data response on error - user can retry
      return {
        hasData: false as const,
        exportedAt: new Date().toISOString(),
      };
    }
  }),
});

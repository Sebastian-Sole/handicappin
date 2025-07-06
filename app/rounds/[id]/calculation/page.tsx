import { RoundCalculation } from "@/components/round-calculation";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { Dialog, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { Signup } from "@/components/auth/signup";
import NotifyButton from "@/components/calculators/notify-button";

const RoundCalculationPage = async ({ params }: { params: { id: string } }) => {
  const { id: roundId } = params;

  if (!roundId) {
    return <div>Invalid round id</div>;
  }

  const supabase = createServerComponentClient();

  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <div>Invalid user</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-4 py-12">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏗️</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Round Calculation - Coming Soon!
        </h1>
        <p className="mt-4 dark:text-muted-foreground text-muted">
          We are hard at work building out our detailed round calculation page. We know you want to
          get started, but we&apos;re making sure that we get it right. Stay
          tuned!
        </p>
        {!data.user && (
          <div className="mt-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  Notify me when it is ready!
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <div className="flex items-center space-x-2">
                  <Signup
                    description="Sign up for our newsletter, and an account to get started!"
                    notify={true}
                  />
                </div>
                <DialogFooter className="sm:justify-center">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {data.user && <NotifyButton user={data.user} />}
      </div>
    </div>
  )

  const scorecard = await api.scorecard.getScorecardByRoundId({ id: roundId });

  if (!scorecard) {
    return <div> Round not found </div>;
  }

  // Todo: Test this logic
  if (scorecard.userId !== userId) {
    return <div> This round does not belong to you </div>;
  }

  

  // return (
  //   <div>
  //     <RoundCalculation scorecard={scorecard} />
  //   </div>
  // );
};

export default RoundCalculationPage;

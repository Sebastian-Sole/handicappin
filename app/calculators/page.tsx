import { Signup } from "@/components/auth/signup";
import NotifyButton from "@/components/calculators/notify-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { createServerComponentClient } from "@/utils/supabase/server";
import { DialogTrigger } from "@radix-ui/react-dialog";

const CalculatorsPage = async () => {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-4 py-12">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏗️</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Calculators - Coming Soon!
        </h1>
        <p className="mt-4">
          We are hard at work building out our calculators. We know you want to
          get started, but we&apos;re making sure that we get it right. Stay
          tuned!
        </p>
        {!user && (
          <div className="mt-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  Notify me when they are ready!
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
        {user && <NotifyButton user={user} />}
      </div>
    </div>
  );
};

export default CalculatorsPage;

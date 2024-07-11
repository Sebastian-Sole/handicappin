import AddRoundForm from "@/components/round/addRoundForm";
import { createServerComponentClient } from "@/utils/supabase/server";

const AddRoundPage = async () => {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  return (
    <div className="flex justify-center items-center h-full">
      <AddRoundForm userId={userId} />
    </div>
  );
};

export default AddRoundPage;

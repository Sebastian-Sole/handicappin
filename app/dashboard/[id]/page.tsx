import { Dashboard } from "@/components/dashboard";

const DashboardPage = async ({ params }: { params: { id: string } }) => {
  const { id } = params;

  if (!id) {
    return <div>Invalid user id</div>;
  }

  return (
    <div>
      <Dashboard userId={id} />
    </div>
  );
};

export default DashboardPage;

import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/store";

export default async function HomePage() {
  const initialData = await getDashboardData();
  return <Dashboard initialData={initialData} />;
}

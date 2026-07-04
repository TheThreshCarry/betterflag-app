import { FlagDetail } from "@/components/flag-detail";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FlagDetail flagId={id} />;
}

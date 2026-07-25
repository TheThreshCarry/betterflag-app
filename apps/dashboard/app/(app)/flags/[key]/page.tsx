import { FlagDetail } from "@/components/flag-detail";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <FlagDetail flagKey={key} />;
}

import { KeysView } from "@/components/keys-view";
import { loadOrgKeys } from "@/lib/keys";

export default async function KeysPage() {
  const keys = await loadOrgKeys();
  return <KeysView initialKeys={keys} />;
}

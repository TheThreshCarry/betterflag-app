import { CommandK } from "@/components/command-k"

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <CommandK />
    </>
  )
}

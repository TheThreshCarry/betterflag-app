import { DashboardLayout } from "@/components/dashboard-layout"
import { CustomersClient } from "./customers-client"
import { getCustomers } from "@/lib/actions/customers"

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Customers" },
      ]}
    >
      <CustomersClient initialCustomers={customers} />
    </DashboardLayout>
  )
}

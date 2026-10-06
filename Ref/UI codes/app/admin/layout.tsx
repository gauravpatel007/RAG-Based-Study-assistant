import Sidebar from '@/components/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar role="admin" />
      <main className="main-content">
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}

import AdminStorageTab from '@/components/AdminStorageTab';
import { HardDrive } from 'lucide-react';

export default function AdminStorage() {
  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          background: 'rgba(249, 115, 22, 0.1)',
          color: '#f97316',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <HardDrive size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Storage Administration</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Monitor disk usage across PDFs, ChromaDB, and PostgreSQL, with safe maintenance tools.
          </p>
        </div>
      </div>
      <AdminStorageTab />
    </div>
  );
}

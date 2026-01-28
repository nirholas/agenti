'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Invoice type
interface Invoice {
  id: string;
  number: string;
  amount: string;
  currency: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  customer: {
    name?: string;
    email?: string;
    address?: string;
  };
  dueDate: Date;
  createdAt: Date;
  paidAt?: Date;
  memo?: string;
}

// Mock invoices
const MOCK_INVOICES: Invoice[] = [
  {
    id: '1',
    number: 'INV-001',
    amount: '1,500.00',
    currency: 'USDC',
    status: 'paid',
    customer: { name: 'Acme Corp', email: 'billing@acme.com', address: '0x1234...5678' },
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    memo: 'Monthly subscription'
  },
  {
    id: '2',
    number: 'INV-002',
    amount: '750.00',
    currency: 'USDC',
    status: 'pending',
    customer: { name: 'Tech Startup', email: 'pay@techstartup.io' },
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    memo: 'API Integration'
  },
  {
    id: '3',
    number: 'INV-003',
    amount: '2,250.00',
    currency: 'USDC',
    status: 'overdue',
    customer: { name: 'Global Industries', address: '0xabcd...efgh' },
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
    memo: 'Enterprise license'
  },
  {
    id: '4',
    number: 'INV-004',
    amount: '500.00',
    currency: 'USDC',
    status: 'pending',
    customer: { name: 'Freelancer', email: 'dev@freelancer.com' },
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
  },
  {
    id: '5',
    number: 'INV-005',
    amount: '3,000.00',
    currency: 'USDC',
    status: 'cancelled',
    customer: { name: 'Old Client' },
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
  },
];

export default function InvoicesPage() {
  const [mounted, setMounted] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const filteredInvoices = invoices.filter(inv => {
    const matchesFilter = filter === 'all' || inv.status === filter;
    const matchesSearch = !searchQuery || 
      inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <span className="badge badge-success">Paid</span>;
      case 'pending':
        return <span className="badge badge-info">Pending</span>;
      case 'overdue':
        return <span className="badge badge-error">Overdue</span>;
      case 'cancelled':
        return <span className="badge badge-neutral">Cancelled</span>;
    }
  };

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => i.status === 'pending').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-semibold tracking-tight">Agenti</span>
            </Link>
            <span className="text-zinc-600 mx-2">/</span>
            <span className="text-zinc-400">Invoices</span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/merchant" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/merchant/invoices" className="text-white font-medium">Invoices</Link>
            <Link href="/merchant/analytics" className="text-zinc-400 hover:text-white transition-colors">Analytics</Link>
            <Link href="/merchant/settings" className="text-zinc-400 hover:text-white transition-colors">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Invoices</h1>
            <p className="text-zinc-500">Manage and track your payment requests</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Invoice
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <button 
            onClick={() => setFilter('all')}
            className={`p-4 rounded-xl border transition-colors text-left ${
              filter === 'all' ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm text-zinc-500 mb-1">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </button>
          <button 
            onClick={() => setFilter('paid')}
            className={`p-4 rounded-xl border transition-colors text-left ${
              filter === 'paid' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm text-zinc-500 mb-1">Paid</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.paid}</p>
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`p-4 rounded-xl border transition-colors text-left ${
              filter === 'pending' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm text-zinc-500 mb-1">Pending</p>
            <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
          </button>
          <button 
            onClick={() => setFilter('overdue')}
            className={`p-4 rounded-xl border transition-colors text-left ${
              filter === 'overdue' ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm text-zinc-500 mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="input-group max-w-md">
            <span className="input-icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              className="input"
              placeholder="Search by invoice number, customer name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Invoice Table */}
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Invoice</th>
                <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Customer</th>
                <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Amount</th>
                <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Status</th>
                <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Due Date</th>
                <th className="text-right text-xs text-zinc-500 uppercase tracking-wider px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
                      <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-zinc-500">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{invoice.number}</p>
                        {invoice.memo && (
                          <p className="text-sm text-zinc-500">{invoice.memo}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{invoice.customer.name || 'Anonymous'}</p>
                        <p className="text-sm text-zinc-500">
                          {invoice.customer.email || invoice.customer.address || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">${invoice.amount}</p>
                      <p className="text-sm text-zinc-500">{invoice.currency}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white" title="Copy Link">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                        <button className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white" title="Download">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white" title="More">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// Create Invoice Modal Component
function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle invoice creation
    console.log({ amount, customerName, customerEmail, memo, dueDate });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Invoice</h2>
          <button className="modal-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                <input
                  type="number"
                  className="input pl-8"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Customer Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            {/* Customer Email */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Customer Email</label>
              <input
                type="email"
                className="input"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Due Date</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Memo */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Memo (optional)</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Add a note for this invoice"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

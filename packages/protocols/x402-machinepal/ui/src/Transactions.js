import React from 'react';

function Transactions() {
  const formatDate = (offsetDays = 0, time = '12:00') => {
    const date = new Date();
    date.setDate(date.getDate() - offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${time}`;
  };

  const transactions = [
    { id: 'tx_001', date: formatDate(0, '14:30'), amount: '0.05 ETH', status: 'Completed', recipient: '0x123...abc' },
    { id: 'tx_002', date: formatDate(0, '12:15'), amount: '1.20 ETH', status: 'Pending', recipient: '0x456...def' },
    { id: 'tx_003', date: formatDate(1, '09:45'), amount: '0.01 ETH', status: 'Completed', recipient: '0x789...ghi' },
    { id: 'tx_004', date: formatDate(2, '18:20'), amount: '0.50 ETH', status: 'Failed', recipient: '0xabc...123' },
    { id: 'tx_005', date: formatDate(2, '11:10'), amount: '0.15 ETH', status: 'Completed', recipient: '0xdef...456' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Transactions</h1>
        <button className="btn">Export CSV</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'monospace' }}>{tx.id}</td>
                  <td>{tx.date}</td>
                  <td style={{ fontFamily: 'monospace' }}>{tx.recipient}</td>
                  <td>{tx.amount}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: tx.status === 'Completed' ? 'rgba(40, 167, 69, 0.2)' :
                                      tx.status === 'Pending' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                      color: tx.status === 'Completed' ? '#28a745' :
                             tx.status === 'Pending' ? '#ffc107' : '#dc3545'
                    }}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Transactions;


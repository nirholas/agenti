import React, { useState } from 'react';

function Reports() {
  const [reportType, setReportType] = useState('daily');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastReport, setLastReport] = useState(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
      setIsGenerating(false);
      setLastReport({
        id: Math.floor(Math.random() * 1000),
        date: new Date().toLocaleString(),
        type: reportType,
        status: 'Success'
      });
    }, 1500);
  };

  return (
    <div>
      <h1>Reports</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Generate and view system reports.</p>

      <div className="card">
        <h3>Generate New Report</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' }}>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="daily">Daily Summary</option>
            <option value="weekly">Weekly Analysis</option>
            <option value="monthly">Monthly Audit</option>
            <option value="transactions">Transaction Log</option>
          </select>

          <button
            className="btn"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ opacity: isGenerating ? 0.7 : 1 }}
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {lastReport && (
        <div className="card">
          <h3>Last Generated Report</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Date Generated</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#{lastReport.id}</td>
                  <td>{lastReport.date}</td>
                  <td style={{ textTransform: 'capitalize' }}>{lastReport.type}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: 'rgba(40, 167, 69, 0.2)',
                      color: '#28a745'
                    }}>
                      {lastReport.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn" style={{ padding: '5px 10px', fontSize: '12px' }}>Download PDF</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;


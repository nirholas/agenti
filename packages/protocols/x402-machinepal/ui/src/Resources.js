import React from 'react';

function Resources() {
  const resources = [
    { id: 1, name: 'Documentation', type: 'Link', url: 'https://docs.machinepal.io' },
    { id: 2, name: 'API Reference', type: 'Link', url: 'https://api.machinepal.io' },
    { id: 3, name: 'Community Forum', type: 'Link', url: 'https://forum.machinepal.io' },
    { id: 4, name: 'GitHub Repository', type: 'Link', url: 'https://github.com/skalenetwork/machinepal' },
    { id: 5, name: 'Whitepaper', type: 'PDF', url: '/assets/whitepaper.pdf' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Resources</h1>
        <button className="btn">Add Resource</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>URL</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td style={{ fontWeight: 'bold' }}>{resource.name}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: 'rgba(0, 122, 204, 0.2)',
                      color: '#007acc'
                    }}>
                      {resource.type}
                    </span>
                  </td>
                  <td>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                      {resource.url}
                    </a>
                  </td>
                  <td>
                    <button className="btn" style={{ padding: '5px 10px', fontSize: '12px' }}>View</button>
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

export default Resources;


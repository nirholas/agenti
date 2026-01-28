'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface SchemaField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
}

const FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
];

export default function AddToolPage() {
  const router = useRouter();
  const params = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toolType, setToolType] = useState<'http' | 'code'>('http');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '0.01',
    endpoint: '',
    code: `// Your tool handler function
async function handler(params) {
  // Access params.input for user input
  const { query } = params.input;
  
  // Your logic here
  const result = await fetch(\`https://api.example.com/data?q=\${query}\`);
  const data = await result.json();
  
  return {
    success: true,
    data: data
  };
}`,
  });

  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([
    { id: '1', name: 'query', type: 'string', required: true, description: 'Search query' },
  ]);

  const addField = () => {
    setSchemaFields(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', type: 'string', required: false, description: '' },
    ]);
  };

  const updateField = (id: string, updates: Partial<SchemaField>) => {
    setSchemaFields(prev => prev.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const removeField = (id: string) => {
    setSchemaFields(prev => prev.filter(field => field.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push(`/dashboard/servers/${params.id}`);
    } catch (error) {
      console.error('Failed to create tool:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/50 mb-6">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/servers/${params.id}`} className="hover:text-white transition-colors">Server</Link>
        <span>/</span>
        <span className="text-white">New Tool</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Add New Tool</h1>
          <p className="mt-1 text-sm text-white/60">
            Create a new tool for your MCP server
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-white">Basic Information</h2>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Tool Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="get_token_price"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-2 text-xs text-white/40">Lowercase, underscores only. This is how AI agents will call your tool.</p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this tool does..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-white mb-2">
                Price per Call
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">$</span>
                <input
                  type="number"
                  id="price"
                  min="0"
                  max="10"
                  step="0.001"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <p className="mt-2 text-xs text-white/40">$0.00 - $10.00 per call. You earn 80% after platform fees.</p>
            </div>
          </section>

          {/* Tool Type */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-white">Tool Type</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setToolType('http')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  toolType === 'http'
                    ? 'bg-white/10 border-white/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <p className="font-medium text-white">HTTP Endpoint</p>
                <p className="text-xs text-white/50 mt-1">Call an external API endpoint</p>
              </button>

              <button
                type="button"
                onClick={() => setToolType('code')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  toolType === 'code'
                    ? 'bg-white/10 border-white/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <p className="font-medium text-white">Custom Code</p>
                <p className="text-xs text-white/50 mt-1">Run JavaScript on our servers</p>
              </button>
            </div>

            {toolType === 'http' && (
              <div>
                <label htmlFor="endpoint" className="block text-sm font-medium text-white mb-2">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  id="endpoint"
                  value={formData.endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1/data"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            )}

            {toolType === 'code' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Handler Code
                </label>
                <textarea
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  rows={12}
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                  spellCheck={false}
                />
              </div>
            )}
          </section>

          {/* Input Schema */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Input Schema</h2>
              <button
                type="button"
                onClick={addField}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                + Add field
              </button>
            </div>

            <div className="space-y-3">
              {schemaFields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Name</label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder="field_name"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Type</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as SchemaField['type'] })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {FIELD_TYPES.map(type => (
                          <option key={type.value} value={type.value} className="bg-zinc-900">
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Description</label>
                      <input
                        type="text"
                        value={field.description}
                        onChange={(e) => updateField(field.id, { description: e.target.value })}
                        placeholder="What this field is for"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/20"
                        />
                        <span className="text-xs text-white/60">Required</span>
                      </label>
                      {schemaFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Tool'
              )}
            </button>
            <Link
              href={`/dashboard/servers/${params.id}`}
              className="px-6 py-3 text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

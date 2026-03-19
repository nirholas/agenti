interface ApiEndpointProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description?: string;
}

const methodColors = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function ApiEndpoint({ method, path, description }: ApiEndpointProps) {
  return (
    <div className="border rounded-lg p-4 my-4 bg-muted/50">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono">{path}</code>
      </div>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

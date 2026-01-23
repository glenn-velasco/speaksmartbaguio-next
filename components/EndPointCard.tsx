'use client';

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  params: string[];
}

export default function EndpointCard({ method, path, description, params }: EndpointProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded">
          {method}
        </span>
      </div>
      
      <h3 className="text-lg font-mono font-semibold text-gray-800 dark:text-gray-100 break-all">
        {path}
      </h3>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {params.map(param => (
          <span key={param} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
            {param}
          </span>
        ))}
      </div>

      <a 
        href={path}
        target="_blank"
        className="inline-block w-full text-center bg-gray-900 dark:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-blue-500 transition-colors"
      >
        Try Endpoint
      </a>
    </div>
  );
}
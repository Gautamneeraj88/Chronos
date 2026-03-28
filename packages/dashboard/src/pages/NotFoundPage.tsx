import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl font-semibold text-gray-700 mt-2">Page not found</p>
        <p className="text-gray-500 mt-1 text-sm">The page you were looking for doesn't exist.</p>
        <Link to="/workflows" className="inline-block mt-4">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

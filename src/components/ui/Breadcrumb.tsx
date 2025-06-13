import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />
            )}
            
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  "flex items-center hover:text-purple-600 transition-colors",
                  index === items.length - 1 
                    ? "font-medium text-gray-800" 
                    : "text-gray-500"
                )}
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </Link>
            ) : (
              <span className={cn(
                "flex items-center",
                index === items.length - 1 
                  ? "font-medium text-gray-800" 
                  : "text-gray-500"
              )}>
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
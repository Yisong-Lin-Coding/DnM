import React, { useState, createContext, useContext } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const CardContext = createContext();
export function Card({ children, className = "", defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <CardContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={`rounded-lg shadow-md border overflow-hidden transition-all duration-200 hover:shadow-lg ${className}`}>
        {children}
      </div>
    </CardContext.Provider>
  );
}
Card.Header = function CardHeader({ children, className = "" }) {
  const { isOpen, setIsOpen } = useContext(CardContext);
  
  return (
    <div 
      className={`p-4 cursor-pointer flex justify-between items-center transition-colors duration-200 ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex-1">
        {children}
      </div>
      <div className="transition-transform duration-200 ml-4">
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
      </div>
    </div>
  );
};
Card.Content = function CardContent({ children, className = "" }) {
  const { isOpen } = useContext(CardContext);
  
  return (
    <div className={`transition-all duration-300 ease-in-out overflow-hidden 
      ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className={`p-4 ${className}`}>
        {children}
      </div>
    </div>
  );
};
Card.Title = function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`font-semibold text-website-default-100 text-lg ${className}`}>
      {children}
    </h3>
  );
};

Card.Description = function CardDescription({ children, className = "" }) {
  return (
    <h3 className={`text-website-default-300 text-xs ${className}`}>
      {children}
    </h3>
  );
};
Card.Actions = function CardActions({ children, className = "" }) {
  return (
    <div className={`flex gap-2 ml-4 ${className}`} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
};
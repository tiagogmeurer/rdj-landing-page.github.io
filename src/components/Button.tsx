import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '',
  ...props 
}) => {
  const baseStyles = "py-4 px-8 rounded-full font-display font-bold text-lg uppercase tracking-wider transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,0,127,0.3)] hover:shadow-[0_0_30px_rgba(255,0,127,0.6)]";
  
  const variants = {
    primary: "bg-gradient-to-r from-brand-pink to-brand-accent text-white border-none animate-pulse-slow",
    secondary: "bg-transparent border-2 border-brand-pink text-brand-pink hover:bg-brand-pink hover:text-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
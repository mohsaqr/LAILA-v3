import { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const helpTextId = `${inputId}-help`;
    const errorId = `${inputId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helpText ? helpTextId : undefined
          }
          className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
            error
              ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:border-red-600'
              : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={helpTextId} className="text-sm text-gray-500 dark:text-gray-400">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helpText, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const helpTextId = `${inputId}-help`;
    const errorId = `${inputId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helpText ? helpTextId : undefined
          }
          className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
            error
              ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:border-red-600'
              : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={helpTextId} className="text-sm text-gray-500 dark:text-gray-400">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helpText, options, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const helpTextId = `${inputId}-help`;
    const errorId = `${inputId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helpText ? helpTextId : undefined
          }
          className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
            error
              ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:border-red-600'
              : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${className}`}
          {...props}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-sm text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={helpTextId} className="text-sm text-gray-500 dark:text-gray-400">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

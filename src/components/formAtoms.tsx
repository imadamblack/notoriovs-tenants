'use client';

import { useFormContext } from 'react-hook-form';
import type { RegisterOptions } from 'react-hook-form';

export type FormAtomOption = {
  value: string;
  label: string;
};

type SelectProps = {
  name: string;
  inputOptions?: RegisterOptions;
  options: FormAtomOption[];
  placeholder?: string;
  className?: string;
};

export const Select = ({name, inputOptions, options, placeholder, className = ''}: SelectProps) => {
  const {register} = useFormContext();

  return (
    <div className="select">
      <select
        {...register(name, inputOptions)}
        defaultValue=""
        className={className}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
};

type ChoiceProps = {
  name: string;
  inputOptions?: RegisterOptions;
  options: FormAtomOption[];
  optCols?: number;
  className?: string;
};

export const Radio = ({name, inputOptions, options, optCols = 1, className = ''}: ChoiceProps) => {
  const {register} = useFormContext();

  return (
    <div className="radio">
      <fieldset
        className={`w-full grid grid-cols-3 gap-4`}
        style={{gridTemplateColumns: `repeat(${optCols}, minmax(0, 1fr))`}}
      >
        {options.map((opt) => (
          <div key={opt.value} className="flex items-stretch">
            <input
              {...register(name, inputOptions)}
              type="radio" id={`${name}-${opt.value}`} value={opt.value} />
            <label htmlFor={`${name}-${opt.value}`} className={className}>{opt.label}</label>
          </div>
        ))}
      </fieldset>
    </div>
  );
};

export const Checkbox = ({name, inputOptions, options, optCols = 1, className = ''}: ChoiceProps) => {
  const {register} = useFormContext();

  return (
    <div className="radio">
      <fieldset
        className={`w-full grid grid-cols-3 gap-4`}
        style={{gridTemplateColumns: `repeat(${optCols}, minmax(0, 1fr))`}}
      >
        {options.map((opt) => (
          <div key={opt.value} className="flex items-stretch">
            <input
              {...register(name, inputOptions)}
              type="checkbox" id={`${name}-${opt.value}`} value={opt.value} />
            <label htmlFor={`${name}-${opt.value}`} className={className}>{opt.label}</label>
          </div>
        ))}
      </fieldset>
    </div>
  );
};

'use client';

import type { ReactNode } from 'react';
import type { FieldErrors, RegisterOptions, UseFormRegister } from 'react-hook-form';
import { Checkbox, Radio, Select, type FormAtomOption } from './formAtoms';
import { restrictNumber } from '@/utils/formValidators';
import { MEXICO_STATES } from '@/utils/mexicoStates';
import Link from 'next/link';

export type SurveyOptInField = {
  name: string;
  type: string;
  title?: string;
  inputOptions?: RegisterOptions;
};

export type SurveyStep = {
  type: 'text' | 'tel' | 'number' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'state-mx' | 'opt-in' | 'checkpoint';
  name?: string;
  title?: string;
  description?: string;
  placeholder?: string;
  inputOptions?: RegisterOptions;
  options?: FormAtomOption[];
  cols?: number;
  fields?: SurveyOptInField[];
  render?: () => ReactNode;
  autoAdvance?: boolean;
  // Contenido HTML para pasos tipo 'checkpoint' editado con el WYSIWYG del
  // CMS (Payload lo serializa a HTML). Si `render` está definido
  // (checkpoints codificados a mano), `render` tiene prioridad.
  html?: string;
};

type StepRendererProps = {
  step: SurveyStep;
  index?: number;
  currentStep?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // El caller (tenant-site/[subdomain]/survey) debe pasar el aviso de
  // privacidad propio del tenant (tenant.generalInfo.privacyNoticeUrl).
  privacyNoticeHref?: string;
};

export default function StepRenderer({
  step,
  index,
  currentStep,
  errors,
  register,
  privacyNoticeHref = '/privacy-notice',
}: StepRendererProps) {
  if (index !== currentStep) return null;

  const commonText = (
    <div className="mb-8">
      <p className="ft-4 sans font-bold" dangerouslySetInnerHTML={{ __html: step.title || '' }} />
      {step.description && (
        <p className="ft-2 mt-4" dangerouslySetInnerHTML={{ __html: step.description }} />
      )}
    </div>
  );

  switch (step.type) {
    case 'text':
    case 'tel':
    case 'number':
      return (
        <div className="flex-grow">
          {commonText}
          <input
            {...register(step.name as string, step.inputOptions)}
            type={step.type}
            placeholder={step.placeholder}
            onKeyDown={step.type !== 'text' ? restrictNumber : undefined}
            className={errors[step.name as string]?.message ? '!border-red-500 mt-12' : 'mt-12'}
          />
          <p className="-ft-2 mt-4 text-red-500 font-medium">
            {errors[step.name as string]?.message as string | undefined}
          </p>
        </div>
      );

    case 'textarea':
      return (
        <div className="flex-grow">
          {commonText}
          <textarea
            {...register(step.name as string, step.inputOptions)}
            placeholder={step.placeholder}
            rows={step.cols || 4}
            className={errors[step.name as string]?.message ? '!border-red-500 mt-12' : 'mt-12'}
          />
        </div>
      );

    case 'radio':
      return (
        <div className="flex flex-col">
          {commonText}
          <Radio
            name={step.name as string}
            inputOptions={step.inputOptions}
            options={step.options || []}
            optCols={step.cols}
            className={errors[step.name as string]?.message ? '!border-red-500' : undefined}
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex flex-col">
          {commonText}
          <Checkbox
            name={step.name as string}
            inputOptions={step.inputOptions}
            options={step.options || []}
            optCols={step.cols}
            className={errors[step.name as string]?.message ? '!border-red-500' : undefined}
          />
        </div>
      );

    case 'select':
      return (
        <div className="flex flex-col">
          {commonText}
          <Select
            name={step.name as string}
            inputOptions={step.inputOptions}
            placeholder={step.placeholder}
            options={step.options || []}
            className={errors[step.name as string]?.message ? '!border-red-500' : undefined}
          />
        </div>
      );

    case 'state-mx':
      return (
        <div className="flex flex-col">
          {commonText}
          <Select
            name={step.name as string}
            inputOptions={step.inputOptions}
            placeholder={step.placeholder || 'Selecciona tu estado'}
            options={MEXICO_STATES as unknown as FormAtomOption[]}
            className={errors[step.name as string]?.message ? '!border-red-500' : undefined}
          />
        </div>
      );

    case 'opt-in':
      return (
        <div className="flex flex-col gap-8 bg-blue-200 p-12 rounded-3xl">
          <div>
            <p className="ft-4 sans font-bold text-brand-1" dangerouslySetInnerHTML={{ __html: step.title || '' }} />
            {step.description && (
              <p className="ft-2 mt-4 text-brand-1" dangerouslySetInnerHTML={{ __html: step.description }} />
            )}
          </div>
          {step.fields?.map((field) => (
            <div key={field.name}>
              <input
                type={field.type}
                {...register(field.name, field.inputOptions)}
                placeholder={field.title}
                onKeyDown={field.type === 'tel' ? restrictNumber : undefined}
                className={errors[field.name]?.message ? '!border-red-500' : ''}
              />
              <p className="-ft-2 text-red-500 font-medium">
                {errors[field.name]?.message as string | undefined}
              </p>
            </div>
          ))}
          <div className="mt-4">
            <p className="-ft-3 text-center text-brand-1">Tus datos no serán compartidos, al continuar aceptas nuestra&nbsp;
              <Link href={privacyNoticeHref}>política de privacidad</Link>
            </p>
          </div>
        </div>
      );

    case 'checkpoint':
      if (step.render) return step.render();
      if (step.html) return <div className="checkpoint-content" dangerouslySetInnerHTML={{ __html: step.html }} />;
      return null;

    default:
      return null;
  }
}

'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepRenderer, { type SurveyStep } from '@/components/stepRenderer';
import fbEvent, { gtagSendEvent } from '@/services/fbEvents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SurveyFormValues = Record<string, any>;

type TenantSurveyProps = {
  subdomain: string;
  steps: SurveyStep[];
  thankYouPath?: string;
};

/**
 * Versión multi-tenant de /src/app/(frontend)/survey/page.tsx: misma lógica
 * de navegación entre pasos, validación y tracking, pero los `steps` vienen
 * del tenant (Payload -> mapTenantQuizToSurveySteps) y el envío final se hace
 * contra /api/quiz-submit (que reenvía a los webhooks configurados en el
 * tenant) en lugar de pegarle directo a un webhook hardcodeado.
 */
export default function TenantSurvey({ subdomain, steps, thankYouPath = 'thankyou' }: TenantSurveyProps) {
  const [formStep, setFormStep] = useState(0);
  const [sending, setSending] = useState(false);
  const methods = useForm<SurveyFormValues>({ mode: 'all' });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;
  const router = useRouter();

  useEffect(() => {
    const current = steps[formStep];
    if (current?.autoAdvance) {
      const timer = setTimeout(() => {
        setFormStep((prev) => Math.min(prev + 1, steps.length - 1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [formStep, steps]);

  useEffect(() => {
    const step = steps[formStep];
    if (step?.type === 'checkpoint' && step.name) {
      fbEvent(step.name);
      if (typeof window !== 'undefined') {
        window.gtag?.('event', step.name.replace('-', '_'));
      }
    }
  }, [formStep, steps]);

  if (!steps.length) return null;

  const lastInputIndex = steps.reduce((lastIndex, step, i) => {
    return step.type !== 'checkpoint' ? i : lastIndex;
  }, 0);

  const handleNext = async () => {
    const currentStep = steps[formStep];

    if (currentStep.type === 'checkpoint') {
      return setFormStep((prev) => Math.min(prev + 1, steps.length - 1));
    }

    const valid = await methods.trigger(currentStep.name as string);
    if (!valid) return;

    window.scrollTo(0, 0);
    setFormStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const onSubmit = async (data: SurveyFormValues) => {
    setSending(true);
    try {
      const res = await fetch('/api/quiz-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, answers: data, contact: data }),
      });
      const resJson = await res.json().catch(() => ({}));

      fbEvent('Lead', { email: data.email, phone: data.whatsapp, externalID: resJson.id });
      gtagSendEvent('', { fullName: data.fullName, phone: data.whatsapp });

      await router.push(`/${thankYouPath}`);
    } catch (err) {
      console.error('Error al enviar el quiz:', err);
      await router.push(`/${thankYouPath}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative flex flex-col flex-grow bg-gradient-to-t from-blue-50 to-white">
      <div className="flex flex-col flex-grow pb-[8rem]">
        <div className="sticky top-0 bg-white mx-auto w-full max-w-[56rem] p-8 z-10">
          <div className="relative bg-gray-200 overflow-hidden">
            <div className="h-4 bg-brand-1" style={{ width: `${((formStep + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
        <div className="relative container !px-0 md:pb-0 flex flex-col flex-grow md:flex-grow-0 items-center pointer-events-auto touch-auto">
          <div className="survey-card">
            <FormProvider {...methods}>
              <form className="flex flex-col flex-grow" onSubmit={handleSubmit(onSubmit)}>
                <StepRenderer
                  step={steps[formStep]}
                  index={formStep}
                  currentStep={formStep}
                  errors={errors}
                  register={register}
                />
                <div
                  className={`fixed p-8 bottom-0 inset-x-0 grid ${steps[formStep].type === 'checkpoint' ? 'grid-cols-1' : 'grid-cols-2'} gap-8 w-full mt-auto bg-white border-t-2 border-gray-200 z-50`}
                >
                  {steps[formStep].type !== 'checkpoint' && (
                    <button
                      type="button"
                      onClick={() => setFormStep(formStep - 1)}
                      className="!bg-transparent !text-brand-1 border-none !w-full hover:text-brand-1 disabled:!text-gray-100"
                      disabled={formStep <= 0}
                    >
                      Atrás
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      if (formStep === lastInputIndex) {
                        handleSubmit(onSubmit)();
                      } else {
                        handleNext();
                      }
                    }}
                    className="mt-auto !w-full !bg-neutral-900 !text-neutral-100 !hover:bg-brand-1 !no-underline"
                  >
                    {sending && <span className="animate-spin mr-4">+</span>}
                    {formStep === lastInputIndex ? 'Enviar' : '→'}
                  </button>
                </div>
              </form>
            </FormProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import {useForm, FormProvider} from 'react-hook-form';
import {useEffect, useMemo, useState} from 'react';
import {useSearchParams, useRouter} from 'next/navigation';
import {setCookie} from 'cookies-next';
import Image from 'next/image';
import {motion, AnimatePresence} from 'framer-motion';
import StepRenderer, {type SurveyStep} from '@/components/stepRenderer';
import fbEvent, {gtagSendEvent} from '@/services/fbEvents';
import getTrackingData from '@/services/tracking-cookies';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SurveyFormValues = Record<string, any>;

type QuizIntro = {
  title?: string | null;
  description?: string | null;
  image?: unknown;
  ctaLabel?: string | null;
};

type SurveyFormProps = {
  subdomain: string;
  steps: SurveyStep[];
  intro?: QuizIntro;
  privacyNoticeUrl: string;
  logo?: unknown;
  tenantName?: string;
};

export default function SurveyForm({subdomain, steps, intro, privacyNoticeUrl, logo, tenantName}: SurveyFormProps) {
  const hasIntro = Boolean(intro?.title || intro?.description);
  const [started, setStarted] = useState(!hasIntro);
  const [formStep, setFormStep] = useState(0);
  const [sending, setSending] = useState(false);
  const methods = useForm<SurveyFormValues>({mode: 'all'});
  const {
    register,
    handleSubmit,
    formState: {errors},
  } = methods;
  const searchParams = useSearchParams();
  const router = useRouter();

  const {utm} = useMemo(() => getTrackingData(searchParams), [searchParams]);

  useEffect(() => {
    if (!started) return;
    const current = steps[formStep];

    if (current?.autoAdvance) {
      const timer = setTimeout(() => {
        setFormStep((prev) => Math.min(prev + 1, steps.length - 1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [formStep, started, steps]);

  useEffect(() => {
    if (!started) return;
    const step = steps[formStep];

    if (step?.type === 'checkpoint' && step.name) {
      fbEvent(step.name);
      if (typeof window !== 'undefined') {
        window.gtag?.('event', step.name.replace('-', '_'));
      }
    }
  }, [formStep, started, steps]);

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
      if (typeof data.telefono === 'string' && data.telefono.trim() !== '') {
        data.whatsapp = '521' + data.telefono.replace(/^\+?((MX)?\s?(52)?)?\s?0?1?|\s|\(|\)|-/g, '');
      }
      const res = await fetch('/api/quiz-submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subdomain, answers: data, utm}),
      });
      const resJson = await res.json().catch(() => ({}));

      fbEvent('Lead', {email: data.email, phone: data.whatsapp, externalID: resJson.id});
      gtagSendEvent('', {fullName: data.fullName, phone: data.whatsapp});
      setCookie('lead', {...data, id: resJson.id, utm});

      await router.push('thankyou');
    } catch (err) {
      console.error('Error al enviar el quiz:', err);
      await router.push('thankyou');
    } finally {
      setSending(false);
    }
  };

  if (!started) {
    return (
      <>
        <motion.div
          key="intro"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.5}}
          className="relative bg-brand-1 flex-grow flex flex-col items-center justify-center py-32"
        >
          {intro?.image != null && typeof intro.image === 'object' && (
            <div className="absolute w-full inset-0 z-0">
              <Image
                src={(intro.image as { url?: string }).url || ''}
                alt=""
                fill
                style={{
                  objectFit: 'cover',
                  objectPosition: `${(intro.image as { focalX?: number }).focalX ?? 50}% ${(intro.image as { focalY?: number }).focalY ?? 50}%`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/60 via-transparent via-75% to-transparent"/>
            </div>
          )}
          <div className="container flex flex-col flex-grow max-w-2xl z-10">
            {logo != null && typeof logo === 'object' ? (
              <div className="relative w-40 h-16 z-10 mb-8">
                <Image
                  src={(logo as {url?: string}).url || ''}
                  alt=""
                  fill
                  style={{objectFit: 'contain', filter: 'brightness(100)'}}
                />
              </div>
            ) : (
              tenantName && (
                <p className="ft-3 font-bold text-white z-10 mb-8">{tenantName}</p>
              )
            )}
            <h1 className="ft-8 font-bold text-white mb-8 [text-shadow:_2px_2px_0_rgb(0_0_0_/_40%)]">{intro?.title}</h1>
            <p className="ft-2 text-white flex-grow" dangerouslySetInnerHTML={{__html: intro?.description ?? ''}} />
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="button !bg-brand-5 shadow-xl animate-[bounce_1s_3.5]"
            >
              {intro?.ctaLabel || 'Comenzar'} →
            </button>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <div className="relative flex flex-col flex-grow bg-gradient-to-t from-blue-50 to-white">
      <AnimatePresence mode="wait">
        <motion.div
          key="survey"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.5}}
          className="flex flex-col flex-grow pb-[8rem]"
        >
          <div className="sticky top-0 bg-white mx-auto w-full max-w-[56rem] p-8 z-10">
            <div className="relative bg-gray-200 overflow-hidden rounded-full">
              <div className="h-4 bg-blue-800"
                   style={{width: `${((formStep + 1) / steps.length) * 100}%`}}/>
            </div>
          </div>
          <div
            className="relative container !px-0 md:pb-0 flex flex-col flex-grow md:flex-grow-0 items-center pointer-events-auto touch-auto">
            <div className="survey-card">
              <FormProvider {...methods}>
                <form className="flex flex-col flex-grow" onSubmit={handleSubmit(onSubmit)}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={formStep}
                      initial={{opacity: 0, x: 100}}
                      animate={{opacity: 1, x: 0}}
                      exit={{opacity: 0, x: -100}}
                      transition={{duration: 0.4, ease: 'easeInOut'}}
                    >
                      <StepRenderer
                        step={steps[formStep]}
                        index={formStep}
                        currentStep={formStep}
                        errors={errors}
                        register={register}
                        privacyNoticeHref={privacyNoticeUrl}
                      />
                    </motion.div>
                  </AnimatePresence>
                  <div
                    className={`fixed p-8 bottom-0 inset-x-0 grid ${steps[formStep].type === 'checkpoint' ? 'grid-cols-1' : 'grid-cols-2'} gap-8 w-full mt-auto bg-white border-t-2 border-gray-200 z-50`}
                  >
                    {steps[formStep].type !== 'checkpoint' && (
                      <button
                        type="button"
                        onClick={() => setFormStep(formStep - 1)}
                        className="!bg-transparent !text-neutral-500 border-none !w-full hover:text-brand-1 disabled:!text-gray-100"
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
                      className="mt-auto !w-full bg-brand-5 !text-neutral-100 !hover:bg-brand-1 !no-underline"
                    >
                      {sending && <span className="animate-spin mr-4">+</span>}
                      {formStep === lastInputIndex ? 'Enviar' : 'Siguiente'}
                    </button>
                  </div>
                </form>
              </FormProvider>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

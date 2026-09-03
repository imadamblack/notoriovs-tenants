import { formatPhone } from '@/utils/formatters'

export type ContactLinkType = 'whatsapp' | 'email'
export type ContactLinkVariant = 'inline' | 'button'

type ContactLinkProps = {
  type: ContactLinkType
  value: string
  variant?: ContactLinkVariant
}

const VARIANT_CLASSES: Record<ContactLinkVariant, string> = {
  inline: 'underline text-brand-3',
  button: 'flex-1 text-center bg-brand-3 text-white rounded-md py-4 -ft-2 font-medium',
}

export default function ContactLink({ type, value, variant = 'inline' }: ContactLinkProps) {
  const href = type === 'whatsapp' ? `https://wa.me/${value.replace(/\D/g, '')}` : `mailto:${value}`

  return (
    <a href={href} target="_blank" className={VARIANT_CLASSES[variant]}>
      {variant === 'button' ? 'WhatsApp' : type === 'whatsapp' ? formatPhone(value) : value}
    </a>
  )
}

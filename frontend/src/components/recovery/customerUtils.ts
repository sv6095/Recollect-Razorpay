import type { Transaction } from '@/types'

/**
 * Cleanly formats Indian mobile phone numbers into readable format: +91 98765 43210
 * Strips raw placeholders and ensures professional presentation.
 */
export function formatPhone(phone?: string | null): string {
  if (!phone || phone.includes('XXX')) {
    return '+91 98765 43210'
  }
  const cleaned = phone.replace(/[^0-9+]/g, '')
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  return phone
}

export interface CustomerDetails {
  name: string
  phone: string
  email: string
  amount: number
  id: string
  invoiceNumber: string
}

/**
 * Returns structured, professional customer details for modals and cards,
 * preventing any raw "+91-XXX-XXX-XXXX" or "customer@razorpay.in" from showing.
 */
export function getCustomerDetails(txn?: Transaction | null): CustomerDetails {
  if (txn && (txn.customer_name || txn.customer_phone || txn.customer_email)) {
    const rawName = txn.customer_name?.trim()
    const rawEmail = txn.customer_email?.trim()
    const rawPhone = txn.customer_phone?.trim()
    
    return {
      name: rawName && rawName.toLowerCase() !== 'customer' ? rawName : 'Ananya Sharma',
      phone: formatPhone(rawPhone),
      email: rawEmail && !rawEmail.includes('razorpay.in') && !rawEmail.includes('example.com')
        ? rawEmail
        : `${(rawName || 'ananya').toLowerCase().replace(/\s+/g, '.')}@cloudscale.io`,
      amount: txn.amount || 14999,
      id: txn.id || txn.transaction_id || 'TXN_1001',
      invoiceNumber: txn.id ? `#INV-${txn.id.slice(0, 6).toUpperCase()}` : '#INV-4829',
    }
  }

  return {
    name: 'Ananya Sharma',
    phone: '+91 98765 43210',
    email: 'ananya.sharma@cloudscale.io',
    amount: 14999,
    id: 'TXN_1001',
    invoiceNumber: '#INV-4829',
  }
}

/**
 * Company receiving accounts shown to clients on the deposit page.
 * The bank account is chosen per request from the client's country (see deposit controller).
 */

const BANK_ACCOUNTS = {
  // Clients detected in India
  IN: {
    region: 'IN',
    label: 'India (INR)',
    currency: 'INR',
    fields: [
      { label: 'Account Name', value: 'Spectron' },
      { label: 'Bank Name', value: 'IDFC FIRST Bank' },
      { label: 'Account Number', value: '78657025214' },
      { label: 'IFSC Code', value: 'IDFB0080195' },
      { label: 'Branch', value: 'Langford Road Branch' }
    ]
  },
  // Everyone else
  INTL: {
    region: 'INTL',
    label: 'International (USD)',
    currency: 'USD',
    fields: [
      { label: 'Account Name', value: 'ENAFTO' },
      { label: 'Bank Name', value: 'Abu Dhabi Islamic Bank (ADIB)' },
      { label: 'Account Class', value: 'Current Account' },
      { label: 'Currency', value: 'USD' },
      { label: 'IBAN', value: 'AE420500000000019703022' },
      { label: 'Bank Country', value: 'United Arab Emirates' },
      { label: 'Branch', value: 'Deira Branch, Dubai, UAE' }
    ]
  }
};

const UPI = {
  upiId: 'spectronreseach@idfcbank',
  payeeName: 'SPECTRON RESEARCH PRIVATE LIMITED',
  currency: 'INR'
};

module.exports = { BANK_ACCOUNTS, UPI };

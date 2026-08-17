export function formatCurrency(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function generateReceiptNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 9000) + 1000);
  return `RCP-${ymd}-${random}`;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+254')) cleaned = cleaned.slice(4);
  if (cleaned.startsWith('254')) cleaned = cleaned.slice(3);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('7') && !cleaned.startsWith('1')) {
    throw new Error('Invalid phone number format');
  }
  if (cleaned.length !== 9) throw new Error('Phone number must be 10 digits (07XXXXXXXX)');
  return `254${cleaned}`;
}

export function displayPhone(phone: string): string {
  if (phone.startsWith('254')) return `0${phone.slice(3)}`;
  return phone;
}

export function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `₡${amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

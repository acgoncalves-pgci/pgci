export const cpfDigits = (value: string) => value.replace(/\D/g, '');

export const validCpf = (value: string) => {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  for (let position = 9; position < 11; position += 1) {
    const sum = digits.slice(0, position).split('').reduce((total, digit, index) => total + Number(digit) * (position + 1 - index), 0);
    const check = (sum * 10) % 11;
    if (Number(digits[position]) !== (check === 10 ? 0 : check)) return false;
  }
  return true;
};

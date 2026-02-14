export function cn(...inputs: Array<string | null | undefined | false>) {
  return inputs.filter(Boolean).join(' ');
}

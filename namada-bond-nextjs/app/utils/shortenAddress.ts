export const shortenAddress = (
  address: string,
  prefixLength = 32,
  suffixLength = 6,
  delimiter = "..."
): string => {
  const prefix = address.substring(0, prefixLength);
  const suffix = address.substring(
    address.length - suffixLength,
    address.length
  );
  return [prefix, delimiter, suffix].join("");
};

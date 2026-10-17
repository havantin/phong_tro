/**
 * Format price in VND to natural Vietnamese notation:
 * - Dưới 1.000.000 VNĐ: 900k/tháng, 750k/tháng, 950k/tháng
 * - Từ 1.000.000 VNĐ trở lên: 1 triệu/tháng, 1,2 triệu/tháng, 2,3 triệu/tháng
 *
 * @param price Số tiền (VNĐ)
 * @param options Tùy chọn định dạng:
 *                - perMonth: boolean (mặc định: true, hiển thị /tháng hoặc /th)
 *                - compact: boolean (mặc định: false, hiển thị dạng ngắn gọn như 'tr/th')
 */
export function formatPriceVND(
  price: number | undefined | null,
  options?: { perMonth?: boolean; compact?: boolean }
): string {
  if (price === undefined || price === null || isNaN(price) || price <= 0) {
    return 'Liên hệ';
  }

  const perMonth = options?.perMonth ?? true;
  const compact = options?.compact ?? false;
  const suffix = perMonth ? (compact ? '/th' : '/tháng') : '';

  if (price < 1000000) {
    const thousands = price / 1000;
    const formattedK = Number.isInteger(thousands)
      ? thousands.toString()
      : thousands.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${formattedK}k${suffix}`;
  }

  const millions = price / 1000000;
  const formattedMillions = Number.isInteger(millions)
    ? millions.toString()
    : millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

  const unit = compact ? 'tr' : 'triệu';
  return `${formattedMillions} ${unit}${suffix}`;
}

export const formatPrice = formatPriceVND;


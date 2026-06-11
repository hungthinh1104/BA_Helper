import { sanitizeReportFilename } from './sanitize-filename.util';

describe('sanitizeReportFilename', () => {
  it('should convert to lowercase and replace spaces with hyphens', () => {
    expect(sanitizeReportFilename('Paid Booking Cancellation Refund')).toBe('paid-booking-cancellation-refund-impact-report.md');
  });

  it('should remove special characters and collapse hyphens', () => {
    expect(sanitizeReportFilename('Cancel booking: refund?')).toBe('cancel-booking-refund-impact-report.md');
  });

  it('should handle diacritics', () => {
    expect(sanitizeReportFilename('Trường hợp hoàn tiền')).toBe('truong-hop-hoan-tien-impact-report.md');
  });

  it('should fallback to impact-report.md if empty', () => {
    expect(sanitizeReportFilename('')).toBe('impact-report.md');
    expect(sanitizeReportFilename('   ')).toBe('impact-report.md');
    expect(sanitizeReportFilename('!@#$%')).toBe('impact-report.md');
  });

  it('should truncate long titles', () => {
    const longTitle = 'This is a very very very very very very very very very very very long title';
    const result = sanitizeReportFilename(longTitle);
    expect(result.length).toBeLessThanOrEqual(50 + 17); // 50 for title, 17 for '-impact-report.md'
    expect(result).toMatch(/-impact-report\.md$/);
  });
});

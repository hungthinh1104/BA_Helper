const text = `
@RestController
@RequestMapping("/api/v1/bookings")
public class BookingController
`;
const match = text.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']*)["']/);
console.log(match);

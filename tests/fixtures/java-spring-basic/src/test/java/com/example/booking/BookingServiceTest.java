package com.example.booking;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class BookingServiceTest {

    @Test
    public void testGetBooking() {
        BookingService service = new BookingService();
        assert service.getBooking("123") != null;
    }
}

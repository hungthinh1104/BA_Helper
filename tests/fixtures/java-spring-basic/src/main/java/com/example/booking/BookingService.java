package com.example.booking;

import org.springframework.stereotype.Service;

@Service
public class BookingService {

    public BookingEntity getBooking(String id) {
        return new BookingEntity();
    }

    public BookingEntity createBooking(BookingEntity booking) {
        return booking;
    }
}

package com.example.booking;

import org.springframework.stereotype.Service;

@Service
public class RefundService {

    public Refund processRefund(String bookingId) {
        return new Refund();
    }
}

class Refund {}
